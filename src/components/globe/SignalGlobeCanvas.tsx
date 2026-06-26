/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

// Native CesiumJS globe for the landing hero (hub-010).
// Ported from public/roc/globe/globe.html: same viewer config, token source
// (/api/ovix/config cesium_token), /api/roc-globe plotting, color + dedup scheme.
// Cesium is loaded from the CDN as a global <script> (matching globe.html) so it
// stays out of the Next bundle and never breaks SSR — this file is only ever
// reached through next/dynamic({ ssr:false }).
//
// Behaviour:
//   • idle (no fresh data, no recent interaction, hero on screen) → AUTO-CYCLE
//     TOUR: the camera hops signal→signal on a dwell timer (~5s), pulsing +
//     popping + enlarging each as it lands, looping a recent/high-severity slice
//     (hub-019). When there's nothing to tour it falls back to slow rotation.
//   • new signal ticks in → camera flies to it, the point pulses, ticker row
//     highlights (via onFocus), then the tour continues after a dwell
//   • throttled to ~1 fly / FLY_INTERVAL, higher severity first (no whiplash)
//   • click a point (or a ticker row via focusRequest) → fly + tracking popup
//   • user interaction (drag/wheel/touch/scroll/ticker-click/external focus) or
//     scrolling the hero out of view PAUSES the tour for TOUR_RESUME_MS so the
//     user can drive; it resumes once the hero is back on screen and settled.

import React, { useEffect, useRef, useState } from 'react'
import {
  type GlobeSignal,
  type GlobeIncident,
  signalColor,
  incidentColor,
  incidentSize,
  signalSize,
  signalSeverityNum,
  clusterPoints,
  densityColor,
  cleanTitle,
  domainLabel,
  timeAgo,
  CESIUM_CDN_BASE,
  CESIUM_VERSION,
  OVIX_API_BASE,
} from './globeShared'

// A ticker-row click carries the row's OWN signal object so the canvas flies to
// exactly that point — never a lookup in the (possibly refreshed/aged-out)
// current set, which used to silently no-op (hub-014 Part 2.1).
interface FocusRequest {
  signal: GlobeSignal
  nonce: number
}

interface Props {
  signals: GlobeSignal[]
  incidents: GlobeIncident[]
  focusRequest: FocusRequest | null
  onFocus: (id: number | null) => void
  onReady?: () => void
}

interface PopupState {
  kind: 'signal' | 'incident'
  title: string
  domain: string
  sevText: string
  sevColor: string
  region: string
  timeText: string
  approximate: boolean
  status: string | null
  incidentSlug: string | null
  signalId: number | null
}

// ── popup builders (fresh relative time each open) ──
function buildSignalPopup(s: GlobeSignal): PopupState {
  const n = signalSeverityNum(s)
  return {
    kind: 'signal',
    title: cleanTitle(s.title) || 'Signal',
    domain: domainLabel(s.category),
    sevText: n > 0 ? n.toFixed(1) : (s.severity_label || '').toUpperCase() || 'SIGNAL',
    sevColor: signalColor(s.category),
    region: s.region_name || 'Global',
    timeText: timeAgo(s.created_at),
    approximate: !!s.geo_source && s.geo_source !== 'precise',
    status: null,
    incidentSlug: s.incident_slug,
    signalId: s.id,
  }
}

function buildIncidentPopup(p: GlobeIncident): PopupState {
  return {
    kind: 'incident',
    title: p.title || 'Incident',
    domain: domainLabel(p.domain),
    sevText: (p.sev_level || '').toUpperCase() || 'INCIDENT',
    sevColor: incidentColor(p.sev_level),
    region: domainLabel(p.domain),
    timeText: p.created_at ? timeAgo(p.created_at) : '',
    approximate: false,
    status: p.status || null,
    incidentSlug: p.slug,
    signalId: null,
  }
}

// Tuning
const HOME = { lon: -30, lat: 20, height: 22_000_000 }
const ROTATE_RATE = 0.0009 // rad/frame — slow idle spin
const FLY_INTERVAL_MS = 6000 // throttle: at most one auto-fly per 6s
const FLY_DURATION = 1.8 // seconds
const DWELL_MS = 4500 // pause rotation after a fly
const IDLE_RESUME_MS = 9000 // pause rotation after manual interaction
const FLY_HEIGHT = 2_600_000
const SIGNAL_MAX_AGE_MS = 2 * 60 * 60 * 1000
const MAX_FLY_QUEUE = 12

// ── Auto-cycle tour (hub-019) ──
// When idle (no new signals to land, no recent user interaction, globe in view)
// the camera tours the signal set: fly → dwell + highlight + popup → advance →
// loop. Recent/high-severity first. Any user interaction (drag/wheel/scroll/
// ticker-click) pauses the tour for TOUR_RESUME_MS so an active user keeps full
// control; it resumes once the hero is back in view and interaction has settled.
const TOUR_DWELL_MS = 5000 // hold on each toured signal before advancing (4–6s)
const TOUR_MAX = 14 // signals visited per loop (recent/high-severity slice)
const TOUR_RESUME_MS = 12_000 // resume tour this long after the last interaction
const GLOBE_VISIBLE_RATIO = 0.35 // ≥ this fraction visible ⇒ globe is "on screen"
const FOCUS_BOOST_PX = 5 // extra dot radius when a signal is active/hovered

// ── Density heat-glow layer (hub-015) ──
// A soft background texture beneath the signal dots showing WHERE activity
// concentrates. Tuned subtle so it can never wash out incident headlines.
const DENSITY_CELL_DEG = 4 // grid bin size for clustering
const DENSITY_MIN_COUNT = 2 // only glow real concentrations (≥2 in a cell)
const DENSITY_MIN_PX = 64 // glow diameter at the low end of the count range
const DENSITY_MAX_PX = 210 // glow diameter at the busiest cluster
const DENSITY_MIN_ALPHA = 0.1 // center opacity, low end
const DENSITY_MAX_ALPHA = 0.32 // center opacity, busiest (kept well below incidents)
const DENSITY_HEIGHT = 6000 // lift just off the surface to avoid z-fighting

