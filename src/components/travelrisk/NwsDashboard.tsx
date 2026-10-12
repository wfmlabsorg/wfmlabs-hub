'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import 'leaflet/dist/leaflet.css'
import type { Map as LMap, LayerGroup, TileLayer } from 'leaflet'
import type { AirportStatus, AviationImpact, NwsAlert, NwsPanel, RegionChip } from '@/lib/travelrisk/panels'

/**
 * NWS ACTIVE WARNINGS — the tier-2 weather window (rebuilt from ovix6's NWSWarningsPanel, 2026-10-12).
 *
 *   ┌ header: severity pills · OVIX weather score · the floor rule in force ────────────────┐
 *   │ MAP — official NWS warning polygons (NOAA WWA)     │ TOP 15 US AIRPORTS — impact     │
 *   │ + the 15 airports coloured by traffic impact       │ cards, worst first               │
 *   ├────────────────────────────────────────────────────┴──────────────────────────────────┤
 *   │ EXTREME │ SEVERE │ MODERATE │ MINOR — auto-scrolling, hover to pause, click for NWS   │
 *   └───────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ovix6's "Your Sites" (call centres) became airports: the people this serves travel. Severity is the
 * issuer's word. No orange on our chrome (hub-041); the shaded polygons are NOAA's own hazard colours.
 */

const SEV = ['Extreme', 'Severe', 'Moderate', 'Minor'] as const
const SEV_COLOR: Record<string, string> = { Extreme: '#ff1744', Severe: '#eab308', Moderate: '#38bdf8', Minor: '#94a3b8' }
const IMPACT: Record<AviationImpact, { color: string; label: string; note: string }> = {
  disrupt: { color: '#ff1744', label: 'DISRUPTION LIKELY', note: 'ground stops / mass cancellations likely' },
  delay: { color: '#eab308', label: 'DELAYS LIKELY', note: 'programmes, de-icing or low-visibility ops' },
  advisory: { color: '#38bdf8', label: 'ADVISORY', note: 'in force at the field, little traffic effect' },
  clear: { color: '#22c55e', label: 'CLEAR', note: 'no NWS product at the field' },
}
const MONO = "'IBM Plex Mono', ui-monospace, monospace"
const WMS = 'https://mapservices.weather.noaa.gov/eventdriven/services/WWA/watch_warn_adv/MapServer/WMSServer'
const CONUS: [[number, number], [number, number]] = [[24.5, -125], [49.5, -66.5]]

