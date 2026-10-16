'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import 'leaflet/dist/leaflet.css'
import type { Map as LMap, LayerGroup, Marker } from 'leaflet'
import type { MiseryAirport, MiseryGlobalRow, MiseryPayload } from '@/lib/misery'

/**
 * TRAVEL MISERY INDEX — the flat-map read-out of the 15-minute airport sweep (api-083, 2026-10-16;
 * Ted: "a nice misery map view similar to the NWS dashboard"). Same shell as NwsDashboard.
 *
 *   ┌ header: global score · band counts · scored/total · movements · cancelled · trend · sweep age ──┐
 *   │ MAP — every registry airport as a square:        │ WORST AIRPORTS — misery ≥ 20, worst first,  │
 *   │ size = flights in the 2 h window, colour = band  │ click a card to fly to it                   │
 *   ├──────────────────────────────────────────────────┴────────────────────────────────────────────┤
 *   │ SEVERE │ MISERABLE │ SLOW — auto-scrolling, hover to pause │ 24 H · COVERAGE · METHOD           │
 *   └───────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Honesty: an unscored airport is drawn dark grey at its real size with its reason, never calm;
 * a military field is violet with a cross; the global score is flight-weighted and shown with
 * scored/total. Band colours are the data marks the globe uses (wg-misery.js), not chrome (hub-041).
 */

const BANDS = [
  { band: 'severe', from: 60, color: '#ef4444', note: '≥ 60 — ground stop, mass cancellations or hours-long medians' },
  { band: 'miserable', from: 40, color: '#f97316', note: '40 – 60' },
  { band: 'slow', from: 20, color: '#eab308', note: '20 – 40' },
  { band: 'calm', from: 0, color: '#18BC9C', note: '< 20' },
] as const
type Band = (typeof BANDS)[number]
const C_UNSCORED = '#475569', C_MILITARY = '#a78bfa'
const MONO = "'IBM Plex Mono', ui-monospace, monospace"
const WORLD: [[number, number], [number, number]] = [[-50, -170], [72, 180]]
const REASON: Record<string, string> = {
  insufficient_qualified: 'fewer than 5 flights with statistics',
  no_statistics: 'feed gave no delay statistics',
  no_commercial_data: 'military field — no commercial data',
  absent_from_feed: 'not in the vendor sweep',
  no_traffic_in_window: 'no scheduled traffic in the 2 h window',
  never_observed: 'never observed',
  no_traffic: 'no traffic',
}

const bandOf = (m: number): Band => BANDS.find((b) => m >= b.from) ?? BANDS[3]
const dotPx = (mov: number | null) => Math.max(6, Math.min(22, Math.round(4 + Math.sqrt(mov || 0))))
const parse = (v: string | null) => (v ? Date.parse(v) : NaN)
function ago(v: string | null, now: number | null): string {
  const t = parse(v)
  if (Number.isNaN(t)) return '—'
  if (now === null) return new Date(t).toISOString().slice(11, 16) + 'Z'
  const m = Math.max(0, Math.round((now - t) / 60e3))
  return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`
}
const mins = (m: number | null) => (m == null ? '—' : m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} m` : `${Math.round(m)} min`)
const signed = (v: number) => (v > 0 ? '+' : '') + v.toFixed(1)
const num = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString())
const place = (a: MiseryAirport) => [a.city, a.country].filter(Boolean).join(', ')
const reasonText = (a: MiseryAirport) => REASON[a.misery_reason ?? ''] ?? a.misery_reason ?? 'not scored'

/** Leaflet treats string content as HTML; API strings always go in as text nodes. */
function textEl(t: string): HTMLElement { const e = document.createElement('span'); e.textContent = t; return e }

