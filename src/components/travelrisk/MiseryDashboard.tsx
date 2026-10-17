'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import 'leaflet/dist/leaflet.css'
import type { Map as LMap, LayerGroup, Marker, TileLayer } from 'leaflet'
import type { MiseryAirport, MiseryGlobalRow, MiseryPayload, MiseryHistory, FrameCell } from '@/lib/misery'

/**
 * TRAVEL MISERY INDEX — the MiseryMap-style read-out of the 15-minute airport sweep (api-083, 2026-10-16).
 * Ted: "replicate how FlightAware's MiseryMap works, with our detail": rings on the dashboard only (the globe
 * keeps its squares), US default with a World switch.
 *
 *   ┌ header: US|World · score pill · band counts · flights · cancelled · window · sweep age · links ─────────┐
 *   │ MAP — Leaflet, radar underneath. One RING per airport:      │ RANKED — one bar per airport, worst first: │
 *   │ size = flights in the 2 h window; red arc = misery score;   │ red = misery, dark red = its cancellation  │
 *   │ dark-red part of the arc = the cancellation points of that  │ points; totals above (flights, cancelled)  │
 *   │ score; the rest green. Grey ring = not scored. Violet =     │ click a row to fly there                   │
 *   │ military. Hover a boarded airport → arcs to the far ends    │                                            │
 *   │ of its delayed / cancelled / diverted flights.              │                                            │
 *   │ ▶ replay bar: the last 24 h, one frame per hour             │                                            │
 *   ├────────────────────────────────────────────────────────────┴────────────────────────────────────────────┤
 *   │ SEVERE │ MISERABLE │ SLOW (auto-scroll, hover pauses, click flies) │ 24 H · COVERAGE · METHOD         │
 *   └─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Honesty: FlightAware counts flights (on-time / delayed / cancelled). Our feed gives a median, a 0–5 index and
 * a cancellation COUNT per airport, so the ring shows OUR SCORE (0–100), decomposed exactly as the rule builds
 * it: cancellation points (25 × min(1, cancelled% / 20)) in dark red, delay points in red, the remainder green.
 * Unscored airports are grey with their reason, never green. The replay uses the same SQL rule on stored rows.
 */

const BANDS = [
  { band: 'severe', from: 60, color: '#ef4444', note: '≥ 60 — ground stop, mass cancellations or hours-long medians' },
  { band: 'miserable', from: 40, color: '#f97316', note: '40 – 60' },
  { band: 'slow', from: 20, color: '#eab308', note: '20 – 40' },
  { band: 'calm', from: 0, color: '#18BC9C', note: '< 20' },
] as const
type Band = (typeof BANDS)[number]
const C_ONTIME = '#22c55e', C_MISERY = '#ef4444', C_CANCEL = '#7f1d1d', C_UNSCORED = '#475569', C_MILITARY = '#a78bfa', C_DIVERTED = '#a78bfa'
// FAA programme badges: what the regulator has done NOW, beside (never inside) the score.
const FAA_COLOR: Record<string, string> = { CLSD: '#f8fafc', GS: '#dc2626', GDP: '#f59e0b', DLY: '#64748b' }
const FAA_INK: Record<string, string> = { CLSD: '#0b1220', GS: '#fff', GDP: '#0b1220', DLY: '#fff' }
const FAA_NAME: Record<string, string> = { CLSD: 'FAA closure', GS: 'FAA ground stop', GDP: 'FAA ground delay programme', DLY: 'FAA departure/arrival delays' }
/** The strongest programme's badge. The label is one of four fixed strings, so it is safe in markup. */
function faaBadge(a: MiseryAirport): string {
  const p = a.faa?.[0]; if (!p || !FAA_COLOR[p.label]) return ''
  return `<span class="misd-faa" style="background:${FAA_COLOR[p.label]};color:${FAA_INK[p.label]}">${p.label}</span>`
}
// ── FLIGHTS mode: FlightAware's MiseryMap grammar from our own airport boards (rule airport_flight_counts v1) ──
type Mode = 'score' | 'flights'
const judged = (c: MiseryAirport['counts']) => (c ? c.ontime + c.delayed + c.cancelled : 0)
/** Ring = shares of on-time (green), delayed ≥ 15 min (red) and cancelled (dark red) flights within ±60 min. */
function flightsRingSvg(px: number, c: MiseryAirport['counts'], code: string | null): string {
  const r = px / 2 - 2.2, cx = px / 2, circ = 2 * Math.PI * r, sw = px >= 30 ? 4.2 : px >= 20 ? 3.4 : 2.6
  const label = code && px >= 28 && /^[A-Z0-9]{3,4}$/.test(code) ? `<text x="${cx}" y="${cx + 3.2}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-weight="700" font-size="${px >= 40 ? 11 : 9}" fill="#f1f5f9">${code}</text>` : ''
  const n = judged(c)
  if (!c || n < 5) return `<svg width="${px}" height="${px}" viewBox="0 0 ${px} ${px}"><circle cx="${cx}" cy="${cx}" r="${r}" fill="rgba(11,18,32,.8)" stroke="${C_UNSCORED}" stroke-width="${sw}" stroke-dasharray="3 2"/>${label}</svg>`
  const bad = ((c.delayed + c.cancelled) / n) * circ, cx_ = (c.cancelled / n) * circ
  return `<svg width="${px}" height="${px}" viewBox="0 0 ${px} ${px}"><g transform="rotate(-90 ${cx} ${cx})">`
    + `<circle cx="${cx}" cy="${cx}" r="${r}" fill="rgba(11,18,32,.85)" stroke="${C_ONTIME}" stroke-width="${sw}"/>`
    + (bad > 0 ? `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${C_MISERY}" stroke-width="${sw}" stroke-dasharray="${bad.toFixed(2)} ${(circ - bad).toFixed(2)}"/>` : '')
    + (cx_ > 0 ? `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${C_CANCEL}" stroke-width="${sw}" stroke-dasharray="${cx_.toFixed(2)} ${(circ - cx_).toFixed(2)}"/>` : '')
    + `</g>${label}</svg>`
}
const pctOf = (c: MiseryAirport['counts']) => (c && c.bad_share != null ? Math.round(c.bad_share * 100) : null)

function FaaPill({ a }: { a: MiseryAirport }) {
  const p = a.faa?.[0]; if (!p) return null
  return <span className="misd-pill" title={a.faa.map((x) => x.title).join(' · ')} style={{ background: FAA_COLOR[p.label], color: FAA_INK[p.label] }}>{p.label}</span>
}
const MONO = "'IBM Plex Mono', ui-monospace, monospace"
const WORLD: [[number, number], [number, number]] = [[-50, -170], [72, 180]]
const CONUS: [[number, number], [number, number]] = [[23.5, -126], [50.5, -66]]
const REASON: Record<string, string> = {
  insufficient_qualified: 'fewer than 5 flights with statistics',
  no_statistics: 'feed gave no delay statistics',
  no_commercial_data: 'military field — no commercial data',
  absent_from_feed: 'not in the vendor sweep',
  no_traffic_in_window: 'no scheduled traffic in the 2 h window',
  never_observed: 'never observed',
  no_traffic: 'no traffic',
}
type Region = 'us' | 'world'
type Frame = { misery: number | null; cancelled: number; movements: number; cancel_rate: number | null }