const parse = (v: string | null) => (v ? Date.parse(v.includes('T') ? v : v.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')) : NaN)
function left(v: string | null, now: number | null): string {
  const t = parse(v)
  if (Number.isNaN(t)) return ''
  if (now === null) return new Date(t).toISOString().slice(5, 16).replace('T', ' ') + 'Z'
  const d = t - now
  if (d <= 0) return 'ending'
  const h = Math.floor(d / 3600e3), m = Math.floor((d % 3600e3) / 60e3)
  return h > 24 ? `${Math.floor(h / 24)}d ${h % 24}h left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`
}

const REGION_HUE = '#22d3ee'
function chipText(r: RegionChip): string {
  const w = r.weather && r.weather.available ? `${r.weather.score.toFixed(1)} ${r.weather.level}` : 'no reading'
  return `${r.name} · OVIX weather ${w}${r.weather?.floored ? ' (official floor)' : ''} · NWS ${r.nws.extreme} extreme, ${r.nws.severe} severe`
}

function RegionStrip({ regions, current }: { regions: RegionChip[]; current: string }) {
  if (!regions.length) return null
  return (
    <nav className="nwsd-strip" aria-label="Regions">
      {regions.map((r) => {
        const on = r.id === current
        const w = r.weather && r.weather.available ? r.weather.score : null
        return (
          <a key={r.id} href={`/travelrisk/region/${r.id}/nws`} title={chipText(r)} className="nwsd-chip"
            style={{ borderColor: on ? '#e2e8f0' : '#1e293b', background: on ? '#13203a' : '#0b1220' }}>
            <span style={{ fontWeight: 800, color: on ? '#f1f5f9' : '#cbd5e1' }}>{r.id === 'global' ? 'NATIONAL' : r.short}</span>
            <span style={{ color: REGION_HUE, fontWeight: 700 }}>{w == null ? '—' : w.toFixed(1)}</span>
            {r.weather?.floored && <span title="OVIX weather held up by official NWS warnings" style={{ color: '#eab308' }}>▲</span>}
            <span style={{ color: r.nws.extreme ? SEV_COLOR.Extreme : r.nws.severe ? SEV_COLOR.Severe : '#475569' }}>
              {r.nws.extreme ? `E${r.nws.extreme} ` : ''}{r.nws.severe ? `S${r.nws.severe}` : r.nws.extreme ? '' : 'quiet'}
            </span>
          </a>
        )
      })}
      <span style={{ marginLeft: 'auto', color: '#475569' }}>OVIX weather by region · ▲ official floor · E/S = NWS extreme/severe</span>
    </nav>
  )
}

/** Leaflet treats string content as HTML; API strings always go in as text nodes. */
function textEl(t: string): HTMLElement { const e = document.createElement('span'); e.textContent = t; return e }

/** Popup built from DOM text nodes — API strings never become markup. */
function popup(a: AirportStatus): HTMLElement {
  const box = document.createElement('div')
  const head = document.createElement('b')
  head.textContent = `${a.iata} · ${a.city}`
  box.appendChild(head)
  const lines = !a.reachable ? ['NWS did not answer for this point'] : a.alerts.length ? a.alerts.map((x) => x.event) : ['No NWS product at the field']
  for (const t of lines) { const d = document.createElement('div'); d.textContent = t; box.appendChild(d) }
  return box
}

// ── Map ────────────────────────────────────────────────────────────────────

function WarningsMap({ airports, bbox, focus, regions, current }: {
  airports: AirportStatus[]; bbox: NwsPanel['node']['bbox']; focus: { iata: string; n: number } | null
  regions: RegionChip[]; current: string
}) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<LMap | null>(null)
  const pins = useRef<LayerGroup | null>(null)
  const boxes = useRef<LayerGroup | null>(null)
  const wms = useRef<TileLayer.WMS | null>(null)
  const markers = useRef(new Map<string, import('leaflet').CircleMarker>())

  useEffect(() => {
    let dead = false
    import('leaflet').then((L) => {
      if (dead || !el.current || map.current) return
      const m = L.map(el.current, { zoomControl: true, attributionControl: true, worldCopyJump: false })
      // Keyless basemap (CARTO now wants a key): Esri dark-gray canvas, warnings, then Esri's labels on top.
      const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas'
      L.tileLayer(`${ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {
        attribution: 'Esri, HERE, Garmin, © OpenStreetMap · warnings © NOAA/NWS', maxZoom: 12,
      }).addTo(m)
      wms.current = L.tileLayer.wms(WMS, { layers: '0', format: 'image/png', transparent: true, opacity: 0.62, version: '1.3.0' } as L.WMSOptions).addTo(m)
      L.tileLayer(`${ESRI}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, { maxZoom: 12, pane: 'overlayPane' }).addTo(m)
      boxes.current = L.layerGroup().addTo(m)
      pins.current = L.layerGroup().addTo(m)
      const b = bbox ?? null
      m.fitBounds(b ? [[b[0], b[1]], [b[2], b[3]]] : CONUS, { padding: [8, 8] })
      map.current = m
      draw(L)
    })
    return () => { dead = true; map.current?.remove(); map.current = null }
  }, [])

  function draw(L: typeof import('leaflet')) {
    if (!pins.current) return
    // OVIX US regions: outline + label, fill in one hue by the region's OVIX weather (magnitude, not alarm).
    boxes.current?.clearLayers()
    for (const r of regions) {
      if (!r.bbox) continue
      const w = r.weather && r.weather.available ? r.weather.score : null
      const on = r.id === current
      const rect = L.rectangle([[r.bbox[0], r.bbox[1]], [r.bbox[2], r.bbox[3]]], {
        color: on ? '#e2e8f0' : REGION_HUE, weight: on ? 2 : 1, dashArray: on ? undefined : '4 4', opacity: on ? 0.9 : 0.55,
        fillColor: REGION_HUE, fillOpacity: w == null ? 0 : 0.03 + (w / 10) * 0.16, interactive: true,
      })
      rect.bindTooltip(textEl(chipText(r)), { sticky: true, className: 'nwsd-tip' })
      rect.on('click', () => { if (!on) window.location.href = `/travelrisk/region/${r.id}/nws` })
      rect.addTo(boxes.current!)
      L.marker([r.bbox[2], r.bbox[1]], { interactive: false, icon: L.divIcon({ className: 'nwsd-boxlbl', html: '', iconSize: [0, 0] }) })
        .bindTooltip(textEl(`${r.short} ${w == null ? '—' : w.toFixed(1)}${r.weather?.floored ? ' ▲' : ''}`), { permanent: true, direction: 'bottom', offset: [18, 4], className: 'nwsd-tip nwsd-boxtip' })
        .addTo(boxes.current!)
    }
    pins.current.clearLayers()
    markers.current.clear()
    for (const a of airports) {
      const c = IMPACT[a.reachable ? a.impact : 'clear'].color
      const mk = L.circleMarker([a.lat, a.lon], { radius: a.impact === 'clear' ? 6 : 9, color: '#0b1220', weight: 2, fillColor: a.reachable ? c : '#64748b', fillOpacity: 0.95 })
        .bindTooltip(textEl(a.iata), { permanent: true, direction: 'right', className: 'nwsd-tip', offset: [8, 0] })
        .bindPopup(() => popup(a))
      mk.addTo(pins.current)
      markers.current.set(a.iata, mk)
    }
  }

  // Refresh pins + polygons when the server sends a new reading.
  useEffect(() => {
    import('leaflet').then((L) => { draw(L); wms.current?.setParams({ t: Date.now() } as never) })
  }, [airports, regions])

  useEffect(() => {
    if (!focus || !map.current) return
    const mk = markers.current.get(focus.iata)
    if (mk) { map.current.flyTo(mk.getLatLng(), 8, { duration: 0.8 }); mk.openPopup() }
  }, [focus])

  return <div ref={el} style={{ position: 'absolute', inset: 0, background: '#0b1220' }} />
}

// ── Auto-scrolling severity column ─────────────────────────────────────────

function Column({ sev, items, now }: { sev: string; items: NwsAlert[]; now: number | null }) {
  const clip = useRef<HTMLDivElement>(null)
  const set = useRef<HTMLDivElement>(null)
  const [h, setH] = useState(0)
  useLayoutEffect(() => {
    const ch = set.current?.scrollHeight ?? 0, cl = clip.current?.clientHeight ?? 0
    setH(ch > cl + 4 ? ch : 0)
  }, [items])
  const c = SEV_COLOR[sev]
  const list = (k: string) => (
    <div ref={k === 'a' ? set : undefined} key={k}>
      {items.map((a, i) => (
        <a key={k + i} href={a.url ?? undefined} target="_blank" rel="noopener" className="nwsd-alert">
          <div style={{ color: c, fontWeight: 700, fontSize: 12 }}>{a.event}</div>
          <div style={{ fontSize: 11, color: '#cbd5e1', lineHeight: 1.35 }}>{a.area.length > 140 ? a.area.slice(0, 137) + '…' : a.area}</div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: '#64748b' }}>{[a.states.join(' '), left(a.expires, now)].filter(Boolean).join(' · ')}</div>
        </a>
      ))}
    </div>
  )
  return (
    <div className="nwsd-col">
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `2px solid ${c}`, padding: '6px 10px', fontFamily: MONO, fontWeight: 700, fontSize: 12, color: c, letterSpacing: '0.08em' }}>
        <span>{sev.toUpperCase()}</span><span>{items.length}</span>
      </div>
      <div ref={clip} className="nwsd-clip">
        {items.length === 0 ? <div style={{ padding: 12, fontSize: 12, color: '#475569' }}>None</div> : (
          <div className={h ? 'nwsd-scroller' : undefined} style={h ? ({ '--h': `${h}px`, animationDuration: `${Math.max(12, h / 22)}s` } as React.CSSProperties) : undefined}>
            {list('a')}{h ? list('b') : null}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Airport card ───────────────────────────────────────────────────────────

function AirportCard({ a, now, onPick }: { a: AirportStatus; now: number | null; onPick: (iata: string) => void }) {
  const imp = IMPACT[a.reachable ? a.impact : 'clear']
  return (
    <button onClick={() => onPick(a.iata)} className="nwsd-card" style={{ borderLeft: `4px solid ${a.reachable ? imp.color : '#475569'}`, outline: a.inNode ? '1px solid rgba(56,189,248,0.35)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontWeight: 800, fontSize: 16, color: '#f1f5f9' }}>{a.iata}</span>
        <span style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.city}, {a.state}</span>
        <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: a.reachable ? imp.color : '#64748b' }}>
          {a.reachable ? imp.label : 'NO ANSWER'}
        </span>
      </div>
      {a.alerts.slice(0, 3).map((x) => (
        <div key={x.event} style={{ fontSize: 11, color: IMPACT[x.impact].color, marginTop: 3, display: 'flex', gap: 6 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.event}</span>
          <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>{left(x.ends, now)}</span>
        </div>
      ))}
      {a.alerts.length > 3 && <div style={{ fontSize: 10, color: '#64748b' }}>+{a.alerts.length - 3} more</div>}
    </button>
  )
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export function NwsDashboard({ d, weather, regionHref }: {
  d: NwsPanel
  weather: { score: number | null; level: string | null } | null
  regionHref: string
}) {
  const [now, setNow] = useState<number | null>(null)
  const [focus, setFocus] = useState<{ iata: string; n: number } | null>(null) // n: re-picking the same card flies again
  const pick = (iata: string) => setFocus((f) => ({ iata, n: (f?.n ?? 0) + 1 }))
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t) }, [])

  const alerts = d.alerts ?? []
  const airports = d.airports ?? []
  const s = d.summary
  const bySev = Object.fromEntries(SEV.map((k) => [k, alerts.filter((a) => a.severityLabel === k)])) as Record<string, NwsAlert[]>
  const hit = airports.filter((a) => a.impact === 'disrupt' || a.impact === 'delay').length

  // Portal to <body>: the site layout wraps pages in a containing block that traps position:fixed, so
  // rendered in place the nav and footer paint over the dashboard. Mounted only on the client.
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])
  if (!host) return <div style={{ minHeight: '100vh', background: '#060b16' }} />
  return createPortal(
    <div className="nwsd-root">
      <style>{CSS}</style>
      <header className="nwsd-head">
        <a href={regionHref} style={{ color: '#38bdf8', textDecoration: 'none', fontFamily: MONO, fontSize: 11 }}>← {d.node.name}</a>
        <span style={{ fontFamily: MONO, fontWeight: 800, letterSpacing: '0.14em', fontSize: 14, color: '#f1f5f9' }}>NWS ACTIVE WARNINGS</span>
        <span style={{ display: 'flex', gap: 6 }}>
          {SEV.map((k) => (
            <span key={k} style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: SEV_COLOR[k], border: `1px solid ${SEV_COLOR[k]}55`, background: `${SEV_COLOR[k]}18`, borderRadius: 3, padding: '1px 6px' }}>
              {k[0]} {bySev[k].length}
            </span>
          ))}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: '#94a3b8' }}>{s?.alerts ?? 0} in force · {s?.reports ?? 0} storm reports 24h</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: '#cbd5e1' }}>
          OVIX weather <b style={{ color: '#f1f5f9' }}>{weather?.score != null ? weather.score.toFixed(1) : '—'}</b> {weather?.level ?? ''}
          {d.floor ? <span style={{ color: '#eab308' }}> · floor ≥{d.floor.floor.toFixed(1)} ({d.floor.rule})</span> : <span style={{ color: '#64748b' }}> · no official floor</span>}
        </span>
        <a href="https://www.weather.gov/" target="_blank" rel="noopener" style={{ marginLeft: 'auto', color: '#38bdf8', fontFamily: MONO, fontSize: 11, textDecoration: 'none' }}>weather.gov ↗</a>
      </header>
      <RegionStrip regions={d.regions ?? []} current={d.node.id} />
      {d.coverage === 'partial' && d.note && <div className="nwsd-note">{d.note}</div>}

      <div className="nwsd-upper">
        <div className="nwsd-map">
          <WarningsMap airports={airports} bbox={d.node.bbox} focus={focus} regions={d.regions ?? []} current={d.node.id} />
          <div className="nwsd-legend">
            {(['disrupt', 'delay', 'advisory', 'clear'] as const).map((k) => (
              <div key={k} title={IMPACT[k].note}><span style={{ background: IMPACT[k].color }} />{IMPACT[k].label.toLowerCase()}</div>
            ))}
            <div style={{ color: '#64748b', marginTop: 2 }}>shading = NWS warnings / watches / advisories</div>
          </div>
        </div>
        <div className="nwsd-airports">
          <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#94a3b8', padding: '8px 10px 4px', display: 'flex' }}>
            <span>TOP 15 US AIRPORTS</span>
            <span style={{ marginLeft: 'auto', color: hit ? '#eab308' : '#22c55e' }}>{hit ? `${hit} impacted` : 'no traffic impact'}</span>
          </div>
          <div className="nwsd-grid">
            {airports.length === 0
              ? <div style={{ padding: 12, fontSize: 12, color: '#64748b' }}>Airport status unavailable on this read.</div>
              : airports.map((a) => <AirportCard key={a.iata} a={a} now={now} onPick={pick} />)}
          </div>
        </div>
      </div>

      <div className="nwsd-lower">
        {SEV.map((k) => <Column key={k} sev={k} items={bySev[k]} now={now} />)}
      </div>
    </div>,
    host,
  )
}