// One reusable radial-gradient sprite (white→transparent). Cesium tints it per
// cluster via billboard.color, so a single texture serves every glow blob.
let glowTexture: string | null = null
function getGlowTexture(): string {
  if (glowTexture) return glowTexture
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.5)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  glowTexture = canvas.toDataURL()
  return glowTexture
}

// ── Load Cesium from CDN exactly once (module-level singleton) ──
let cesiumPromise: Promise<any> | null = null
function loadCesium(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if ((window as any).Cesium) return Promise.resolve((window as any).Cesium)
  if (cesiumPromise) return cesiumPromise
  cesiumPromise = new Promise((resolve, reject) => {
    // widgets.css
    if (!document.querySelector('link[data-cesium]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = `${CESIUM_CDN_BASE}Widgets/widgets.css`
      link.setAttribute('data-cesium', '1')
      document.head.appendChild(link)
    }
    const existing = document.querySelector('script[data-cesium]') as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).Cesium))
      existing.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.src = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/Cesium.js`
    script.async = true
    script.setAttribute('data-cesium', '1')
    script.onload = () => resolve((window as any).Cesium)
    script.onerror = () => reject(new Error('Cesium failed to load'))
    document.head.appendChild(script)
  })
  return cesiumPromise
}

export default function SignalGlobeCanvas({
  signals,
  incidents,
  focusRequest,
  onFocus,
  onReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const popupRef = useRef<HTMLDivElement | null>(null)

  const viewerRef = useRef<any>(null)
  const cesiumRef = useRef<any>(null)
  const readyRef = useRef(false)

  // entity bookkeeping
  const densityEntitiesRef = useRef<any[]>([]) // heat-glow billboards (beneath dots)
  const signalEntitiesRef = useRef<any[]>([])
  const incidentEntitiesRef = useRef<any[]>([])
  const pulseEntitiesRef = useRef<any[]>([])
  const metaRef = useRef<Map<string, any>>(new Map())

  // auto-fly / rotation state
  const seenRef = useRef<Set<number>>(new Set())
  const firstLoadRef = useRef(true)
  const flyQueueRef = useRef<GlobeSignal[]>([])
  const flyingRef = useRef(false)
  const flightIdRef = useRef(0) // monotonic token: only the latest flight may clear flyingRef
  const lastFlyRef = useRef(0)
  const idleResumeRef = useRef(0)

  // auto-cycle tour state (hub-019)
  const tourListRef = useRef<GlobeSignal[]>([]) // prioritized loop, rebuilt on feed refresh
  const tourCursorRef = useRef(0) // index into tourListRef (mod length)
  const tourNextAtRef = useRef(0) // earliest time the next tour hop may fire (paces dwell)
  const tourResumeAtRef = useRef(0) // tour suppressed until now ≥ this (user-interaction gate)
  const globeVisibleRef = useRef(true) // IntersectionObserver: is the hero on screen?

  // highlight state (live, read inside per-frame CallbackProperties — no re-plot)
  const activeSignalIdRef = useRef<number | null>(null) // currently landed/clicked signal
  const hoveredSignalIdRef = useRef<number | null>(null) // signal under the cursor

  // popup tracking (position updated imperatively each frame to avoid re-renders)
  const popupPosRef = useRef<any>(null)
  const [popup, setPopup] = useState<PopupState | null>(null)

  // latest props mirrored into refs for use inside the persistent render loop
  const signalsRef = useRef<GlobeSignal[]>(signals)
  const incidentsRef = useRef<GlobeIncident[]>(incidents)
  const onFocusRef = useRef(onFocus)
  useEffect(() => {
    onFocusRef.current = onFocus
  }, [onFocus])

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  // ── one-time init ──
  useEffect(() => {
    let cancelled = false
    const handlers: any[] = []

    loadCesium()
      .then(async (Cesium) => {
        if (cancelled || !containerRef.current) return
        cesiumRef.current = Cesium

        const viewer = new Cesium.Viewer(containerRef.current, {
          baseLayer: false,
          animation: false,
          timeline: false,
          homeButton: false,
          fullscreenButton: false,
          navigationHelpButton: false,
          sceneModePicker: false,
          baseLayerPicker: false,
          geocoder: false,
          infoBox: false,
          selectionIndicator: false,
          creditContainer: document.createElement('div'), // hide credits chrome
        })
        viewerRef.current = viewer

        viewer.scene.skyAtmosphere.brightnessShift = -0.3
        viewer.scene.skyAtmosphere.saturationShift = -0.2
        viewer.scene.fog.enabled = false
        viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0b1120')
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#060610')
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(HOME.lon, HOME.lat, HOME.height),
        })

        // Token + imagery from the same source globe.html uses.
        try {
          const cfg: any = await fetch(`${OVIX_API_BASE}/api/ovix/config`)
            .then((r) => (r.ok ? r.json() : {}))
            .catch(() => ({}))
          if (!cancelled && cfg?.cesiumToken) {
            Cesium.Ion.defaultAccessToken = cfg.cesiumToken
            Cesium.IonImageryProvider.fromAssetId(3)
              .then((provider: any) => {
                if (!cancelled && viewerRef.current) viewer.imageryLayers.addImageryProvider(provider)
              })
              .catch(() => {})
          }
        } catch {
          /* globe still renders (dark) without imagery */
        }

        if (cancelled) {
          viewer.destroy()
          return
        }

        // ── click → popup ──
        const clickHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
        clickHandler.setInputAction((click: any) => {
          const picks = viewer.scene.drillPick(click.position, 5, 8, 8)
          let meta: any = null
          let pos: any = null
          for (const p of picks) {
            if (Cesium.defined(p) && p.id && metaRef.current.has(p.id.id)) {
              meta = metaRef.current.get(p.id.id)
              pos = p.id.position?.getValue(Cesium.JulianDate.now())
              break
            }
          }
          // A click is a user taking control — pause the auto-tour.
          markInteraction()
          if (!meta) {
            setPopup(null)
            popupPosRef.current = null
            activeSignalIdRef.current = null
            onFocusRef.current(null)
            return
          }
          popupPosRef.current = pos
          activeSignalIdRef.current = meta.kind === 'signal' ? meta.signal.id : null
          setPopup(
            meta.kind === 'incident'
              ? buildIncidentPopup(meta.incident)
              : buildSignalPopup(meta.signal),
          )
          onFocusRef.current(meta.focusId)
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
        handlers.push(clickHandler)

        // cursor affordance + live hover highlight (drives the focus boost)
        const hoverHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
        hoverHandler.setInputAction((m: any) => {
          const picked = viewer.scene.pick(m.endPosition)
          const hitMeta =
            Cesium.defined(picked) && picked.id ? metaRef.current.get(picked.id.id) : null
          viewer.scene.canvas.style.cursor = hitMeta ? 'pointer' : 'default'
          hoveredSignalIdRef.current = hitMeta?.kind === 'signal' ? hitMeta.signal.id : null
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
        handlers.push(hoverHandler)

        // Clear the hover highlight when the cursor leaves the canvas — MOUSE_MOVE
        // won't fire again, so a dot under an exiting pointer would otherwise stay focused.
        const onPointerLeave = () => {
          hoveredSignalIdRef.current = null
          viewer.scene.canvas.style.cursor = 'default'
        }
        viewer.scene.canvas.addEventListener('pointerleave', onPointerLeave)
        handlers.push({
          removeInputAction: () => viewer.scene.canvas.removeEventListener('pointerleave', onPointerLeave),
        })

        // pause auto-rotate + auto-tour on manual interaction
        const pause = () => {
          idleResumeRef.current = Date.now() + IDLE_RESUME_MS
          markInteraction()
        }
        viewer.scene.canvas.addEventListener('pointerdown', pause)
        viewer.scene.canvas.addEventListener('wheel', pause, { passive: true })
        viewer.scene.canvas.addEventListener('touchstart', pause, { passive: true })

        // Page scroll toward the feed below ⇒ user is engaging elsewhere: pause the
        // tour (but don't disturb the camera, so no idleResume bump here). The
        // IntersectionObserver below handles the globe scrolling fully out of view.
        const onScroll = () => markInteraction()
        window.addEventListener('scroll', onScroll, { passive: true })
        handlers.push({ removeInputAction: () => window.removeEventListener('scroll', onScroll) })

        // Track whether the hero is on screen — the tour only runs while visible.
        let io: IntersectionObserver | null = null
        if (containerRef.current && typeof IntersectionObserver !== 'undefined') {
          io = new IntersectionObserver(
            (entries) => {
              const e = entries[0]
              globeVisibleRef.current = !!e && e.intersectionRatio >= GLOBE_VISIBLE_RATIO
            },
            { threshold: [0, GLOBE_VISIBLE_RATIO, 0.6, 1] },
          )
          io.observe(containerRef.current)
          handlers.push({ removeInputAction: () => io?.disconnect() })
        }

        // ── persistent render-loop: rotate, pump fly queue, track popup ──
        const occluder = new Cesium.EllipsoidalOccluder(
          viewer.scene.globe.ellipsoid,
          viewer.camera.positionWC,
        )
        const onTick = () => {
          const now = Date.now()

          // The globe may auto-drive (fresh-signal land OR tour hop) only when the
          // hero is on screen and the user hasn't interacted recently — otherwise
          // an active user keeps full control (hub-019).
          const canAutoDrive = globeVisibleRef.current && now >= tourResumeAtRef.current

          // pump auto-fly queue (throttled, severity-first) — new signals land first
          if (
            canAutoDrive &&
            !flyingRef.current &&
            now - lastFlyRef.current >= FLY_INTERVAL_MS &&
            flyQueueRef.current.length > 0
          ) {
            flyQueueRef.current.sort((a, b) => signalSeverityNum(b) - signalSeverityNum(a))
            const next = flyQueueRef.current.shift()
            if (next) flyToSignal(next, true)
          }

          // auto-cycle tour: with nothing fresh to land, hop signal→signal on the
          // dwell timer so a passive viewer gets a living tour (hub-019). Each hop
          // flies + pulses + pops the signal, then dwells before advancing.
          const touring = canAutoDrive && tourListRef.current.length > 0
          if (
            touring &&
            !flyingRef.current &&
            flyQueueRef.current.length === 0 &&
            now >= tourNextAtRef.current
          ) {
            advanceTour()
          }

          // idle auto-rotation — ABSOLUTE longitude increment, not a relative
          // world-axis rotate. The auto-fly (flyToSignal/flyToCoords) leaves the
          // camera at an arbitrary tilt/roll; a relative camera.rotate resumed
          // from that orientation accumulates roll/pitch error across fly-tos and
          // the spin visually drifts/reverses after a few minutes. setView with an
          // explicit north-up/look-down orientation each tick normalizes the
          // camera so the spin is always one constant eastward direction (hub-016).
          // Only spin when NOT touring (the tour's flights provide the motion);
          // this keeps the camera still during a tour dwell so the highlight reads.
          if (!flyingRef.current && now >= idleResumeRef.current && !touring) {
            const c = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC)
            viewer.camera.setView({
              destination: Cesium.Cartesian3.fromRadians(
                // normalize to [-π, π) so the wrap at the antimeridian is explicit
                // (fromRadians doesn't canonicalize longitude) — CodeRabbit hub-016
                Cesium.Math.convertLongitudeRange(c.longitude + ROTATE_RATE),
                c.latitude,
                c.height,
              ),
              orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 },
            })
          }

          // track popup to its world position
          if (popupPosRef.current && popupRef.current) {
            occluder.cameraPosition = viewer.camera.positionWC
            const visible = occluder.isPointVisible(popupPosRef.current)
            const fn =
              Cesium.SceneTransforms.worldToWindowCoordinates ||
              Cesium.SceneTransforms.wgs84ToWindowCoordinates
            const win = visible ? fn(viewer.scene, popupPosRef.current) : null
            if (win) {
              popupRef.current.style.display = 'block'
              popupRef.current.style.left = `${win.x}px`
              popupRef.current.style.top = `${win.y}px`
            } else {
              popupRef.current.style.display = 'none'
            }
          }
        }
        viewer.clock.onTick.addEventListener(onTick)
        handlers.push({ removeInputAction: () => viewer.clock.onTick.removeEventListener(onTick) })

        readyRef.current = true
        setStatus('ready')
        onReady?.()
        // Hold the first tour hop a beat so the initial "landing" fly (scheduled
        // ~1.4s out in the signals effect) leads, then the tour takes over.
        tourNextAtRef.current = Date.now() + 2500

        // plot whatever data we already have (density first → drawn beneath)
        plotDensity(signalsRef.current)
        plotSignals(signalsRef.current)
        plotIncidents(incidentsRef.current)
      })
      .catch(() => {
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
      handlers.forEach((h) => {
        try {
          if (h.destroy) h.destroy()
          else h.removeInputAction?.()
        } catch {
          /* noop */
        }
      })
      try {
        viewerRef.current?.destroy()
      } catch {
        /* noop */
      }
      viewerRef.current = null
      readyRef.current = false
      metaRef.current.clear()
      densityEntitiesRef.current = []
    }
  }, [])

  // ── plotting ──

  // Background heat-glow tier (hub-015): soft translucent radial blobs at the
  // centroids of signal density clusters. Size + intensity scale with the
  // cluster's signal count, so busier regions glow larger/brighter. Sits BENEATH
  // the signal dots and incidents — those use disableDepthTestDistance:∞ and so
  // always draw on top; these glow billboards keep normal depth testing, so they
  // hug the surface and never wash out the headline tier. Recomputed (full
  // teardown + replace) on every feed refresh — static entities, no per-frame
  // CallbackProperty churn.
  function plotDensity(list: GlobeSignal[]) {
    const Cesium = cesiumRef.current
    const viewer = viewerRef.current
    if (!Cesium || !viewer) return
    densityEntitiesRef.current.forEach((e) => viewer.entities.remove(e))
    densityEntitiesRef.current = []

    // Cluster the same set that plotSignals actually plots (skip promoted, bad
    // coords, and aged-out) so the heat matches the visible dots.
    const now = Date.now()
    const points: { lat: number; lon: number }[] = []
    list.forEach((s) => {
      if (s.promoted) return
      const lat = Number(s.lat)
      const lon = Number(s.lon)
      if (isNaN(lat) || isNaN(lon)) return
      const created = new Date(s.created_at).getTime()
      if (isNaN(created) || now - created > SIGNAL_MAX_AGE_MS) return
      points.push({ lat, lon })
    })
    if (points.length === 0) return

    const clusters = clusterPoints(points, DENSITY_CELL_DEG).filter(
      (c) => c.count >= DENSITY_MIN_COUNT,
    )
    if (clusters.length === 0) return
    const maxCount = clusters.reduce((m, c) => Math.max(m, c.count), 1)
    const denom = Math.max(1, maxCount - DENSITY_MIN_COUNT)
    const image = getGlowTexture()
    if (!image) return

    clusters.forEach((c) => {
      const t = (c.count - DENSITY_MIN_COUNT) / denom // 0 (sparse) → 1 (busiest)
      const sizePx = DENSITY_MIN_PX + t * (DENSITY_MAX_PX - DENSITY_MIN_PX)
      const alpha = DENSITY_MIN_ALPHA + t * (DENSITY_MAX_ALPHA - DENSITY_MIN_ALPHA)
      const color = Cesium.Color.fromCssColorString(densityColor(t)).withAlpha(alpha)
      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(c.lon, c.lat, DENSITY_HEIGHT),
        billboard: {
          image,
          color,
          width: sizePx,
          height: sizePx,
          // Shrinks when zoomed out so glows don't smear into one blob.
          scaleByDistance: new Cesium.NearFarScalar(1e6, 1.0, 2.4e7, 0.45),
          // No disableDepthTestDistance → depth-tested against the globe, so the
          // glow stays a background texture under the always-on-top dots.
        },
      })
      densityEntitiesRef.current.push(entity)
    })
  }

  function plotSignals(list: GlobeSignal[]) {
    const Cesium = cesiumRef.current
    const viewer = viewerRef.current
    if (!Cesium || !viewer) return
    signalEntitiesRef.current.forEach((e) => {
      metaRef.current.delete(e.id)
      viewer.entities.remove(e)
    })
    signalEntitiesRef.current = []

    list.forEach((s) => {
      if (s.promoted) return // incident layer owns promoted signals (no double-plot)
      const lat = Number(s.lat)
      const lon = Number(s.lon)
      if (isNaN(lat) || isNaN(lon)) return
      const created = new Date(s.created_at).getTime()
      if (isNaN(created) || Date.now() - created > SIGNAL_MAX_AGE_MS) return
      const css = signalColor(s.category)
      const base = Cesium.Color.fromCssColorString(css)
      // Tier 3 (hub-018): region/country-centroid resolutions are only an
      // APPROXIMATE location. Render them hollow — a transparent core with a
      // brighter domain-colored ring — so a glance distinguishes them from the
      // solid precise/centroid dots. Still domain-colored (canonical palette),
      // still clickable, and the popup adds the "≈ approximate location" note.
      const approximate = s.geo_source === 'approximate'
      const sid = s.id
      // Live highlight: this dot is the toured/clicked/hovered one. Read each
      // frame so the active state tracks the tour + cursor with no re-plot.
      const isFocused = () =>
        activeSignalIdRef.current === sid || hoveredSignalIdRef.current === sid
      // Ambient tier, but with a legible floor (hub-019): dots stay clearly
      // visible (min alpha 0.3) and fade gently with age rather than vanishing —
      // still well below the incident headline tier. Focused dot goes fully solid.
      const fill = new Cesium.CallbackProperty(() => {
        const frac = 1 - (Date.now() - created) / SIGNAL_MAX_AGE_MS
        const a = Math.max(0.3, Math.min(0.9, 0.4 + frac * 0.5))
        if (isFocused()) return base.withAlpha(approximate ? 0.65 : 1)
        // Hollow look for approximate dots: translucent core (the ring carries
        // the color), so they read as "fuzzy" without disappearing.
        return base.withAlpha(approximate ? a * 0.32 : a)
      }, false)
      const outline = new Cesium.CallbackProperty(() => {
        const frac = 1 - (Date.now() - created) / SIGNAL_MAX_AGE_MS
        const a = Math.max(0.3, Math.min(0.9, 0.4 + frac * 0.5))
        // Bright white ring when focused so the active signal pops unmistakably.
        if (isFocused()) return Cesium.Color.WHITE.withAlpha(0.95)
        // Brighter ring on approximate dots so the hollow center reads as a ring.
        return base.withAlpha(approximate ? Math.min(0.9, a + 0.2) : 0.55)
      }, false)
      const eid = `sig-${s.id}`
      const entity = viewer.entities.add({
        id: eid,
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        point: {
          // Nudge approximate dots a touch larger; focused dot grows so it pops.
          pixelSize: new Cesium.CallbackProperty(() => {
            const b = signalSize(s) + (approximate ? 1 : 0)
            return isFocused() ? b + FOCUS_BOOST_PX : b
          }, false),
          color: fill,
          outlineColor: outline,
          outlineWidth: new Cesium.CallbackProperty(
            () => (isFocused() ? 2.5 : approximate ? 1.6 : 1.2),
            false,
          ),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(1e6, 1.1, 2e7, 0.5),
        },
      })
      metaRef.current.set(eid, { kind: 'signal' as const, focusId: s.id, signal: s })
      signalEntitiesRef.current.push(entity)
    })
  }

  function plotIncidents(list: GlobeIncident[]) {
    const Cesium = cesiumRef.current
    const viewer = viewerRef.current
    if (!Cesium || !viewer) return
    incidentEntitiesRef.current.forEach((e) => {
      metaRef.current.delete(e.id)
      viewer.entities.remove(e)
    })
    incidentEntitiesRef.current = []

    list.forEach((p) => {
      const lat = p.location_lat == null ? NaN : parseFloat(String(p.location_lat))
      const lon = p.location_lon == null ? NaN : parseFloat(String(p.location_lon))
      if (isNaN(lat) || isNaN(lon)) return
      const css = incidentColor(p.sev_level)
      const ces = Cesium.Color.fromCssColorString(css)
      const baseSize = incidentSize(p.sev_level)
      const position = Cesium.Cartesian3.fromDegrees(lon, lat)
      const eid = `inc-${p.id}`

      // Headline tier: large SEV-colored core that breathes.
      const entity = viewer.entities.add({
        id: eid,
        position,
        point: {
          pixelSize: new Cesium.CallbackProperty(() => {
            const t = (Date.now() % 1600) / 1600
            return baseSize + Math.sin(t * Math.PI * 2) * 3
          }, false),
          color: ces.withAlpha(0.95),
          outlineColor: Cesium.Color.WHITE.withAlpha(0.85),
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(1e6, 1.3, 2e7, 0.6),
        },
        // Always-on label so incidents are self-identifying headlines.
        label: {
          text: `${(p.sev_level || '').toUpperCase()} · ${truncate(p.title || 'Incident', 38)}`,
          font: "600 12px 'IBM Plex Sans', system-ui, sans-serif",
          fillColor: Cesium.Color.fromCssColorString('#e2e8f0'),
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('#060a16').withAlpha(0.82),
          backgroundPadding: new Cesium.Cartesian2(8, 5),
          outlineColor: ces.withAlpha(0.6),
          style: Cesium.LabelStyle.FILL,
          horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          pixelOffset: new Cesium.Cartesian2(baseSize + 8, 0),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          // Fade the label out when the marker is far/small to avoid clutter.
          translucencyByDistance: new Cesium.NearFarScalar(4e6, 1.0, 1.6e7, 0.0),
        },
      })

      // Continuously expanding pulse ring — the signature "live incident" beat.
      const ring = viewer.entities.add({
        id: `inc-ring-${p.id}`,
        position,
        point: {
          pixelSize: new Cesium.CallbackProperty(() => {
            const t = (Date.now() % 2200) / 2200
            return baseSize * 1.4 + t * baseSize * 2.6
          }, false),
          color: Cesium.Color.TRANSPARENT,
          outlineColor: new Cesium.CallbackProperty(() => {
            const t = (Date.now() % 2200) / 2200
            return ces.withAlpha((1 - t) * 0.6)
          }, false),
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(1e6, 1.3, 2e7, 0.6),
        },
      })

      // Static halo glow underneath.
      const halo = viewer.entities.add({
        id: `inc-halo-${p.id}`,
        position,
        point: {
          pixelSize: baseSize * 3,
          color: ces.withAlpha(0.1),
          outlineColor: ces.withAlpha(0.3),
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(1e6, 1.3, 2e7, 0.6),
        },
      })

      // focusId in negative space so it never collides with signal ids; the core
      // entity carries the click meta (ring/halo aren't in metaRef → not picked).
      metaRef.current.set(eid, { kind: 'incident' as const, focusId: -p.id, incident: p })
      incidentEntitiesRef.current.push(entity, ring, halo)
    })
  }

  function pulseAt(lon: number, lat: number, css: string) {
    const Cesium = cesiumRef.current
    const viewer = viewerRef.current
    if (!Cesium || !viewer) return
    const color = Cesium.Color.fromCssColorString(css)
    const start = Date.now()
    const DURATION = 1800
    const ring = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, lat),
      point: {
        pixelSize: new Cesium.CallbackProperty(() => {
          const t = Math.min(1, (Date.now() - start) / DURATION)
          return 8 + t * 46
        }, false),
        color: new Cesium.CallbackProperty(() => {
          const t = Math.min(1, (Date.now() - start) / DURATION)
          return color.withAlpha((1 - t) * 0.35)
        }, false),
        outlineColor: new Cesium.CallbackProperty(() => {
          const t = Math.min(1, (Date.now() - start) / DURATION)
          return color.withAlpha((1 - t) * 0.7)
        }, false),
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    })
    pulseEntitiesRef.current.push(ring)
    window.setTimeout(() => {
      try {
        viewer.entities.remove(ring)
      } catch {
        /* noop */
      }
      pulseEntitiesRef.current = pulseEntitiesRef.current.filter((e) => e !== ring)
    }, DURATION + 200)
  }

  // User took control (drag / wheel / touch / scroll / ticker-click / external
  // focus): suppress the auto-tour for a window so they can drive. The tour
  // resumes automatically once this elapses AND the hero is back on screen.
  function markInteraction() {
    tourResumeAtRef.current = Date.now() + TOUR_RESUME_MS
  }

  // Advance the auto-cycle tour to the next prioritized signal and fly to it.
  // Cursor is taken modulo the (possibly refreshed) list length so the loop is
  // always in-bounds and survives feed updates. flyToSignal handles the pulse +
  // popup highlight and schedules the next hop via tourNextAtRef in its complete
  // callback, so the dwell paces naturally.
  function advanceTour() {
    const list = tourListRef.current
    if (list.length === 0) return
    // Skip an immediate repeat of the just-landed signal when we have choices.
    let idx = tourCursorRef.current % list.length
    if (list.length > 1 && list[idx].id === activeSignalIdRef.current) {
      idx = (idx + 1) % list.length
    }
    tourCursorRef.current = idx + 1
    // Hold the camera if the next hop somehow can't fly, so we retry shortly.
    tourNextAtRef.current = Date.now() + FLY_DURATION * 1000 + TOUR_DWELL_MS
    flyToSignal(list[idx], true)
  }

  // Start a guarded flight. Bumps a monotonic token, marks flying, and returns a
  // settle() that only clears flyingRef if THIS is still the latest flight.
  // Issuing a new flyTo makes Cesium fire the previous flight's `cancel`
  // synchronously — the token guard stops that stale cancel from clearing the
  // NEW flight's state (which would let the queue pump mid-flight / whiplash).
  // A watchdog guarantees flyingRef always clears even if Cesium drops the
  // complete/cancel callback, so the auto-fly queue can never deadlock.
  function beginFlight(): () => void {
    const myId = ++flightIdRef.current
    flyingRef.current = true
    lastFlyRef.current = Date.now()
    window.setTimeout(
      () => {
        if (flightIdRef.current === myId && flyingRef.current) flyingRef.current = false
      },
      FLY_DURATION * 1000 + 2500,
    )
    return () => {
      if (flightIdRef.current === myId) {
        flyingRef.current = false
        lastFlyRef.current = Date.now()
      }
    }
  }

  function flyToSignal(s: GlobeSignal, showPopup: boolean) {
    const Cesium = cesiumRef.current
    const viewer = viewerRef.current
    if (!Cesium || !viewer) return
    const lat = Number(s.lat)
    const lon = Number(s.lon)
    if (isNaN(lat) || isNaN(lon)) return
    const settle = beginFlight()
    idleResumeRef.current = Date.now() + FLY_DURATION * 1000 + DWELL_MS
    activeSignalIdRef.current = s.id // live highlight: this dot pops while landed
    pulseAt(lon, lat, signalColor(s.category))
    onFocusRef.current(s.id)
    if (showPopup) {
      popupPosRef.current = Cesium.Cartesian3.fromDegrees(lon, lat)
      setPopup(buildSignalPopup(s))
    }
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, FLY_HEIGHT),
      duration: FLY_DURATION,
      complete: () => {
        settle()
        idleResumeRef.current = Date.now() + DWELL_MS
        // Pace the next tour hop from when we finished landing (natural dwell).
        tourNextAtRef.current = Date.now() + TOUR_DWELL_MS
      },
      cancel: () => {
        settle()
      },
    })
  }

  // Fly to arbitrary coordinates (external focus with explicit lat/lon).
  function flyToCoords(
    lat: number,
    lon: number,
    opts?: {
      title?: string
      category?: string
      region?: string
      signalId?: number | null
      incidentSlug?: string | null
    },
  ) {
    const Cesium = cesiumRef.current
    const viewer = viewerRef.current
    if (!Cesium || !viewer) return
    if (isNaN(lat) || isNaN(lon)) return
    const css = signalColor(opts?.category)
    const settle = beginFlight()
    idleResumeRef.current = Date.now() + FLY_DURATION * 1000 + DWELL_MS
    activeSignalIdRef.current = opts?.signalId ?? null
    pulseAt(lon, lat, css)
    if (opts?.title) {
      popupPosRef.current = Cesium.Cartesian3.fromDegrees(lon, lat)
      setPopup({
        kind: 'signal',
        title: cleanTitle(opts.title),
        domain: opts.category ? domainLabel(opts.category) : 'Signal',
        sevText: 'SIGNAL',
        sevColor: css,
        region: opts.region || 'Located',
        timeText: '',
        approximate: false,
        status: null,
        incidentSlug: opts.incidentSlug ?? null,
        signalId: opts.signalId ?? null,
      })
    }
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, FLY_HEIGHT),
      duration: FLY_DURATION,
      complete: () => {
        settle()
        idleResumeRef.current = Date.now() + DWELL_MS
      },
      cancel: () => {
        settle()
      },
    })
  }

  // Fly to an incident (the headline tier) → rich popup with "view incident →".
  // Used by in-globe incident clicks resolving through the focus hook.
  function flyToIncident(p: GlobeIncident) {
    const Cesium = cesiumRef.current
    const viewer = viewerRef.current
    if (!Cesium || !viewer) return
    const lat = p.location_lat == null ? NaN : parseFloat(String(p.location_lat))
    const lon = p.location_lon == null ? NaN : parseFloat(String(p.location_lon))
    if (isNaN(lat) || isNaN(lon)) return
    const settle = beginFlight()
    idleResumeRef.current = Date.now() + FLY_DURATION * 1000 + DWELL_MS
    activeSignalIdRef.current = null // an incident is active, not a signal dot
    pulseAt(lon, lat, incidentColor(p.sev_level))
    onFocusRef.current(-p.id)
    popupPosRef.current = Cesium.Cartesian3.fromDegrees(lon, lat)
    setPopup(buildIncidentPopup(p))
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, FLY_HEIGHT),
      duration: FLY_DURATION,
      complete: () => {
        settle()
        idleResumeRef.current = Date.now() + DWELL_MS
      },
      cancel: () => {
        settle()
      },
    })
  }

  // ── external focus hook: window CustomEvent('wfm:globe-focus', { detail }) ──
  // detail is one of: { lat, lon, title?, category? } | { signalId } | { domain }.
  // Lets the OVIX tape (via the page.tsx postMessage bridge) and native sections
  // drive the globe without navigating. Auto-rotate pauses (flyTo* sets the dwell).
  useEffect(() => {
    const handler = (e: Event) => {
      if (!readyRef.current) return
      const detail = (e as CustomEvent).detail || {}
      // An external focus is a deliberate user action — yield the tour to them.
      markInteraction()

      // 0) incident identity → headline tier: fly + rich popup (Part 3). Checked
      // before raw coords so an incident "show on globe" never degrades to a
      // generic coordinate popup even when lat/lon are also supplied.
      if (detail.incidentSlug != null || detail.incidentId != null) {
        const inc = incidentsRef.current.find(
          (x) =>
            (detail.incidentSlug != null && x.slug === String(detail.incidentSlug)) ||
            (detail.incidentId != null && x.id === Number(detail.incidentId)),
        )
        if (inc) {
          flyToIncident(inc)
          return
        }
        // Incident not in current feed — fall through to coords if provided.
      }

      // 1) explicit coordinates
      const lat = detail.lat != null ? Number(detail.lat) : NaN
      const lon = detail.lon != null ? Number(detail.lon) : NaN
      if (!isNaN(lat) && !isNaN(lon)) {
        flyToCoords(lat, lon, {
          title: detail.title,
          category: detail.category ?? detail.domain,
          signalId: detail.signalId != null ? Number(detail.signalId) : null,
          incidentSlug: detail.incidentSlug != null ? String(detail.incidentSlug) : null,
        })
        return
      }

      // 2) explicit signal id → fly to that plotted signal
      if (detail.signalId != null) {
        const s = signalsRef.current.find((x) => x.id === Number(detail.signalId))
        if (s) flyToSignal(s, true)
        return
      }

      // 3) domain key → highest-severity, most-recent currently-plotted signal.
      // Normalize key (OVIX uses 'supply-chain', globe categories use 'supply_chain').
      if (detail.domain) {
        const cat = String(detail.domain).toLowerCase().replace(/-/g, '_')
        const now = Date.now()
        const candidates = signalsRef.current.filter((s) => {
          if (s.promoted) return false
          if (String(s.category || '').toLowerCase().replace(/-/g, '_') !== cat) return false
          const la = Number(s.lat)
          const lo = Number(s.lon)
          if (isNaN(la) || isNaN(lo)) return false
          const created = new Date(s.created_at).getTime()
          return !isNaN(created) && now - created <= SIGNAL_MAX_AGE_MS
        })
        if (candidates.length) {
          candidates.sort((a, b) => {
            const sev = signalSeverityNum(b) - signalSeverityNum(a)
            if (sev !== 0) return sev
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          })
          flyToSignal(candidates[0], true)
        }
        return
      }
    }
    window.addEventListener('wfm:globe-focus', handler as EventListener)
    return () => window.removeEventListener('wfm:globe-focus', handler as EventListener)
  }, [])

  // ── react to new signal data: detect new ids, enqueue, re-plot ──
  useEffect(() => {
    signalsRef.current = signals
    if (!readyRef.current) return

    // Rebuild the auto-cycle tour route: plottable, non-promoted, non-aged
    // signals, recent/high-severity first, capped at TOUR_MAX. The cursor wraps
    // mod length, so refreshing this mid-loop is always safe (hub-019).
    const nowTs = Date.now()
    tourListRef.current = signals
      .filter((s) => {
        if (s.promoted) return false
        const la = Number(s.lat)
        const lo = Number(s.lon)
        if (isNaN(la) || isNaN(lo)) return false
        const created = new Date(s.created_at).getTime()
        return !isNaN(created) && nowTs - created <= SIGNAL_MAX_AGE_MS
      })
      .sort((a, b) => {
        const sev = signalSeverityNum(b) - signalSeverityNum(a)
        if (sev !== 0) return sev
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
      .slice(0, TOUR_MAX)

    if (firstLoadRef.current) {
      signals.forEach((s) => seenRef.current.add(s.id))
      firstLoadRef.current = false
      // First load: visibly "land" on real activity (highest-severity, tie →
      // most recent) instead of idling, so the globe demonstrates live data.
      // This kicks off the tour from the top of the route.
      const landing = tourListRef.current[0]
      if (landing) {
        window.setTimeout(() => {
          if (readyRef.current) flyToSignal(landing, true)
        }, 1400)
      }
    } else {
      const fresh = signals.filter((s) => !seenRef.current.has(s.id) && !s.promoted)
      fresh.forEach((s) => seenRef.current.add(s.id))
      signals.forEach((s) => seenRef.current.add(s.id))
      if (fresh.length > 0) {
        flyQueueRef.current.push(...fresh)
        if (flyQueueRef.current.length > MAX_FLY_QUEUE) {
          flyQueueRef.current.sort((a, b) => signalSeverityNum(b) - signalSeverityNum(a))
          flyQueueRef.current = flyQueueRef.current.slice(0, MAX_FLY_QUEUE)
        }
      }
    }
    plotDensity(signals)
    plotSignals(signals)
  }, [signals])

  useEffect(() => {
    incidentsRef.current = incidents
    if (!readyRef.current) return
    plotIncidents(incidentsRef.current)
  }, [incidents])

  // ── react to ticker-row clicks (focusRequest) ──
  // Flies using the clicked row's OWN signal object (carried in focusRequest), so
  // it ALWAYS flies + pops — never a lookup that could miss an aged-out/refreshed
  // signal and silently no-op (hub-014 Part 2.1).
  useEffect(() => {
    if (!focusRequest || !readyRef.current) return
    markInteraction() // a ticker-row click is the user driving — pause the tour
    flyToSignal(focusRequest.signal, true)
  }, [focusRequest])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {status !== 'ready' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <CssGlobePlaceholder
            label={status === 'error' ? 'Globe unavailable' : 'Initializing globe…'}
          />
        </div>
      )}

      {/* tracking popup — positioned imperatively each frame */}
      <div
        ref={popupRef}
        style={{
          position: 'absolute',
          display: 'none',
          transform: 'translate(14px, -50%)',
          maxWidth: '20rem',
          zIndex: 6,
          pointerEvents: 'auto',
        }}
      >
        {popup && (
          <div
            style={{
              background: 'rgba(6,10,22,0.96)',
              border: `1px solid ${popup.sevColor}`,
              borderRadius: '6px',
              padding: '0.7rem 0.85rem',
              boxShadow: '0 8px 28px rgba(0,0,0,0.6)',
              fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: popup.sevColor,
                  border: `1px solid ${popup.sevColor}`,
                  borderRadius: '4px',
                  padding: '0.05rem 0.35rem',
                }}
              >
                {popup.sevText}
              </span>
              {popup.kind === 'incident' ? (
                <span
                  style={{
                    fontSize: '0.55rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    fontFamily: "'IBM Plex Mono', monospace",
                    color: '#ef4444',
                  }}
                >
                  ● Incident
                </span>
              ) : (
                <span style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {popup.domain}
                </span>
              )}
              {popup.kind === 'incident' && popup.status && (
                <span style={{ fontSize: '0.58rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {popup.status}
                </span>
              )}
              <button
                onClick={() => {
                  setPopup(null)
                  popupPosRef.current = null
                  activeSignalIdRef.current = null
                  markInteraction()
                  onFocus(null)
                }}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1 }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#e2e8f0', lineHeight: 1.35, marginBottom: '0.3rem' }}>
              {popup.title}
            </div>
            <div style={{ fontSize: '0.66rem', color: '#94a3b8', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.3rem' }}>
              <span>📍 {popup.region}</span>
              {popup.kind === 'signal' && <span>{popup.domain}</span>}
              {popup.timeText && (
                <span>🕑 {popup.timeText === 'now' ? 'now' : `${popup.timeText} ago`}</span>
              )}
            </div>
            {popup.approximate && (
              <div style={{ fontSize: '0.6rem', color: '#eab308', marginBottom: '0.3rem', fontFamily: "'IBM Plex Mono', monospace" }}>
                ≈ approximate location
              </div>
            )}
            {popup.incidentSlug && (
              <a
                href={`/incidents/${popup.incidentSlug}`}
                style={{ fontSize: '0.72rem', color: '#22d3ee', fontWeight: 600, textDecoration: 'none' }}
              >
                View incident →
              </a>
            )}
            {!popup.incidentSlug && popup.signalId != null && (
              <a
                href={`/signals/${popup.signalId}`}
                style={{ fontSize: '0.72rem', color: '#22d3ee', fontWeight: 600, textDecoration: 'none' }}
              >
                View signal →
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text
}

// Lightweight CSS sphere — placeholder while Cesium boots / on error.
export function CssGlobePlaceholder({ label }: { label?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}>
      <div
        style={{
          width: 'min(46vw, 300px)',
          height: 'min(46vw, 300px)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle at 35% 30%, #16243f 0%, #0d1830 45%, #060d1c 100%)',
          boxShadow: '0 0 60px rgba(34,211,238,0.18), inset -16px -16px 50px rgba(0,0,0,0.6)',
          border: '1px solid rgba(34,211,238,0.18)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent 0 22px, rgba(34,211,238,0.07) 22px 23px), repeating-linear-gradient(90deg, transparent 0 22px, rgba(34,211,238,0.07) 22px 23px)',
          }}
        />
      </div>
      {label && (
        <span
          style={{
            fontSize: '0.7rem',
            color: '#64748b',
            fontFamily: "'IBM Plex Mono', monospace",
            letterSpacing: '0.08em',
          }}
        >
          {label}
        </span>
      )}
    </div>
  )
}
