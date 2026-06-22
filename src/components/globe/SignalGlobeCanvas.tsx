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
//   • idle  → slow auto-rotation
//   • new signal ticks in → camera flies to it, the point pulses, ticker row
//     highlights (via onFocus), then rotation resumes after a dwell
//   • throttled to ~1 fly / FLY_INTERVAL, higher severity first (no whiplash)
//   • click a point (or a ticker row via focusRequest) → fly + tracking popup

import React, { useEffect, useRef, useState } from 'react'
import {
  type GlobeSignal,
  type GlobeIncident,
  signalColor,
  incidentColor,
  incidentSize,
  signalSize,
  signalSeverityNum,
  CESIUM_CDN_BASE,
  CESIUM_VERSION,
  OVIX_API_BASE,
} from './globeShared'

interface FocusRequest {
  id: number
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
  sevText: string
  sevColor: string
  region: string
  incidentSlug: string | null
  signalId: number | null
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
  const signalEntitiesRef = useRef<any[]>([])
  const incidentEntitiesRef = useRef<any[]>([])
  const pulseEntitiesRef = useRef<any[]>([])
  const metaRef = useRef<Map<string, any>>(new Map())

  // auto-fly / rotation state
  const seenRef = useRef<Set<number>>(new Set())
  const firstLoadRef = useRef(true)
  const flyQueueRef = useRef<GlobeSignal[]>([])
  const flyingRef = useRef(false)
  const lastFlyRef = useRef(0)
  const idleResumeRef = useRef(0)

  // popup tracking (position updated imperatively each frame to avoid re-renders)
  const popupPosRef = useRef<any>(null)
  const [popup, setPopup] = useState<PopupState | null>(null)

  // latest props mirrored into refs for use inside the persistent render loop
  const signalsRef = useRef<GlobeSignal[]>(signals)
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
          if (!meta) {
            setPopup(null)
            popupPosRef.current = null
            onFocusRef.current(null)
            return
          }
          popupPosRef.current = pos
          setPopup(meta.popup)
          onFocusRef.current(meta.focusId)
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
        handlers.push(clickHandler)