const bandOf = (m: number): Band => BANDS.find((b) => m >= b.from) ?? BANDS[3]
const ringPx = (mov: number | null) => Math.max(14, Math.min(46, Math.round(6 + 2.2 * Math.sqrt(mov || 0))))
const cancelPts = (rate: number | null) => (rate == null ? 0 : 25 * Math.min(1, rate / 0.2))
const parse = (v: string | null) => (v ? Date.parse(v) : NaN)
function ago(v: string | null, now: number | null): string {
  const t = parse(v)
  if (Number.isNaN(t)) return '—'
  if (now === null) return new Date(t).toISOString().slice(11, 16) + 'Z'
  const m = Math.max(0, Math.round((now - t) / 60e3))
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`
}
const hhmm = (v: string | null) => { const t = parse(v); return Number.isNaN(t) ? '—' : new Date(t).toISOString().slice(11, 16) + 'Z' }
const mins = (m: number | null) => (m == null ? '—' : m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} m` : `${Math.round(m)} min`)
const signed = (v: number) => (v > 0 ? '+' : '') + v.toFixed(1)
const num = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString())
const place = (a: MiseryAirport) => [a.city, a.country].filter(Boolean).join(', ')
const reasonText = (a: MiseryAirport) => REASON[a.misery_reason ?? ''] ?? a.misery_reason ?? 'not scored'
const inRegion = (a: MiseryAirport, r: Region) => r === 'world' || a.country === 'US'
const weighted = (rows: { misery: number | null; movements: number | null }[]) => {
  let s = 0, w = 0
  for (const r of rows) if (r.misery != null) { const m = Math.max(1, r.movements ?? 1); s += r.misery * m; w += m }
  return w ? s / w : null
}

/** Leaflet treats string content as HTML; API strings always go in as text nodes. */
function textEl(t: string): HTMLElement { const e = document.createElement('span'); e.textContent = t; return e }

/** The ring. Built from numbers and fixed colours only — no API string reaches the markup. */
function ringSvg(px: number, misery: number | null, cPts: number, kind: 'scored' | 'unscored' | 'military', code: string | null): string {
  const r = px / 2 - 2.2, c = px / 2, circ = 2 * Math.PI * r, sw = px >= 30 ? 4.2 : px >= 20 ? 3.4 : 2.6
  const label = code && px >= 28 && /^[A-Z0-9]{3,4}$/.test(code) ? `<text x="${c}" y="${c + 3.2}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-weight="700" font-size="${px >= 40 ? 11 : 9}" fill="#f1f5f9">${code}</text>` : ''
  if (kind === 'military') return `<svg width="${px}" height="${px}" viewBox="0 0 ${px} ${px}"><circle cx="${c}" cy="${c}" r="${r}" fill="rgba(11,18,32,.85)" stroke="${C_MILITARY}" stroke-width="${sw}"/><path d="M${c - 3} ${c}h6M${c} ${c - 3}v6" stroke="#fff" stroke-width="1.6"/></svg>`
  if (kind === 'unscored' || misery == null) return `<svg width="${px}" height="${px}" viewBox="0 0 ${px} ${px}"><circle cx="${c}" cy="${c}" r="${r}" fill="rgba(11,18,32,.8)" stroke="${C_UNSCORED}" stroke-width="${sw}" stroke-dasharray="3 2"/>${label}</svg>`
  const m = Math.min(100, Math.max(0, misery)), cp = Math.min(m, Math.max(0, cPts))
  const red = (m / 100) * circ, dark = (cp / 100) * circ
  // stroke-dasharray arcs start at 12 o'clock (rotate -90): green full ring under, red arc, dark-red cancellation part on top
  return `<svg width="${px}" height="${px}" viewBox="0 0 ${px} ${px}"><g transform="rotate(-90 ${c} ${c})">`
    + `<circle cx="${c}" cy="${c}" r="${r}" fill="rgba(11,18,32,.85)" stroke="${C_ONTIME}" stroke-width="${sw}"/>`
    + (red > 0 ? `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${C_MISERY}" stroke-width="${sw}" stroke-dasharray="${red.toFixed(2)} ${(circ - red).toFixed(2)}"/>` : '')
    + (dark > 0 ? `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${C_CANCEL}" stroke-width="${sw}" stroke-dasharray="${dark.toFixed(2)} ${(circ - dark).toFixed(2)}"/>` : '')
    + `</g>${label}</svg>`
}

function popup(a: MiseryAirport, f: Frame | null, now: number | null, replayAt: string | null): HTMLElement {
  const box = document.createElement('div')
  const head = document.createElement('b'); head.textContent = `${a.iata ?? a.icao} · ${a.name}`; box.appendChild(head)
  const lines: string[] = [place(a)]
  const misery = f ? f.misery : a.misery, cancelled = f ? f.cancelled : a.cancelled, movements = f ? f.movements : a.movements
  if (a.military) lines.push('Military airbase — no commercial data by construction')
  else if (misery != null) {
    const b = bandOf(misery)
    lines.push(`Misery ${Math.round(misery)} — ${b.band}${!f && a.vs_normal != null ? ` · ${signed(a.vs_normal)} vs normal (${a.baseline_maturity ?? 'baseline'})` : ''}`)
    lines.push(f ? `${num(movements)} flights in window · ${num(cancelled)} cancelled` : `${num(movements)} flights in window · ${num(cancelled)} cancelled · median delay ${mins(a.median_delay_min)} · index ${a.delay_index != null ? a.delay_index.toFixed(1) : '—'}/5`)
    if (!f && a.traffic_weight != null && a.traffic_weight < 1) lines.push(`Thin traffic: this window earns ${Math.round(a.traffic_weight * 100)} % of the full score (full at 20 flights)`)
    lines.push(`Ring: red = score, dark red = its cancellation points, green = the rest`)
  } else lines.push(f ? 'Not scored in this frame' : `Not scored — ${reasonText(a)}${a.movements ? ` · ${num(a.movements)} flights in window` : ''}`)
  if (a.counts && judged(a.counts) >= 5) lines.push(`Flights ±1 h (board ${ago(a.counts.observed_at, now)}): ${a.counts.ontime} on time · ${a.counts.delayed} delayed ≥15 min · ${a.counts.cancelled} cancelled${a.counts.unknown ? ` · ${a.counts.unknown} no status` : ''} — ${pctOf(a.counts)} % late or cancelled`)
  for (const p of a.faa ?? []) lines.push(`${FAA_NAME[p.label] ?? p.title}${p.detail ? ` — ${p.detail}` : ''}${p.ends_at ? ` · until ${hhmm(p.ends_at)}` : ''}${replayAt ? ' (live, not this frame)' : ''}`)
  if (a.faa?.length && misery != null && misery < 40) lines.push('The score counts flights that have already moved; held flights reach it only when they depart or land.')
  lines.push(replayAt ? `Replay frame ${hhmm(replayAt)}` : `Sweep ${ago(a.observed_at, now)} · ${a.icao}`)
  for (const t of lines) { const d = document.createElement('div'); d.textContent = t; box.appendChild(d) }
  return box
}