function popup(a: MiseryAirport, now: number | null): HTMLElement {
  const box = document.createElement('div')
  const head = document.createElement('b'); head.textContent = `${a.iata ?? a.icao} · ${a.name}`; box.appendChild(head)
  const lines: string[] = [place(a)]
  if (a.military) lines.push('Military airbase — no commercial data by construction')
  else if (a.misery != null) {
    const b = bandOf(a.misery)
    lines.push(`Misery ${Math.round(a.misery)} — ${b.band}${a.vs_normal != null ? ` · ${signed(a.vs_normal)} vs normal (${a.baseline_maturity ?? 'baseline'})` : ''}`)
    lines.push(`${num(a.movements)} flights in window · ${num(a.cancelled)} cancelled · median delay ${mins(a.median_delay_min)} · index ${a.delay_index != null ? a.delay_index.toFixed(1) : '—'}/5`)
  } else lines.push(`Not scored — ${reasonText(a)}${a.movements ? ` · ${num(a.movements)} flights in window` : ''}`)
  lines.push(`Sweep ${ago(a.observed_at, now)}${a.icao ? ` · ${a.icao}` : ''}`)
  for (const t of lines) { const d = document.createElement('div'); d.textContent = t; box.appendChild(d) }
  return box
}

// ── Map ────────────────────────────────────────────────────────────────────

function MiseryMap({ airports, focus, now }: { airports: MiseryAirport[]; focus: { icao: string; n: number } | null; now: number | null }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<LMap | null>(null)
  const pins = useRef<LayerGroup | null>(null)
  const markers = useRef(new Map<string, Marker>())
  const nowRef = useRef(now); nowRef.current = now

  useEffect(() => {
    let dead = false
    import('leaflet').then((L) => {
      if (dead || !el.current || map.current) return
      const m = L.map(el.current, { zoomControl: true, attributionControl: true, worldCopyJump: true, minZoom: 2, maxZoom: 10 })
      const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas'
      L.tileLayer(`${ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, { attribution: 'Esri, HERE, Garmin, © OpenStreetMap · airport sweep © AeroDataBox', maxZoom: 12 }).addTo(m)
      L.tileLayer(`${ESRI}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 12, pane: 'overlayPane' }).addTo(m)
      pins.current = L.layerGroup().addTo(m)
      m.fitBounds(WORLD, { padding: [4, 4] })
      map.current = m
      draw(L)
    })
    return () => { dead = true; map.current?.remove(); map.current = null }
  }, [])

  function draw(L: typeof import('leaflet')) {
    if (!pins.current) return
    pins.current.clearLayers()
    markers.current.clear()
    // Worst on top: unscored, then calm → severe.
    const order = (a: MiseryAirport) => (a.military ? -2 : a.misery == null ? -1 : a.misery)
    const list = airports.filter((a) => a.lat != null && a.lon != null).slice().sort((x, y) => order(x) - order(y))
    for (const a of list) {
      const px = a.military ? 9 : dotPx(a.movements)
      const fill = a.military ? C_MILITARY : a.misery == null ? '#1e293b' : bandOf(a.misery).color
      const edge = a.military ? '#0f172a' : a.misery == null ? C_UNSCORED : '#0f172a'
      // The icon markup is built from numbers and fixed colours only — no API string reaches it.
      const html = a.military
        ? `<i style="display:block;width:${px}px;height:${px}px;background:${fill};border:1px solid ${edge};border-radius:2px;box-sizing:border-box;color:#fff;font:700 8px/7px monospace;text-align:center">+</i>`
        : `<i style="display:block;width:${px}px;height:${px}px;background:${fill};border:1px solid ${edge};border-radius:2px;box-sizing:border-box"></i>`
      const mk = L.marker([a.lat, a.lon], { icon: L.divIcon({ className: 'misd-sq', html, iconSize: [px, px], iconAnchor: [px / 2, px / 2] }), zIndexOffset: Math.round(order(a) * 10) })
      const code = a.iata ?? a.icao
      if (a.misery != null && a.misery >= 40) mk.bindTooltip(textEl(`${code} ${Math.round(a.misery)}`), { permanent: true, direction: 'right', offset: [px / 2 + 2, 0], className: 'misd-tip', opacity: 1 })
      else mk.bindTooltip(textEl(code), { direction: 'right', offset: [px / 2 + 2, 0], className: 'misd-tip', opacity: 1 })
      mk.bindPopup(() => popup(a, nowRef.current))
      mk.addTo(pins.current)
      markers.current.set(a.icao, mk)
    }
  }

  useEffect(() => { import('leaflet').then((L) => draw(L)) }, [airports])

  useEffect(() => {
    if (!focus || !map.current) return
    const mk = markers.current.get(focus.icao)
    if (mk) { map.current.flyTo(mk.getLatLng(), 7, { duration: 0.8 }); mk.openPopup() }
  }, [focus])

  return <div ref={el} style={{ position: 'absolute', inset: 0, background: '#0b1220' }} />
}