        // cursor affordance on hover
        const hoverHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
        hoverHandler.setInputAction((m: any) => {
          const picked = viewer.scene.pick(m.endPosition)
          const hit = Cesium.defined(picked) && picked.id && metaRef.current.has(picked.id.id)
          viewer.scene.canvas.style.cursor = hit ? 'pointer' : 'default'
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
        handlers.push(hoverHandler)

        // pause auto-rotate on manual interaction
        const pause = () => {
          idleResumeRef.current = Date.now() + IDLE_RESUME_MS
        }
        viewer.scene.canvas.addEventListener('pointerdown', pause)
        viewer.scene.canvas.addEventListener('wheel', pause, { passive: true })

        // ── persistent render-loop: rotate, pump fly queue, track popup ──
        const occluder = new Cesium.EllipsoidalOccluder(
          viewer.scene.globe.ellipsoid,
          viewer.camera.positionWC,
        )
        const onTick = () => {
          const now = Date.now()

          // pump auto-fly queue (throttled, severity-first)
          if (
            !flyingRef.current &&
            now - lastFlyRef.current >= FLY_INTERVAL_MS &&
            flyQueueRef.current.length > 0
          ) {
            flyQueueRef.current.sort((a, b) => signalSeverityNum(b) - signalSeverityNum(a))
            const next = flyQueueRef.current.shift()
            if (next) flyToSignal(next, false)
          }

          // idle auto-rotation
          if (!flyingRef.current && now >= idleResumeRef.current) {
            viewer.camera.rotate(Cesium.Cartesian3.UNIT_Z, ROTATE_RATE)
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

        // plot whatever data we already have
        plotSignals(signalsRef.current)
        plotIncidents(incidents)
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
    }
  }, [])

  // ── plotting ──
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
      const fill = new Cesium.CallbackProperty(() => {
        const frac = 1 - (Date.now() - created) / SIGNAL_MAX_AGE_MS
        return base.withAlpha(Math.max(0.1, Math.min(0.85, frac * 0.85)))
      }, false)
      const eid = `sig-${s.id}`
      const entity = viewer.entities.add({
        id: eid,
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        point: {
          pixelSize: signalSize(s),
          color: fill,
          outlineColor: base.withAlpha(0.5),
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(1e6, 1.1, 2e7, 0.5),
        },
      })
      metaRef.current.set(eid, {
        focusId: s.id,
        popup: {
          kind: 'signal' as const,
          title: s.title || 'Signal',
          sevText: signalSeverityNum(s) > 0 ? signalSeverityNum(s).toFixed(1) : (s.severity_label || '').toUpperCase(),
          sevColor: css,
          region: s.region_name || 'Global',
          incidentSlug: s.incident_slug,
          signalId: s.id,
        },
      })
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
      const eid = `inc-${p.id}`
      const entity = viewer.entities.add({
        id: eid,
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        point: {
          pixelSize: new Cesium.CallbackProperty(() => {
            const t = (Date.now() % 1600) / 1600
            return baseSize + Math.sin(t * Math.PI * 2) * 3
          }, false),
          color: ces.withAlpha(0.95),
          outlineColor: ces.withAlpha(0.9),
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(1e6, 1.25, 2e7, 0.55),
        },
      })
      // static halo
      const halo = viewer.entities.add({
        id: `inc-halo-${p.id}`,
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        point: {
          pixelSize: baseSize * 2.6,
          color: ces.withAlpha(0.08),
          outlineColor: ces.withAlpha(0.35),
          outlineWidth: 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(1e6, 1.25, 2e7, 0.55),
        },
      })
      metaRef.current.set(eid, {
        focusId: -p.id, // negative space so it never collides with signal ids
        popup: {
          kind: 'incident' as const,
          title: p.title || 'Incident',
          sevText: (p.sev_level || '').toUpperCase(),
          sevColor: css,
          region: domainPretty(p.domain),
          incidentSlug: p.slug,
          signalId: null,
        },
      })
      incidentEntitiesRef.current.push(entity, halo)
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

  function flyToSignal(s: GlobeSignal, showPopup: boolean) {
    const Cesium = cesiumRef.current
    const viewer = viewerRef.current
    if (!Cesium || !viewer) return
    const lat = Number(s.lat)
    const lon = Number(s.lon)
    if (isNaN(lat) || isNaN(lon)) return
    flyingRef.current = true
    lastFlyRef.current = Date.now()
    idleResumeRef.current = Date.now() + FLY_DURATION * 1000 + DWELL_MS
    pulseAt(lon, lat, signalColor(s.category))
    onFocusRef.current(s.id)
    if (showPopup) {
      popupPosRef.current = Cesium.Cartesian3.fromDegrees(lon, lat)
      setPopup({
        kind: 'signal',
        title: s.title || 'Signal',
        sevText: signalSeverityNum(s) > 0 ? signalSeverityNum(s).toFixed(1) : (s.severity_label || '').toUpperCase(),
        sevColor: signalColor(s.category),
        region: s.region_name || 'Global',
        incidentSlug: s.incident_slug,
        signalId: s.id,
      })
    }
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, FLY_HEIGHT),
      duration: FLY_DURATION,
      complete: () => {
        flyingRef.current = false
        lastFlyRef.current = Date.now()
        idleResumeRef.current = Date.now() + DWELL_MS
      },
      cancel: () => {
        flyingRef.current = false
      },
    })
  }

  // Fly to arbitrary coordinates (external focus with explicit lat/lon).
  function flyToCoords(
    lat: number,
    lon: number,
    opts?: { title?: string; category?: string; region?: string; signalId?: number | null },
  ) {
    const Cesium = cesiumRef.current
    const viewer = viewerRef.current
    if (!Cesium || !viewer) return
    if (isNaN(lat) || isNaN(lon)) return
    const css = signalColor(opts?.category)
    flyingRef.current = true
    lastFlyRef.current = Date.now()
    idleResumeRef.current = Date.now() + FLY_DURATION * 1000 + DWELL_MS
    pulseAt(lon, lat, css)
    if (opts?.title) {
      popupPosRef.current = Cesium.Cartesian3.fromDegrees(lon, lat)
      setPopup({
        kind: 'signal',
        title: opts.title,
        sevText: 'SIGNAL',
        sevColor: css,
        region: opts.region || 'Located',
        incidentSlug: null,
        signalId: opts.signalId ?? null,
      })
    }
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, FLY_HEIGHT),
      duration: FLY_DURATION,
      complete: () => {
        flyingRef.current = false
        lastFlyRef.current = Date.now()
        idleResumeRef.current = Date.now() + DWELL_MS
      },
      cancel: () => {
        flyingRef.current = false
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

      // 1) explicit coordinates
      const lat = detail.lat != null ? Number(detail.lat) : NaN
      const lon = detail.lon != null ? Number(detail.lon) : NaN
      if (!isNaN(lat) && !isNaN(lon)) {
        flyToCoords(lat, lon, { title: detail.title, category: detail.category })
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
    if (firstLoadRef.current) {
      signals.forEach((s) => seenRef.current.add(s.id))
      firstLoadRef.current = false
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
    plotSignals(signals)
  }, [signals])

  useEffect(() => {
    if (!readyRef.current) return
    plotIncidents(incidents)
  }, [incidents])

  // ── react to ticker-row clicks (focusRequest) ──
  useEffect(() => {
    if (!focusRequest || !readyRef.current) return
    const s = signalsRef.current.find((x) => x.id === focusRequest.id)
    if (s) flyToSignal(s, true)
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
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
                {popup.kind === 'incident' ? popup.sevText || 'INCIDENT' : popup.sevText || 'SIGNAL'}
              </span>
              <span style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {popup.kind}
              </span>
              <button
                onClick={() => {
                  setPopup(null)
                  popupPosRef.current = null
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
            <div style={{ fontSize: '0.66rem', color: '#94a3b8', marginBottom: popup.incidentSlug ? '0.45rem' : 0 }}>
              📍 {popup.region}
            </div>
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

function domainPretty(domain: string | null | undefined): string {
  return (domain || 'general').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
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