// ── Map ────────────────────────────────────────────────────────────────────

type StoryArc = { lat: number; lon: number; kind: string }

function MiseryMap({ airports, focus, now, region, frame, replayAt, arcs, mode }: {
  airports: MiseryAirport[]; focus: { icao: string; n: number } | null; now: number | null; region: Region; mode: Mode
  frame: Record<string, FrameCell> | null; replayAt: string | null; arcs: Map<string, StoryArc[]>
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<LMap | null>(null)
  const pins = useRef<LayerGroup | null>(null)
  const lines = useRef<LayerGroup | null>(null)
  const radar = useRef<TileLayer | null>(null)
  const markers = useRef(new Map<string, Marker>())
  const nowRef = useRef(now); nowRef.current = now
  const arcsRef = useRef(arcs); arcsRef.current = arcs
  const frameRef = useRef(frame); frameRef.current = frame
  const replayRef = useRef(replayAt); replayRef.current = replayAt
  const modeRef = useRef(mode); modeRef.current = mode

  useEffect(() => {
    let dead = false
    import('leaflet').then((L) => {
      if (dead || !el.current || map.current) return
      const m = L.map(el.current, { zoomControl: true, attributionControl: true, worldCopyJump: true, minZoom: 2, maxZoom: 10 })
      const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas'
      L.tileLayer(`${ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, { attribution: 'Esri, HERE, Garmin, © OpenStreetMap · radar © RainViewer · airport sweep © AeroDataBox', maxZoom: 12 }).addTo(m)
      L.tileLayer(`${ESRI}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 12, pane: 'overlayPane' }).addTo(m)
      lines.current = L.layerGroup().addTo(m)
      pins.current = L.layerGroup().addTo(m)
      m.fitBounds(region === 'us' ? CONUS : WORLD, { padding: [4, 4] })
      map.current = m
      draw(L)
      // Radar under the rings: RainViewer's newest global mosaic frame (the globe does the same; here one frame, live).
      fetch('https://api.rainviewer.com/public/weather-maps.json', { signal: AbortSignal.timeout(15000) })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const past = d?.radar?.past ?? []
          if (dead || !map.current || !past.length) return
          const fr = past[past.length - 1]
          radar.current = L.tileLayer(`${d.host}${fr.path}/256/{z}/{x}/{y}/2/1_1.png`, { opacity: 0.5, maxZoom: 12, pane: 'tilePane' }).addTo(map.current)
        })
        .catch(() => { /* no radar is a missing overlay, not a wrong map */ })
    })
    return () => { dead = true; map.current?.remove(); map.current = null }

  }, [])

  function draw(L: typeof import('leaflet')) {
    if (!pins.current) return
    pins.current.clearLayers()
    markers.current.clear()
    const f = frameRef.current
    const cell = (a: MiseryAirport): Frame | null => {
      if (!f) return null
      const c = f[a.icao]
      return c ? { misery: c[0], cancelled: c[1], movements: c[2], cancel_rate: c[3] } : { misery: null, cancelled: 0, movements: 0, cancel_rate: null }
    }
    const val = (a: MiseryAirport) => { const c = cell(a); return { misery: c ? c.misery : a.misery, movements: c ? c.movements : a.movements, rate: c ? c.cancel_rate : a.cancel_rate } }
    const order = (a: MiseryAirport) => (a.military ? -2 : val(a).misery == null ? -1 : (val(a).misery as number))
    const list = airports.filter((a) => a.lat != null && a.lon != null).slice().sort((x, y) => order(x) - order(y))
    for (const a of list) {
      const v = val(a)
      const px = a.military ? 14 : ringPx(v.movements)
      const kind = a.military ? 'military' : v.misery == null ? 'unscored' : 'scored'
      const code = a.iata ?? a.icao
      const flights = modeRef.current === 'flights' && !f && !a.military
      if (modeRef.current === 'flights' && !f && (a.military || !a.counts)) continue   // FlightAware draws only airports it has flights for
      const fpx = flights ? ringPx(a.counts?.flights ?? 0) : px
      const html = (flights ? flightsRingSvg(fpx, a.counts, code) : ringSvg(px, v.misery, cancelPts(v.rate) * (f ? 1 : a.traffic_weight ?? 1), kind, code)) + (replayRef.current ? '' : faaBadge(a))
      // the per-airport class is only ever an ICAO that passed the regex — it reaches a class attribute
      const cls = /^[A-Z0-9]{3,4}$/.test(a.icao) ? `misd-ring r-${a.icao}` : 'misd-ring'
      const mk = L.marker([a.lat, a.lon], { icon: L.divIcon({ className: cls, html, iconSize: [fpx, fpx], iconAnchor: [fpx / 2, fpx / 2] }), zIndexOffset: Math.round((flights ? (pctOf(a.counts) ?? -1) : order(a)) * 10) + (a.faa?.length ? 2000 : 0) })
      if (flights) mk.bindTooltip(textEl(`${a.faa?.[0] ? a.faa[0].label + ' · ' : ''}${code}${judged(a.counts) >= 5 ? ` ${pctOf(a.counts)} % late/cxl` : ' · no board'}`), { permanent: (pctOf(a.counts) ?? 0) >= 40 && fpx < 28, direction: 'right', offset: [fpx / 2 + 2, 0], className: 'misd-tip', opacity: 1 })
      else if (v.misery != null && v.misery >= 40 && px < 28) mk.bindTooltip(textEl(`${code} ${Math.round(v.misery)}`), { permanent: true, direction: 'right', offset: [px / 2 + 2, 0], className: 'misd-tip', opacity: 1 })
      else mk.bindTooltip(textEl(`${a.faa?.[0] && !replayRef.current ? a.faa[0].label + ' · ' : ''}${v.misery != null ? `${code} ${Math.round(v.misery)}` : code}`), { direction: 'right', offset: [px / 2 + 2, 0], className: 'misd-tip', opacity: 1 })
      mk.bindPopup(() => popup(a, cell(a), nowRef.current, replayRef.current))
      mk.on('mouseover', () => showArcs(L, a))
      mk.on('mouseout', () => lines.current?.clearLayers())
      mk.addTo(pins.current)
      markers.current.set(a.icao, mk)
    }
  }

  /** Hover: the far ends of this airport's delayed / cancelled / diverted flights — only airports the story worker boarded have them. */
  function showArcs(L: typeof import('leaflet'), a: MiseryAirport) {
    if (!lines.current) return
    lines.current.clearLayers()
    const list = arcsRef.current.get(a.icao)
    if (!list) return
    for (const x of list) {
      const col = x.kind === 'cancelled' ? C_CANCEL : x.kind === 'diverted' ? C_DIVERTED : C_MISERY
      L.polyline([[a.lat, a.lon], [x.lat, x.lon]], { color: col, weight: 1.4, opacity: 0.8, interactive: false }).addTo(lines.current)
    }
  }

  useEffect(() => { import('leaflet').then((L) => draw(L)) }, [airports, frame, mode])

  useEffect(() => { map.current?.flyToBounds(region === 'us' ? CONUS : WORLD, { padding: [4, 4], duration: 0.9 }) }, [region])

  useEffect(() => {
    if (!focus || !map.current) return
    const mk = markers.current.get(focus.icao)
    if (mk) { map.current.flyTo(mk.getLatLng(), 7, { duration: 0.8 }); mk.openPopup() }
  }, [focus])

  return <div ref={el} style={{ position: 'absolute', inset: 0, background: '#0b1220' }} />
}