const CSS = `
.nwsd-root{position:fixed;inset:0;z-index:2147483000;background:#060b16;color:#e2e8f0;display:flex;flex-direction:column;font-family:Inter,system-ui,sans-serif}
.nwsd-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:8px 14px;border-bottom:1px solid #1e293b;background:#0b1220}
.nwsd-strip{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:6px 14px;border-bottom:1px solid #1e293b;background:#081020;font-family:${MONO};font-size:11px}
.nwsd-chip{display:inline-flex;gap:7px;align-items:baseline;padding:3px 9px;border:1px solid;border-radius:4px;text-decoration:none}
.nwsd-chip:hover{background:#13203a!important}
.nwsd-boxtip{color:#67e8f9!important}
.nwsd-note{padding:4px 14px;font-size:11px;color:#94a3b8;background:#0b1220;border-bottom:1px solid #1e293b}
.nwsd-upper{flex:0 0 52%;display:flex;min-height:0;border-bottom:1px solid #1e293b}
.nwsd-map{position:relative;flex:1 1 60%;min-width:0}
.nwsd-airports{flex:0 0 40%;max-width:34rem;display:flex;flex-direction:column;min-height:0;border-left:1px solid #1e293b;background:#0b1220}
.nwsd-grid{flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(13rem,1fr));gap:6px;padding:6px 10px 10px;align-content:start}
.nwsd-card{all:unset;cursor:pointer;display:block;padding:7px 9px;background:#0f172a;border:1px solid #1e293b;border-radius:4px}
.nwsd-card:hover{background:#13203a}
.nwsd-legend{position:absolute;left:10px;bottom:22px;z-index:500;background:rgba(6,11,22,.85);border:1px solid #1e293b;border-radius:4px;padding:6px 8px;font-family:${MONO};font-size:10px;color:#cbd5e1}
.nwsd-legend span{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;vertical-align:-1px}
.nwsd-lower{flex:1;display:grid;grid-template-columns:repeat(4,1fr);min-height:0}
.nwsd-col{display:flex;flex-direction:column;min-height:0;border-right:1px solid #1e293b}
.nwsd-clip{flex:1;overflow:hidden;min-height:0}
.nwsd-scroller{animation:nwsdScroll linear infinite}
.nwsd-col:hover .nwsd-scroller{animation-play-state:paused}
@keyframes nwsdScroll{from{transform:translateY(0)}to{transform:translateY(calc(-1 * var(--h)))}}
.nwsd-alert{display:block;padding:7px 10px;border-bottom:1px solid #111c30;text-decoration:none}
.nwsd-alert:hover{background:#0f1a2e}
.nwsd-tip{background:rgba(6,11,22,.8)!important;border:0!important;color:#e2e8f0!important;font:700 10px ${MONO}!important;box-shadow:none!important;padding:0 3px!important}
.nwsd-tip:before{display:none}
@media (max-width:900px){
  .nwsd-root{overflow-y:auto}
  .nwsd-root>*{flex:none}
  .nwsd-upper{flex:none;flex-direction:column}
  .nwsd-map{height:55vh;flex:none}
  .nwsd-airports{max-width:none;border-left:0;border-top:1px solid #1e293b}
  .nwsd-grid{overflow:visible}
  .nwsd-lower{grid-template-columns:1fr}
  .nwsd-clip{height:18rem;flex:none}
}
`