// ── Airport card (worst first) ─────────────────────────────────────────────

function AirportCard({ a, now, onPick }: { a: MiseryAirport; now: number | null; onPick: (icao: string) => void }) {
  const b = bandOf(a.misery ?? 0)
  return (
    <button onClick={() => onPick(a.icao)} className="misd-card" style={{ borderLeft: `4px solid ${b.color}` }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 16, color: '#f1f5f9' }}>{a.iata ?? a.icao}</span>
        <span style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{place(a)}</span>
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 18, fontWeight: 800, color: b.color }}>{Math.round(a.misery ?? 0)}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, fontSize: 11, color: '#cbd5e1', marginTop: 3 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: b.color }}>{b.band.toUpperCase()}</span>
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>
          {num(a.movements)} flights · {num(a.cancelled)} cxl · median {mins(a.median_delay_min)}
        </span>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: '#64748b', marginTop: 2 }}>
        index {a.delay_index != null ? a.delay_index.toFixed(1) : '—'}/5{a.vs_normal != null ? ` · ${signed(a.vs_normal)} vs normal` : ' · no baseline yet'} · {ago(a.observed_at, now)}
      </div>
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

function Trend({ series, now }: { series: MiseryGlobalRow[]; now: number | null }) {
  const pts = series.filter((s) => s.misery != null)
  const W = 300, H = 90, pad = 4
  const x = (i: number) => pad + (pts.length > 1 ? (i / (pts.length - 1)) * (W - 2 * pad) : 0)
  const y = (m: number) => pad + (1 - Math.min(100, m) / 100) * (H - 2 * pad)
  const path = pts.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.misery as number).toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1], first = pts[0]
  const peak = pts.reduce<MiseryGlobalRow | null>((m, s) => (m == null || (s.misery as number) > (m.misery as number) ? s : m), null)
  return (
    <div style={{ padding: '6px 10px' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 90, display: 'block' }} role="img" aria-label="Global travel misery, last 24 hours">
        {BANDS.slice(0, 3).map((b) => <line key={b.band} x1={0} x2={W} y1={y(b.from)} y2={y(b.from)} stroke={b.color} strokeOpacity={0.35} strokeDasharray="3 3" />)}
        {pts.length > 1 && <path d={path} fill="none" stroke="#e2e8f0" strokeWidth={1.5} />}
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

  const airports = d.airports ?? []
  const g = d.global?.now ?? null
  const series = d.global?.series ?? []
  const scored = airports.filter((a) => a.misery != null)
  const byBand = Object.fromEntries(BANDS.map((b) => [b.band, scored.filter((a) => bandOf(a.misery as number).band === b.band).sort((x, y) => (y.misery as number) - (x.misery as number))])) as Record<string, MiseryAirport[]>
  const worst = scored.filter((a) => (a.misery as number) >= 20).sort((x, y) => (y.misery as number) - (x.misery as number) || (y.movements ?? 0) - (x.movements ?? 0))
  const gb = g && g.misery != null ? bandOf(g.misery) : null
  const prev = series.length > 4 ? series[series.length - 5] : null   // ~1 h earlier at 15-min sweeps
  const trend = g && g.misery != null && prev && prev.misery != null ? signed(g.misery - prev.misery) : null
  const reasons = Object.entries(d.meta?.unscored_by_reason ?? {}).sort((x, y) => y[1] - x[1])
  const maturity = d.meta?.baseline_maturity ?? {}

  // Portal to <body>: the site layout wraps pages in a containing block that traps position:fixed.
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  if (!host) return <div style={{ minHeight: '100vh', background: '#060b16' }} />
  return createPortal(
    <div className="misd-root">
      <style>{CSS}</style>
      <header className="misd-head">
        <a href={backHref} style={{ color: '#38bdf8', textDecoration: 'none', fontFamily: MONO, fontSize: 11 }}>← Travel Risk</a>
        <span style={{ fontFamily: MONO, fontWeight: 800, letterSpacing: '0.14em', fontSize: 14, color: '#f1f5f9' }}>TRAVEL MISERY INDEX</span>
        {g && g.misery != null && gb ? (
          <span title="Flight-weighted mean misery of every scored airport in the newest 15-minute sweep" style={{ fontFamily: MONO, fontWeight: 800, fontSize: 18, color: gb.color, border: `1px solid ${gb.color}66`, background: `${gb.color}1a`, borderRadius: 4, padding: '0 10px', lineHeight: '26px' }}>
            {Math.round(g.misery)} <span style={{ fontSize: 11, fontWeight: 700 }}>{gb.band.toUpperCase()}</span>
            {trend && <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginLeft: 8 }}>{trend} / 1 h</span>}
          </span>
        ) : <span style={{ fontFamily: MONO, fontSize: 11, color: '#94a3b8' }}>no scored sweep in the last 24 h</span>}
        <span style={{ display: 'flex', gap: 6 }}>
          {BANDS.map((b) => (
            <span key={b.band} title={b.note} style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: b.color, border: `1px solid ${b.color}55`, background: `${b.color}18`, borderRadius: 3, padding: '1px 6px' }}>
              {b.band} {byBand[b.band].length}
            </span>
          ))}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: '#94a3b8' }} title="scored airports / registry · scheduled flights in the 2 h window · cancellations in window">
          {scored.length}/{airports.length} scored · {num(g?.movements)} flights · {num(g?.cancelled)} cxl
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
          <MiseryMap airports={airports} focus={focus} now={now} />
          <div className="misd-legend">
            {BANDS.map((b) => <div key={b.band} title={b.note}><span style={{ background: b.color }} />{b.band} {b.band === 'calm' ? '< 20' : b.band === 'severe' ? '≥ 60' : b.band === 'miserable' ? '40–60' : '20–40'}</div>)}
            <div title="statistics withheld, absent from the sweep or no traffic in the window"><span style={{ background: '#1e293b', border: `1px solid ${C_UNSCORED}` }} />not scored</div>
            <div title="no commercial data by construction"><span style={{ background: C_MILITARY }} />military airbase</div>
            <div style={{ color: '#64748b', marginTop: 2 }}>square size = flights in the 2 h window · click a square</div>
          </div>
        </div>
        <div className="misd-airports">
          <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#94a3b8', padding: '8px 10px 4px', display: 'flex' }}>
            <span>WORST AIRPORTS · MISERY ≥ 20</span>
            <span style={{ marginLeft: 'auto', color: byBand.severe.length ? BANDS[0].color : byBand.miserable.length ? BANDS[1].color : '#22c55e' }}>
              {byBand.severe.length ? `${byBand.severe.length} severe` : byBand.miserable.length ? `${byBand.miserable.length} miserable` : 'nothing above slow'}
            </span>
          </div>
          <div className="misd-grid">
            {worst.length === 0
              ? <div style={{ padding: 12, fontSize: 12, color: '#64748b' }}>{scored.length ? 'Every scored airport is calm.' : 'No airport scored on this read.'}</div>
              : worst.slice(0, 40).map((a) => <AirportCard key={a.icao} a={a} now={now} onPick={pick} />)}
          </div>
        </div>
      </div>

      <div className="misd-lower">
        {BANDS.slice(0, 3).map((b) => <Column key={b.band} band={b} items={byBand[b.band]} onPick={pick} />)}
        <div className="misd-col" style={{ borderRight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #334155', padding: '6px 10px', fontFamily: MONO, fontWeight: 700, fontSize: 12, color: '#94a3b8', letterSpacing: '0.08em' }}>
            <span>24 H · COVERAGE · METHOD</span><span>{series.length} sweeps</span>
          </div>
          <div className="misd-clip" style={{ overflow: 'auto' }}>
            <Trend series={series} now={now} />
            <div style={{ padding: '4px 10px 10px', fontSize: 11, color: '#cbd5e1', lineHeight: 1.45 }}>
              <div style={{ fontFamily: MONO, fontSize: 10, color: '#94a3b8', letterSpacing: '0.08em', marginBottom: 2 }}>NOT SCORED · {airports.length - scored.length} of {airports.length}</div>
              {reasons.map(([k, n]) => <div key={k} style={{ display: 'flex' }}><span>{REASON[k] ?? k}</span><span style={{ marginLeft: 'auto', fontFamily: MONO, color: '#94a3b8' }}>{n}</span></div>)}
              <div style={{ fontFamily: MONO, fontSize: 10, color: '#94a3b8', letterSpacing: '0.08em', margin: '8px 0 2px' }}>BASELINE</div>
              <div>{Object.entries(maturity).filter(([k]) => k !== 'null').map(([k, n]) => `${n} ${k}`).join(' · ') || 'no baselines yet'}{maturity.null ? ` · ${maturity.null} without` : ''} — "vs normal" compares to the same local weekday; a warming baseline is said so.</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: '#94a3b8', letterSpacing: '0.08em', margin: '8px 0 2px' }}>METHOD · {d.meta?.rule?.id ?? 'airport_misery'} {d.meta?.rule?.version ?? ''}</div>
              <div>45 × min(1, median delay / 60 min) + 30 × min(1, delay index / 4) + 25 × min(1, cancelled % / 20), departures and arrivals blended by flights with statistics. Needs 5 such flights. The feed gives a median and a 0–5 index per 2 h window, not a count of delayed flights. Our own index from the 15-minute AeroDataBox sweep — not FlightAware&apos;s.</div>
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
.misd-upper{flex:0 0 52%;display:flex;min-height:0;border-bottom:1px solid #1e293b}
.misd-map{position:relative;flex:1 1 60%;min-width:0}
.misd-airports{flex:0 0 40%;max-width:34rem;display:flex;flex-direction:column;min-height:0;border-left:1px solid #1e293b;background:#0b1220}
.misd-grid{flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(13rem,1fr));gap:6px;padding:6px 10px 10px;align-content:start}
.misd-card{all:unset;cursor:pointer;display:block;padding:7px 9px;background:#0f172a;border:1px solid #1e293b;border-radius:4px}
.misd-card:hover{background:#13203a}
.misd-legend{position:absolute;left:10px;bottom:22px;z-index:500;background:rgba(6,11,22,.85);border:1px solid #1e293b;border-radius:4px;padding:6px 8px;font-family:${MONO};font-size:10px;color:#cbd5e1}
.misd-legend span{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:6px;vertical-align:-1px;box-sizing:border-box}
.misd-sq{background:transparent;border:0}
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
  .misd-map{height:55vh;flex:none}
  .misd-airports{max-width:none;border-left:0;border-top:1px solid #1e293b}
  .misd-grid{overflow:visible}
  .misd-lower{grid-template-columns:1fr}
  .misd-clip{height:18rem;flex:none}
}
`