// ── Ranked bars (worst first) ──────────────────────────────────────────────

function BarRow({ a, f, now, onPick }: { a: MiseryAirport; f: Frame | null; now: number | null; onPick: (icao: string) => void }) {
  const misery = f ? f.misery : a.misery, cancelled = f ? f.cancelled : a.cancelled, movements = f ? f.movements : a.movements, rate = f ? f.cancel_rate : a.cancel_rate
  const m = Math.min(100, misery ?? 0), cp = Math.min(m, cancelPts(rate) * (f ? 1 : a.traffic_weight ?? 1))
  const b = bandOf(misery ?? 0)
  return (
    <button onClick={() => onPick(a.icao)} className="misd-bar" title={f ? 'Replay frame — click to fly there' : `${place(a)} — click to fly there`}>
      <span style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
        <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 12, color: '#f1f5f9', width: 38, flex: 'none' }}>{a.iata ?? a.icao}</span>
        {!f && <FaaPill a={a} />}
      </span>
      <span className="misd-track">
        <span style={{ width: `${m}%`, background: C_MISERY }} />
        <span style={{ width: `${cp}%`, background: C_CANCEL }} />
      </span>
      <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 12, color: b.color, width: 28, textAlign: 'right', flex: 'none' }}>{Math.round(misery ?? 0)}</span>
      <span className="misd-barsub">
        {num(movements)} flights · {num(cancelled)} cxl{!f ? ` · median ${mins(a.median_delay_min)} · index ${a.delay_index != null ? a.delay_index.toFixed(1) : '—'}` : ''}{!f && a.vs_normal != null ? ` · ${signed(a.vs_normal)} vs normal` : ''}{!f ? ` · ${ago(a.observed_at, now)}` : ''}
      </span>
    </button>
  )
}

function FlightsRow({ a, now, onPick }: { a: MiseryAirport; now: number | null; onPick: (icao: string) => void }) {
  const c = a.counts!, n = judged(c), late = (c.delayed / n) * 100, cx = (c.cancelled / n) * 100, p = pctOf(c) ?? 0
  return (
    <button onClick={() => onPick(a.icao)} className="misd-bar" title={`${place(a)} — click to fly there`}>
      <span style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
        <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 12, color: '#f1f5f9', width: 38, flex: 'none' }}>{a.iata ?? a.icao}</span>
        <FaaPill a={a} />
      </span>
      <span className="misd-track">
        <span style={{ width: `${late + cx}%`, background: C_MISERY }} />
        <span style={{ width: `${cx}%`, background: C_CANCEL }} />
      </span>
      <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 12, color: p >= 40 ? C_MISERY : p >= 20 ? '#eab308' : '#22c55e', width: 28, textAlign: 'right', flex: 'none' }}>{p}%</span>
      <span className="misd-barsub">{c.ontime} on time · {c.delayed} delayed ≥15 · {c.cancelled} cxl{c.unknown ? ` · ${c.unknown} no status` : ''} · board {ago(c.observed_at, now)}</span>
    </button>
  )
}

// ── Auto-scrolling band column ─────────────────────────────────────────────

function Column({ band, items, onPick }: { band: Band; items: MiseryAirport[]; onPick: (icao: string) => void }) {
  const clip = useRef<HTMLDivElement>(null)
  const set = useRef<HTMLDivElement>(null)
  const [h, setH] = useState(0)
  useLayoutEffect(() => {
    const ch = set.current?.scrollHeight ?? 0, cl = clip.current?.clientHeight ?? 0
    setH(ch > cl + 4 ? ch : 0)
  }, [items])
  const c = band.color
  const list = (k: string) => (
    <div ref={k === 'a' ? set : undefined} key={k}>
      {items.map((a, i) => (
        <button key={k + i} onClick={() => onPick(a.icao)} className="misd-row" title="Fly to this airport on the map">
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
            <span style={{ color: c, fontWeight: 700, fontSize: 12, fontFamily: MONO }}>{a.iata ?? a.icao}</span>
            <span style={{ fontSize: 11, color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
            <span style={{ marginLeft: 'auto', fontFamily: MONO, fontWeight: 800, fontSize: 12, color: c }}>{Math.round(a.misery ?? 0)}</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: '#64748b' }}>
            {num(a.movements)} flights · {num(a.cancelled)} cancelled · median {mins(a.median_delay_min)} · index {a.delay_index != null ? a.delay_index.toFixed(1) : '—'}
            {a.vs_normal != null ? ` · ${signed(a.vs_normal)} vs normal` : ''}
          </div>
        </button>
      ))}
    </div>
  )
  return (
    <div className="misd-col">
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `2px solid ${c}`, padding: '6px 10px', fontFamily: MONO, fontWeight: 700, fontSize: 12, color: c, letterSpacing: '0.08em' }} title={band.note}>
        <span>{band.band.toUpperCase()}</span><span>{items.length}</span>
      </div>
      <div ref={clip} className="misd-clip">
        {items.length === 0 ? <div style={{ padding: 12, fontSize: 12, color: '#475569' }}>None</div> : (
          <div className={h ? 'misd-scroller' : undefined} style={h ? ({ '--h': `${h}px`, animationDuration: `${Math.max(12, h / 22)}s` } as React.CSSProperties) : undefined}>
            {list('a')}{h ? list('b') : null}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 24 h chart + coverage + method ─────────────────────────────────────────

function Trend({ series, now, mark }: { series: MiseryGlobalRow[]; now: number | null; mark: string | null }) {
  const pts = series.filter((s) => s.misery != null)
  const W = 300, H = 90, pad = 4
  const x = (i: number) => pad + (pts.length > 1 ? (i / (pts.length - 1)) * (W - 2 * pad) : 0)
  const y = (m: number) => pad + (1 - Math.min(100, m) / 100) * (H - 2 * pad)
  const path = pts.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.misery as number).toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1], first = pts[0]
  const peak = pts.reduce<MiseryGlobalRow | null>((m, s) => (m == null || (s.misery as number) > (m.misery as number) ? s : m), null)
  const mi = mark ? pts.findIndex((s) => s.observed_at >= mark) : -1
  return (
    <div style={{ padding: '6px 10px' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 90, display: 'block' }} role="img" aria-label="Global travel misery, last 24 hours">
        {BANDS.slice(0, 3).map((b) => <line key={b.band} x1={0} x2={W} y1={y(b.from)} y2={y(b.from)} stroke={b.color} strokeOpacity={0.35} strokeDasharray="3 3" />)}
        {pts.length > 1 && <path d={path} fill="none" stroke="#e2e8f0" strokeWidth={1.5} />}
        {mi >= 0 && <line x1={x(mi)} x2={x(mi)} y1={0} y2={H} stroke="#38bdf8" strokeWidth={1} />}
        {last && <circle cx={x(pts.length - 1)} cy={y(last.misery as number)} r={3} fill={bandOf(last.misery as number).color} />}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 10, color: '#64748b' }}>
        <span>{first ? ago(first.observed_at, now) : ''}</span>
        <span>{peak && peak.misery != null ? `peak ${peak.misery.toFixed(1)} · ${ago(peak.observed_at, now)}` : ''}</span>
        <span>{last ? ago(last.observed_at, now) : ''}</span>
      </div>
    </div>
  )
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export function MiseryDashboard({ d, backHref = '/travelrisk' }: { d: MiseryPayload; backHref?: string }) {
  const [now, setNow] = useState<number | null>(null)
  const [focus, setFocus] = useState<{ icao: string; n: number } | null>(null) // n: re-picking the same card flies again
  const pick = (icao: string) => setFocus((f) => ({ icao, n: (f?.n ?? 0) + 1 }))
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t) }, [])

  // US by default, World one click away; the choice is a per-viewer convenience.
  const [region, setRegion] = useState<Region>('us')
  useEffect(() => { try { const v = localStorage.getItem('misd-region'); if (v === 'world' || v === 'us') setRegion(v) } catch { /* private window */ } }, [])
  const chooseRegion = (r: Region) => { setRegion(r); try { localStorage.setItem('misd-region', r) } catch { /* ignore */ } }
  // Ring mode: our misery SCORE, or FLIGHTS on time / delayed / cancelled the way FlightAware draws it.
  const [mode, setMode] = useState<Mode>('score')
  useEffect(() => { try { const v = localStorage.getItem('misd-mode'); if (v === 'score' || v === 'flights') setMode(v) } catch { /* private window */ } }, [])
  const chooseMode = (m: Mode) => { setMode(m); try { localStorage.setItem('misd-mode', m) } catch { /* ignore */ } }

  // Replay: hourly frames, fetched on first press.
  const [hist, setHist] = useState<MiseryHistory | null>(null)
  const [histErr, setHistErr] = useState<string | null>(null)
  const [fi, setFi] = useState<number>(-1)          // -1 = live
  const [playing, setPlaying] = useState(false)
  const loadHist = async () => {
    if (hist) return hist
    try {
      const r = await fetch('/api/roc-misery-history', { signal: AbortSignal.timeout(30000) })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const h = (await r.json()) as MiseryHistory
      if (!h.frames?.length) throw new Error('no frames')
      setHist(h); setHistErr(null); return h
    } catch (e) { setHistErr(String((e as Error).message || e)); return null }
  }
  const play = async () => { const h = await loadHist(); if (!h) return; setFi((i) => (i < 0 || i >= h.frames.length - 1 ? 0 : i)); setPlaying(true) }
  useEffect(() => {
    if (!playing || !hist) return
    const t = setInterval(() => setFi((i) => { if (i >= hist.frames.length - 1) { setPlaying(false); return -1 } return i + 1 }), 800)
    return () => clearInterval(t)
  }, [playing, hist])
  const frame = fi >= 0 && hist ? hist.frames[fi] : null

  // Story-flight arcs (boarded airports only): far ends of delayed / cancelled / diverted flights.
  const [arcs, setArcs] = useState<Map<string, StoryArc[]>>(new Map())
  useEffect(() => {
    let dead = false
    fetch('/api/gev-story-flights', { signal: AbortSignal.timeout(25000) }).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (dead || !j?.flights) return
      const m = new Map<string, StoryArc[]>()
      for (const f of j.flights as { airport_icao: string; other_lat: number | null; other_lon: number | null; story_kind: string }[]) {
        if (typeof f.other_lat !== 'number' || typeof f.other_lon !== 'number') continue
        const l = m.get(f.airport_icao) ?? []; l.push({ lat: f.other_lat, lon: f.other_lon, kind: f.story_kind }); m.set(f.airport_icao, l)
      }
      setArcs(m)
    }).catch(() => { /* arcs are an extra, never a gap */ })
    return () => { dead = true }
  }, [])

  const airports = d.airports ?? []
  const g = d.global?.now ?? null
  const series = d.global?.series ?? []
  const regional = airports.filter((a) => inRegion(a, region))
  const FAA_RANK: Record<string, number> = { CLSD: 0, GS: 1, GDP: 2, DLY: 3 }
  const faaNow = regional.filter((a) => a.faa?.length).sort((x, y) => (FAA_RANK[x.faa[0].label] - FAA_RANK[y.faa[0].label]) || ((y.business_travel_weight ?? 0) - (x.business_travel_weight ?? 0)))
  const cellOf = (a: MiseryAirport): Frame | null => {
    if (!frame) return null
    const c = frame.airports[a.icao]
    return c ? { misery: c[0], cancelled: c[1], movements: c[2], cancel_rate: c[3] } : { misery: null, cancelled: 0, movements: 0, cancel_rate: null }
  }
  const live = (a: MiseryAirport) => { const c = cellOf(a); return c ? { misery: c.misery, movements: c.movements, cancelled: c.cancelled } : { misery: a.misery, movements: a.movements, cancelled: a.cancelled } }
  const scoredAll = airports.filter((a) => a.misery != null)
  const scoredR = regional.filter((a) => live(a).misery != null)
  const byBand = Object.fromEntries(BANDS.map((b) => [b.band, regional.filter((a) => a.misery != null && bandOf(a.misery).band === b.band).sort((x, y) => (y.misery as number) - (x.misery as number))])) as Record<string, MiseryAirport[]>
  const flightsRanked = regional.filter((a) => !a.military && judged(a.counts) >= 5).sort((x, y) => (y.counts!.bad_share ?? 0) - (x.counts!.bad_share ?? 0) || judged(y.counts) - judged(x.counts))
  const ranked = regional.filter((a) => !a.military && live(a).misery != null).sort((x, y) => (live(y).misery as number) - (live(x).misery as number) || (live(y).movements ?? 0) - (live(x).movements ?? 0))
  const rMean = weighted(scoredR.map((a) => ({ misery: live(a).misery, movements: live(a).movements })))
  const rFlights = scoredR.reduce((s, a) => s + (live(a).movements ?? 0), 0)
  const rCancelled = scoredR.reduce((s, a) => s + (live(a).cancelled ?? 0), 0)
  const gb = g && g.misery != null ? bandOf(g.misery) : null
  const prev = series.length > 4 ? series[series.length - 5] : null   // ~1 h earlier at 15-min sweeps
  const trend = g && g.misery != null && prev && prev.misery != null ? signed(g.misery - prev.misery) : null
  const reasons = Object.entries(d.meta?.unscored_by_reason ?? {}).sort((x, y) => y[1] - x[1])
  const maturity = d.meta?.baseline_maturity ?? {}
  const newest = airports.find((a) => a.observed_at === d.meta?.newest_observed_at) ?? airports.find((a) => a.observed_at)
  const windowText = newest ? `${hhmm(newest.window_start_at)} – ${hhmm(newest.window_end_at)}` : '—'
  const replayAt = frame ? frame.observed_at : null

  // Portal to <body>: the site layout wraps pages in a containing block that traps position:fixed.
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  if (!host) return <div style={{ minHeight: '100vh', background: '#060b16' }} />
  const regionLabel = region === 'us' ? 'US' : 'WORLD'
  return createPortal(
    <div className="misd-root">
      <style>{CSS}</style>
      <header className="misd-head">
        <a href={backHref} style={{ color: '#38bdf8', textDecoration: 'none', fontFamily: MONO, fontSize: 11 }}>← Travel Risk</a>
        <span style={{ fontFamily: MONO, fontWeight: 800, letterSpacing: '0.14em', fontSize: 14, color: '#f1f5f9' }}>TRAVEL MISERY INDEX</span>
        <span className="misd-seg" role="group" aria-label="Ring mode" title="SCORE: our misery index. FLIGHTS: share of flights within ±1 h that are delayed ≥ 15 min or cancelled, by current estimate — FlightAware's MiseryMap method, from our airport boards.">
          <button onClick={() => chooseMode('score')} aria-pressed={mode === 'score'}>SCORE</button>
          <button onClick={() => chooseMode('flights')} aria-pressed={mode === 'flights'}>FLIGHTS</button>
        </span>
        <span className="misd-seg" role="group" aria-label="Region">
          <button onClick={() => chooseRegion('us')} aria-pressed={region === 'us'}>US</button>
          <button onClick={() => chooseRegion('world')} aria-pressed={region === 'world'}>WORLD</button>
        </span>
        {g && g.misery != null && gb ? (
          <span title="Flight-weighted mean misery of every scored airport worldwide in the newest 15-minute sweep" style={{ fontFamily: MONO, fontWeight: 800, fontSize: 18, color: gb.color, border: `1px solid ${gb.color}66`, background: `${gb.color}1a`, borderRadius: 4, padding: '0 10px', lineHeight: '26px' }}>
            {Math.round(g.misery)} <span style={{ fontSize: 11, fontWeight: 700 }}>{gb.band.toUpperCase()}</span>
            {trend && <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginLeft: 8 }}>{trend} / 1 h</span>}
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginLeft: 8 }}>WORLD</span>
          </span>
        ) : <span style={{ fontFamily: MONO, fontSize: 11, color: '#94a3b8' }}>no scored sweep in the last 24 h</span>}
        {region === 'us' && rMean != null && (
          <span title="Flight-weighted mean misery of the scored US airports" style={{ fontFamily: MONO, fontWeight: 800, fontSize: 18, color: bandOf(rMean).color, border: `1px solid ${bandOf(rMean).color}66`, background: `${bandOf(rMean).color}1a`, borderRadius: 4, padding: '0 10px', lineHeight: '26px' }}>
            {Math.round(rMean)} <span style={{ fontSize: 11, fontWeight: 700 }}>{bandOf(rMean).band.toUpperCase()}</span><span style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginLeft: 8 }}>US</span>
          </span>
        )}
        <span style={{ display: 'flex', gap: 6 }}>
          {BANDS.map((b) => (
            <span key={b.band} title={b.note} style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: b.color, border: `1px solid ${b.color}55`, background: `${b.color}18`, borderRadius: 3, padding: '1px 6px' }}>
              {b.band} {byBand[b.band].length}
            </span>
          ))}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: '#64748b' }} title="15-minute AeroDataBox sweep; this page re-reads every 2 minutes">sweep {g ? ago(g.observed_at, now) : '—'}</span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 14, whiteSpace: 'nowrap' }}>
          <a href="/travelrisk/region/global/nws" style={{ color: '#38bdf8', fontFamily: MONO, fontSize: 11, textDecoration: 'none' }}>NWS warnings →</a>
          <a href="/travelrisk/region/global/space" style={{ color: '#38bdf8', fontFamily: MONO, fontSize: 11, textDecoration: 'none' }}>Space weather →</a>
          <a href="/roc/globe/world-glass.html" target="_blank" rel="noopener" style={{ color: '#38bdf8', fontFamily: MONO, fontSize: 11, textDecoration: 'none' }}>Globe ↗</a>
        </span>
      </header>

      <div className="misd-upper">
        <div className="misd-map">
          <MiseryMap airports={airports} focus={focus} now={now} region={region} frame={frame && mode === 'score' ? frame.airports : null} replayAt={mode === 'score' ? replayAt : null} arcs={arcs} mode={mode} />
          {mode === 'flights' ? (
          <div className="misd-legend">
            <div><span className="misd-sw" style={{ borderColor: C_MISERY }} />ring = flights within ±1 h by current estimate: red delayed ≥ 15 min · <i style={{ background: C_CANCEL }} />cancelled · <i style={{ background: C_ONTIME }} />on time</div>
            <div><span className="misd-sw" style={{ borderColor: C_UNSCORED, borderStyle: 'dashed' }} />fewer than 5 judged flights · airports without a board in the last 3 h are hidden</div>
            <div style={{ color: '#64748b', marginTop: 2 }}>FlightAware MiseryMap method (rule airport_flight_counts v1) · 30 busiest US airports every 2 h, hourly under an FAA programme · plus every story board · radar © RainViewer</div>
          </div>
          ) : (
          <div className="misd-legend">
            <div><span className="misd-sw" style={{ borderColor: C_MISERY }} />ring = misery score 0–100 · <i style={{ background: C_CANCEL }} />cancellation points · <i style={{ background: C_ONTIME }} />the rest</div>
            <div><span className="misd-sw" style={{ borderColor: C_UNSCORED, borderStyle: 'dashed' }} />not scored (statistics withheld / absent / no traffic) · <span className="misd-sw" style={{ borderColor: C_MILITARY }} />military airbase</div>
            <div><span className="misd-pill" style={{ background: FAA_COLOR.GS, color: '#fff' }}>GS</span> FAA ground stop · <span className="misd-pill" style={{ background: FAA_COLOR.GDP, color: '#0b1220' }}>GDP</span> ground delay programme · <span className="misd-pill" style={{ background: FAA_COLOR.CLSD, color: '#0b1220' }}>CLSD</span> closure — live, beside the score</div>
            <div style={{ color: '#64748b', marginTop: 2 }}>ring size = flights in the 2 h window · click a ring · hover a boarded airport for its delayed / cancelled flights&apos; far ends · radar © RainViewer</div>
          </div>
          )}
          {mode === 'score' && <div className="misd-replay">
            <button onClick={() => (playing ? setPlaying(false) : play())} title={playing ? 'Pause' : 'Replay the last 24 hours, one frame per hour'} aria-label={playing ? 'Pause replay' : 'Play 24 h replay'}>{playing ? '❚❚' : '▶'}</button>
            <input type="range" min={0} max={Math.max(0, (hist?.frames.length ?? 24) - 1)} value={fi < 0 ? Math.max(0, (hist?.frames.length ?? 24) - 1) : fi}
              onChange={async (e) => { const v = Number(e.target.value); const h = hist ?? (await loadHist()); if (h) { setPlaying(false); setFi(Math.min(v, h.frames.length - 1)) } }}
              aria-label="Replay position" />
            <button onClick={() => { setPlaying(false); setFi(-1) }} aria-pressed={fi < 0} title="Back to the live sweep">LIVE</button>
            <span style={{ fontFamily: MONO, fontSize: 10, color: frame ? '#38bdf8' : '#64748b' }}>
              {histErr ? `replay unavailable: ${histErr}` : frame ? `${hhmm(frame.observed_at)} · ${frame.observed_at.slice(5, 10)} · frame ${fi + 1}/${hist?.frames.length}` : `now · ${windowText} window`}
            </span>
          </div>}
        </div>
        <div className="misd-airports">
          <div className="misd-totals">
            <div><b>{num(rFlights)}</b><span>FLIGHTS</span></div>
            <div><b style={{ color: rCancelled ? C_MISERY : '#e2e8f0' }}>{num(rCancelled)}</b><span>CANCELLED</span></div>
            <div><b>{scoredR.length}<small>/{regional.length}</small></b><span>SCORED</span></div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: '#64748b', alignSelf: 'end' }}>{frame ? `replay ${hhmm(frame.observed_at)}` : `window ${windowText}`} · {regionLabel}</div>
          </div>
          {(faaNow.length > 0 || d.meta.faa?.error) && (
            <div className="misd-faastrip" title="Live FAA programmes (via travel-intel). Shown beside the score, never inside it: the score counts flights that have already moved.">
              <span style={{ color: '#94a3b8', fontWeight: 700, letterSpacing: '0.12em' }}>FAA NOW{frame ? ' (live)' : ''}</span>
              {d.meta.faa?.error && <span style={{ color: '#f59e0b' }}>FAA read failed — badges may be missing</span>}
              {faaNow.map((a) => (
                <button key={a.icao} onClick={() => pick(a.icao)} title={a.faa.map((x) => `${x.title}${x.detail ? ' — ' + x.detail : ''}`).join('\n')}>
                  <FaaPill a={a} /> {a.iata ?? a.icao}{a.faa.length > 1 ? ` +${a.faa.slice(1).map((x) => x.label).join('+')}` : ''}
                  <span style={{ color: a.misery != null ? bandOf(a.misery).color : '#64748b' }}> {a.misery != null ? Math.round(a.misery) : '—'}</span>
                </button>
              ))}
            </div>
          )}
          <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#94a3b8', padding: '6px 10px 2px', display: 'flex' }}>
            <span>{mode === 'flights' ? 'LATE OR CANCELLED ±1 H' : 'RANKED'} · {regionLabel}</span>
            <span style={{ marginLeft: 'auto', color: byBand.severe.length ? BANDS[0].color : byBand.miserable.length ? BANDS[1].color : '#22c55e' }}>
              {mode === 'flights' ? `${flightsRanked.length} airports with a board` : frame ? 'replay' : byBand.severe.length ? `${byBand.severe.length} severe` : byBand.miserable.length ? `${byBand.miserable.length} miserable` : 'nothing above slow'}
            </span>
          </div>
          <div className="misd-list">
            {mode === 'flights' ? (flightsRanked.length === 0
              ? <div style={{ padding: 12, fontSize: 12, color: '#64748b' }}>No airport board in the last 3 h. Boards cover the 30 busiest US airports every 2 h, hourly under an FAA programme.</div>
              : flightsRanked.slice(0, 80).map((a) => <FlightsRow key={a.icao} a={a} now={now} onPick={pick} />))
            : ranked.length === 0
              ? <div style={{ padding: 12, fontSize: 12, color: '#64748b' }}>No airport scored in this {frame ? 'frame' : 'read'}.</div>
              : ranked.slice(0, 80).map((a) => <BarRow key={a.icao} a={a} f={cellOf(a)} now={now} onPick={pick} />)}
          </div>
        </div>
      </div>

      <div className="misd-lower">
        {BANDS.slice(0, 3).map((b) => <Column key={b.band} band={b} items={byBand[b.band]} onPick={pick} />)}
        <div className="misd-col" style={{ borderRight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #334155', padding: '6px 10px', fontFamily: MONO, fontWeight: 700, fontSize: 12, color: '#94a3b8', letterSpacing: '0.08em' }}>
            <span>24 H · COVERAGE · METHOD</span><span>{series.length} sweeps · world</span>
          </div>
          <div className="misd-clip" style={{ overflow: 'auto' }}>
            <Trend series={series} now={now} mark={replayAt} />
            <div style={{ padding: '4px 10px 10px', fontSize: 11, color: '#cbd5e1', lineHeight: 1.45 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, color: '#94a3b8', letterSpacing: '0.08em', marginBottom: 2 }}>NOT SCORED · {airports.length - scoredAll.length} of {airports.length} worldwide</div>
              {reasons.map(([k, n]) => <div key={k} style={{ display: 'flex' }}><span>{REASON[k] ?? k}</span><span style={{ marginLeft: 'auto', fontFamily: MONO, color: '#94a3b8' }}>{n}</span></div>)}
              <div style={{ fontFamily: MONO, fontSize: 10, color: '#94a3b8', letterSpacing: '0.08em', margin: '8px 0 2px' }}>BASELINE</div>
              <div>{Object.entries(maturity).filter(([k]) => k !== 'null').map(([k, n]) => `${n} ${k}`).join(' · ') || 'no baselines yet'}{maturity.null ? ` · ${maturity.null} without` : ''} — &quot;vs normal&quot; compares to the same local weekday; a warming baseline is said so.</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: '#94a3b8', letterSpacing: '0.08em', margin: '8px 0 2px' }}>METHOD · {d.meta?.rule?.id ?? 'airport_misery'} {d.meta?.rule?.version ?? ''}</div>
              <div>45 × min(1, median delay / 60 min) + 30 × min(1, delay index / 4) + 25 × min(1, cancelled % / 20), departures and arrivals blended by flights with statistics; needs 5 such flights. v2 scales that by traffic: × min(1, flights / 20), so five late red-eyes earn a quarter of the score. The ring shows that score: dark red = the cancellation points, red = the delay points, green = the rest. FlightAware&apos;s MiseryMap counts flights on-time / delayed / cancelled; our feed gives a median and a 0–5 index per 2 h window, not a count of delayed flights, so this is our own index, not theirs.</div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    host,
  )
}

const CSS = `
.misd-root{position:fixed;inset:0;z-index:2147483000;background:#060b16;color:#e2e8f0;display:flex;flex-direction:column;font-family:Inter,system-ui,sans-serif}
.misd-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:8px 14px;border-bottom:1px solid #1e293b;background:#0b1220}
.misd-seg{display:inline-flex;border:1px solid #1e293b;border-radius:4px;overflow:hidden}
.misd-seg button{all:unset;cursor:pointer;padding:3px 10px;font:700 11px ${MONO};color:#94a3b8;letter-spacing:.08em}
.misd-seg button[aria-pressed="true"]{background:#13203a;color:#f1f5f9}
.misd-upper{flex:0 0 56%;display:flex;min-height:0;border-bottom:1px solid #1e293b}
.misd-map{position:relative;flex:1 1 62%;min-width:0}
.misd-airports{flex:0 0 38%;max-width:34rem;display:flex;flex-direction:column;min-height:0;border-left:1px solid #1e293b;background:#0b1220}
.misd-totals{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;padding:10px 12px 4px;border-bottom:1px solid #1e293b}
.misd-totals>div{display:flex;flex-direction:column}
.misd-totals b{font:800 26px/1 ${MONO};color:#f1f5f9}
.misd-totals b small{font-size:12px;color:#64748b;font-weight:700}
.misd-totals span{font:700 9px ${MONO};letter-spacing:.14em;color:#64748b;margin-top:3px}
.misd-list{flex:1;overflow:auto;padding:4px 6px 10px}
.misd-bar{all:unset;cursor:pointer;display:grid;grid-template-columns:auto 1fr 28px;grid-template-rows:auto auto;column-gap:8px;align-items:center;box-sizing:border-box;width:100%;padding:4px 6px;border-radius:3px}
.misd-bar:hover{background:#13203a}
.misd-track{position:relative;height:12px;background:#111c30;border-radius:2px;overflow:hidden;display:block}
.misd-track span{position:absolute;left:0;top:0;bottom:0;display:block}
.misd-barsub{grid-column:2/4;font:10px ${MONO};color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.misd-faa{position:absolute;top:-7px;right:-10px;font:800 8.5px/1 'IBM Plex Mono',monospace;padding:2px 3px;border-radius:3px;box-shadow:0 0 0 1px #0b1220;pointer-events:none;letter-spacing:.04em}
.misd-pill{display:inline-block;font:800 9px/1 'IBM Plex Mono',monospace;padding:2px 4px;border-radius:3px;margin-right:6px;flex:none;letter-spacing:.04em}
.misd-faastrip{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 10px;border-bottom:1px solid #1e293b;font-family:'IBM Plex Mono',monospace;font-size:11px;color:#e2e8f0}
.misd-faastrip button{background:#0f172a;border:1px solid #1e293b;border-radius:3px;color:#e2e8f0;font:inherit;padding:2px 6px;cursor:pointer;display:inline-flex;align-items:center}
.misd-faastrip button .misd-pill{margin-right:4px}
.misd-legend{position:absolute;left:10px;bottom:46px;z-index:500;background:rgba(6,11,22,.85);border:1px solid #1e293b;border-radius:4px;padding:6px 8px;font-family:${MONO};font-size:10px;color:#cbd5e1;max-width:34rem}
.misd-legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin:0 4px;vertical-align:-1px}
.misd-sw{display:inline-block;width:9px;height:9px;border-radius:50%;border:2.5px solid;margin-right:6px;vertical-align:-1px;box-sizing:border-box}
.misd-replay{position:absolute;left:10px;right:10px;bottom:10px;z-index:500;display:flex;align-items:center;gap:8px;background:rgba(6,11,22,.85);border:1px solid #1e293b;border-radius:4px;padding:4px 8px}
.misd-replay button{all:unset;cursor:pointer;font:700 11px ${MONO};color:#e2e8f0;background:#13203a;border:1px solid #1e293b;border-radius:3px;padding:2px 8px;letter-spacing:.06em}
.misd-replay button[aria-pressed="true"]{color:#38bdf8;border-color:#38bdf8}
.misd-replay input[type=range]{flex:1;accent-color:#38bdf8;min-width:80px}
.misd-ring{background:transparent;border:0}
.misd-ring svg{display:block;filter:drop-shadow(0 0 2px rgba(0,0,0,.8))}
.misd-lower{flex:1;display:grid;grid-template-columns:repeat(4,1fr);min-height:0}
.misd-col{display:flex;flex-direction:column;min-height:0;border-right:1px solid #1e293b}
.misd-clip{flex:1;overflow:hidden;min-height:0}
.misd-scroller{animation:misdScroll linear infinite}
.misd-col:hover .misd-scroller{animation-play-state:paused}
@keyframes misdScroll{from{transform:translateY(0)}to{transform:translateY(calc(-1 * var(--h)))}}
.misd-row{all:unset;cursor:pointer;display:block;box-sizing:border-box;width:100%;padding:7px 10px;border-bottom:1px solid #111c30}
.misd-row:hover{background:#0f1a2e}
.misd-tip{background:rgba(6,11,22,.8)!important;border:0!important;color:#e2e8f0!important;font:700 10px ${MONO}!important;box-shadow:none!important;padding:0 3px!important}
.misd-tip:before{display:none}
.leaflet-popup-content-wrapper,.leaflet-popup-tip{background:#0f172a;color:#e2e8f0;font:12px/1.4 Inter,system-ui,sans-serif}
.leaflet-popup-content div{margin-top:3px}
@media (max-width:900px){
  .misd-root{overflow-y:auto}
  .misd-root>*{flex:none}
  .misd-upper{flex:none;flex-direction:column}
  .misd-map{height:60vh;flex:none}
  .misd-airports{max-width:none;border-left:0;border-top:1px solid #1e293b}
  .misd-list{overflow:visible}
  .misd-legend{display:none}
  .misd-lower{grid-template-columns:1fr}
  .misd-clip{height:18rem;flex:none}
}
`
