'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SpaceLevel, SpacePanel, SwpcAlert } from '@/lib/travelrisk/panels'

/**
 * SPACE WEATHER — the tier-2 window (rebuilt from ovix6's Space Weather Command, 2026-10-15).
 *
 *   ┌ header: R/S/G now · Space Wx score · OVIX infrastructure + floor · NWS → · swpc.noaa.gov ↗ ──┐
 *   │ banner: what it means now · sunlit hemisphere · any SWPC product that did not answer (a gap)  │
 *   │ SUN (SUVI 195 Å) · CORONA (LASCO C3) · AURORA (OVATION N) │ X-RAY 6 h │ Kp 24 h               │
 *   │                                                           │ PROTONS   │ SOLAR WIND · FORECAST │
 *   ├────────────────────────────────────────────────────────────┴───────────┴───────────────────────┤
 *   │ AVIATION IMPACT (HF · polar · GNSS · satcom) │ SWPC ALERTS (scrolling) │ OVIX EVENTS 72 h    │
 *   └────────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * Planetary: the same sun for every node. Levels are NOAA's thresholds applied to the live instruments
 * (worker side); NOAA's own "today" scale sits beside them. No orange on our chrome (hub-041).
 */

const MONO = "'IBM Plex Mono', ui-monospace, monospace"
const LEVEL_COLOR = ['#22c55e', '#38bdf8', '#eab308', '#eab308', '#ff1744', '#ff1744']
const LEVEL_WORD = ['none', 'Minor', 'Moderate', 'Strong', 'Severe', 'Extreme']
const BAND_COLOR: Record<SpacePanel['score']['band'], string> = { QUIET: '#22c55e', MINOR: '#38bdf8', ELEVATED: '#eab308', SEVERE: '#ff1744' }
const KIND_COLOR: Record<SwpcAlert['kind'], string> = { alert: '#ff1744', warning: '#eab308', watch: '#38bdf8', summary: '#94a3b8', other: '#64748b' }

const parse = (v: string | null | undefined) => (v ? Date.parse(v.includes('T') ? v : v.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')) : NaN)
const hhmm = (t: number) => (Number.isFinite(t) ? new Date(t).toISOString().slice(11, 16) + 'Z' : '')
function ago(v: string | null | undefined, now: number | null): string {
  const t = parse(v)
  if (Number.isNaN(t)) return ''
  if (now === null) return new Date(t).toISOString().slice(5, 16).replace('T', ' ') + 'Z'
  const m = Math.round((now - t) / 60e3)
  return m < 1 ? 'now' : m < 60 ? `${m}m ago` : m < 48 * 60 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`
}
function left(v: string | null | undefined, now: number | null): string {
  const t = parse(v)
  if (Number.isNaN(t) || now === null) return ''
  const d = t - now
  if (d <= 0) return 'ended'
  const h = Math.floor(d / 3600e3), m = Math.floor((d % 3600e3) / 60e3)
  return h > 24 ? `${Math.floor(h / 24)}d ${h % 24}h left` : h > 0 ? `${h}h ${m}m left` : `${m}m left`
}
const kpColor = (kp: number) => (kp >= 7 ? '#ff1744' : kp >= 5 ? '#eab308' : kp >= 4 ? '#38bdf8' : '#22c55e')

// ── SVG line chart (log or linear), reference lines labelled at the right ──────────────────────────

function Chart({ pts, log, lo, hi, refs, color, unit, h = 120 }: {
  pts: { t: number; v: number | null }[]; log?: boolean; lo: number; hi: number
  refs?: { v: number; label: string; color: string }[]; color: string; unit?: string; h?: number
}) {
  const W = 420, PL = 34, PR = 30, PT = 6, PB = 16
  const y = (v: number) => { const a = log ? Math.log10(Math.max(v, 1e-12)) : v; return PT + (h - PT - PB) * (1 - (a - lo) / (hi - lo)) }
  const ts = pts.map((p) => p.t).filter(Number.isFinite)
  const t0 = ts.length ? Math.min(...ts) : 0, t1 = ts.length ? Math.max(...ts) : 1
  const x = (t: number) => PL + ((W - PL - PR) * (t - t0)) / Math.max(1, t1 - t0)
  const segs: string[] = []
  let cur: string[] = []
  for (const p of pts) {
    if (p.v == null || !Number.isFinite(p.v) || !Number.isFinite(p.t)) { if (cur.length) segs.push(cur.join(' ')); cur = []; continue }
    cur.push(`${x(p.t).toFixed(1)},${Math.max(PT, Math.min(h - PB, y(p.v))).toFixed(1)}`)
  }
  if (cur.length) segs.push(cur.join(' '))
  const ticks = log ? Array.from({ length: Math.floor(hi) - Math.ceil(lo) + 1 }, (_, i) => Math.ceil(lo) + i) : [lo, (lo + hi) / 2, hi]
  return (
    <svg viewBox={`0 0 ${W} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img">
      {ticks.map((k) => {
        const yy = PT + (h - PT - PB) * (1 - (k - lo) / (hi - lo))
        return <g key={k}><line x1={PL} x2={W - PR} y1={yy} y2={yy} stroke="#1e293b" /><text x={PL - 4} y={yy + 3} textAnchor="end" fontSize={8} fontFamily={MONO} fill="#64748b">{log ? `1e${k}` : k}</text></g>
      })}
      {(refs ?? []).map((r) => {
        const yy = y(r.v)
        if (yy < PT || yy > h - PB) return null
        return <g key={r.label}><line x1={PL} x2={W - PR} y1={yy} y2={yy} stroke={r.color} strokeDasharray="3 3" opacity={0.7} /><text x={W - PR + 3} y={yy + 3} fontSize={8} fontFamily={MONO} fill={r.color}>{r.label}</text></g>
      })}
      {segs.map((s, i) => <polyline key={i} points={s} fill="none" stroke={color} strokeWidth={1.6} />)}
      {ts.length > 0 && [t0, (t0 + t1) / 2, t1].map((t, i) => <text key={i} x={x(t)} y={h - 4} textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'} fontSize={8} fontFamily={MONO} fill="#64748b">{hhmm(t)}</text>)}
      {unit && <text x={W - PR} y={PT + 8} textAnchor="end" fontSize={8} fontFamily={MONO} fill="#64748b">{unit}</text>}
      {segs.length === 0 && <text x={W / 2} y={h / 2} textAnchor="middle" fontSize={10} fontFamily={MONO} fill="#475569">no data on this read</text>}
    </svg>
  )
}

function KpBars({ series, h = 120 }: { series: { t: string; kp: number }[]; h?: number }) {
  const W = 420, PL = 22, PR = 6, PT = 6, PB = 16
  const n = Math.max(1, series.length), bw = (W - PL - PR) / n
  const y = (v: number) => PT + (h - PT - PB) * (1 - v / 9)
  return (
    <svg viewBox={`0 0 ${W} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img">
      {[3, 5, 7].map((k) => <g key={k}><line x1={PL} x2={W - PR} y1={y(k)} y2={y(k)} stroke={k === 5 ? '#eab308' : k === 7 ? '#ff1744' : '#1e293b'} strokeDasharray={k > 3 ? '3 3' : undefined} opacity={0.6} /><text x={PL - 3} y={y(k) + 3} textAnchor="end" fontSize={8} fontFamily={MONO} fill="#64748b">{k}</text></g>)}
      {series.map((s, i) => (
        <g key={s.t}>
          <rect x={PL + i * bw + 2} y={y(s.kp)} width={Math.max(2, bw - 4)} height={Math.max(1, h - PB - y(s.kp))} fill={kpColor(s.kp)} opacity={0.85} />
          <text x={PL + i * bw + bw / 2} y={h - 4} textAnchor="middle" fontSize={8} fontFamily={MONO} fill="#64748b">{hhmm(parse(s.t)).slice(0, 2)}</text>
        </g>
      ))}
      {series.length === 0 && <text x={W / 2} y={h / 2} textAnchor="middle" fontSize={10} fontFamily={MONO} fill="#475569">no data on this read</text>}
    </svg>
  )
}

// ── Auto-scrolling list (the NWS column pattern) ───────────────────────────────────────────────────

function Scroller({ items, empty }: { items: React.ReactNode[]; empty: string }) {
  const clip = useRef<HTMLDivElement>(null)
  const set = useRef<HTMLDivElement>(null)
  const [h, setH] = useState(0)
  useLayoutEffect(() => {
    const ch = set.current?.scrollHeight ?? 0, cl = clip.current?.clientHeight ?? 0
    setH(ch > cl + 4 ? ch : 0)
  }, [items.length])
  if (!items.length) return <div style={{ padding: 12, fontSize: 12, color: '#475569' }}>{empty}</div>
  return (
    <div ref={clip} className="spd-clip">
      <div className={h ? 'spd-scroller' : undefined} style={h ? ({ '--h': `${h}px`, animationDuration: `${Math.max(12, h / 22)}s` } as React.CSSProperties) : undefined}>
        <div ref={set}>{items}</div>{h ? <div>{items}</div> : null}
      </div>
    </div>
  )
}

function Pill({ k, level, today }: { k: string; level: SpaceLevel; today: SpaceLevel | null | undefined }) {
  const c = LEVEL_COLOR[level]
  return (
    <span title={`${k}${level} ${LEVEL_WORD[level]} now${today != null ? ` · NOAA today ${k}${today}` : ''}`}
      style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: c, border: `1px solid ${c}66`, background: `${c}18`, borderRadius: 3, padding: '1px 7px' }}>
      {k}{level}{today != null && today !== level ? <span style={{ fontWeight: 400, fontSize: 9, color: '#94a3b8' }}> /{today}</span> : null}
    </span>
  )
}

function Figure({ src, title, sub, bust }: { src: string; title: string; sub: string; bust: number }) {
  return (
    <figure className="spd-fig">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${src}?t=${bust}`} alt={title} loading="lazy" />
      <figcaption><b>{title}</b><span>{sub}</span></figcaption>
    </figure>
  )
}

// ── Dashboard ──────────────────────────────────────────────────────────────────────────────────────

export function SpaceDashboard({ d, infrastructure, regionHref }: {
  d: SpacePanel
  infrastructure: { score: number | null; level: string | null } | null
  regionHref: string
}) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(t) }, [])
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => { setHost(document.body) }, [])

  const s = d.snapshot
  const L = d.levels.now
  const bandC = BAND_COLOR[d.score.band]
  const bust = Math.floor(parse(d.generatedAt) / 300e3) // SWPC images refresh every few minutes; one URL per 5 min
  const xray = (s.xray?.series ?? []).map((p) => ({ t: parse(p.t), v: p.flux }))
  const p10 = (s.protons?.series ?? []).map((p) => ({ t: parse(p.t), v: p.p10 }))
  const p100 = (s.protons?.series ?? []).map((p) => ({ t: parse(p.t), v: p.p100 }))
  const bz = (s.wind?.series ?? []).map((p) => ({ t: parse(p.t), v: p.bz }))
  const wl = s.wind?.latest ?? null
  const alerts = (s.alerts ?? []).filter((a) => a.kind !== 'summary')
  const stat = (label: string, v: number | null | undefined, unit: string, warn?: boolean) => (
    <div key={label} className="spd-stat"><span>{label}</span><b style={{ color: warn ? '#eab308' : '#f1f5f9' }}>{v == null ? '—' : Number.isInteger(v) ? v : v.toFixed(1)}</b><span>{unit}</span></div>
  )

  if (!host) return <div style={{ minHeight: '100vh', background: '#060b16' }} />
  return createPortal(
    <div className="spd-root">
      <style>{CSS}</style>
      <header className="spd-head">
        <a href={regionHref} style={{ color: '#38bdf8', textDecoration: 'none', fontFamily: MONO, fontSize: 11 }}>← Travel Risk</a>
        <span style={{ fontFamily: MONO, fontSize: 11, color: '#94a3b8' }}>{d.node.name}</span>
        <span style={{ fontFamily: MONO, fontWeight: 800, letterSpacing: '0.14em', fontSize: 14, color: '#f1f5f9' }}>SPACE WEATHER</span>
        <span style={{ display: 'flex', gap: 6 }}>
          <Pill k="R" level={L.R} today={d.levels.today?.R} /><Pill k="S" level={L.S} today={d.levels.today?.S} /><Pill k="G" level={L.G} today={d.levels.today?.G} />
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: '#cbd5e1' }} title="ovix6 Space Wx score: the worst NOAA level now, 0–10">
          Space Wx <b style={{ color: bandC, fontSize: 14 }}>{d.score.value.toFixed(1)}</b> <span style={{ color: bandC }}>{d.score.band}</span>
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: '#cbd5e1' }}>
          OVIX infrastructure <b style={{ color: '#f1f5f9' }}>{infrastructure?.score != null ? infrastructure.score.toFixed(1) : '—'}</b> {infrastructure?.level ?? ''}
          {d.floor ? <span style={{ color: '#eab308' }}> · floor ≥{d.floor.floor.toFixed(1)} ({d.floor.rule})</span> : <span style={{ color: '#64748b' }}> · no official floor</span>}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, color: '#64748b' }}>SWPC read {ago(s.fetchedAt, now)}</span>
        <a href="/travelrisk/misery" style={{ marginLeft: 'auto', color: '#38bdf8', fontFamily: MONO, fontSize: 11, textDecoration: 'none' }}>Travel misery →</a>
        <a href="/travelrisk/region/global/nws" style={{ color: '#38bdf8', fontFamily: MONO, fontSize: 11, textDecoration: 'none' }}>NWS warnings →</a>
        <a href="https://www.swpc.noaa.gov/" target="_blank" rel="noopener" style={{ color: '#38bdf8', fontFamily: MONO, fontSize: 11, textDecoration: 'none' }}>swpc.noaa.gov ↗</a>
      </header>

      <div className="spd-banner" style={{ borderLeft: `4px solid ${bandC}` }}>
        <span style={{ color: bandC, fontWeight: 700 }}>{d.score.banner}</span>
        <span style={{ color: '#94a3b8' }}>Sunlit now: {d.sun.daylit.join(', ') || '—'} (subsolar {d.sun.lat}°, {d.sun.lon}°). HF blackouts hit the sunlit side only.</span>
        {s.gaps.length > 0 && <span style={{ color: '#eab308' }}>GAP — SWPC did not answer for: {s.gaps.join(', ')}. A missing product is not a quiet sun.</span>}
      </div>

      <div className="spd-upper">
        <div className="spd-imgs">
          <Figure src={d.images.suvi195} title="SUN · SUVI 195 Å" sub="GOES solar ultraviolet imager, latest" bust={bust} />
          <Figure src={d.images.lascoC3} title="CORONA · LASCO C3" sub="SOHO coronagraph — CMEs leave here" bust={bust} />
          <Figure src={d.images.auroraNorth} title="AURORA · OVATION N" sub="30–90 min forecast, probability" bust={bust} />
        </div>
        <div className="spd-charts">
          <div className="spd-chart">
            <div className="spd-ct"><span>GOES X-RAY · 0.1–0.8 nm · 6 h</span><span style={{ color: LEVEL_COLOR[L.R] }}>now {s.xray?.latest?.cls ?? '—'} · peak {s.xray?.peak?.cls ?? '—'} {s.xray?.peak ? hhmm(parse(s.xray.peak.t)) : ''}</span></div>
            <Chart pts={xray} log lo={-8} hi={-2} color="#f1f5f9" unit="W/m²"
              refs={[{ v: 1e-5, label: 'M · R1', color: '#eab308' }, { v: 5e-5, label: 'M5 · R2', color: '#eab308' }, { v: 1e-4, label: 'X · R3', color: '#ff1744' }, { v: 1e-3, label: 'X10 · R4', color: '#ff1744' }]} />
          </div>
          <div className="spd-chart">
            <div className="spd-ct"><span>PLANETARY Kp · 24 h</span><span style={{ color: LEVEL_COLOR[L.G] }}>Kp {s.kp?.latest?.kp.toFixed(2) ?? '—'}{s.kp?.estimated ? ` · est ${s.kp.estimated.kp.toFixed(2)}` : ''}</span></div>
            <KpBars series={s.kp?.series ?? []} />
          </div>
          <div className="spd-chart">
            <div className="spd-ct"><span>PROTONS · ≥10 MeV (white) · ≥100 MeV (blue) · 6 h</span><span style={{ color: LEVEL_COLOR[L.S] }}>{s.protons?.latest?.p10 != null ? `${s.protons.latest.p10.toFixed(2)} pfu` : '—'}</span></div>
            <div style={{ position: 'relative' }}>
              <Chart pts={p10} log lo={-1} hi={5} color="#f1f5f9" unit="pfu" refs={[{ v: 10, label: 'S1', color: '#eab308' }, { v: 100, label: 'S2', color: '#eab308' }, { v: 1e3, label: 'S3', color: '#ff1744' }, { v: 1e4, label: 'S4', color: '#ff1744' }]} />
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}><Chart pts={p100} log lo={-1} hi={5} color="#38bdf8" /></div>
            </div>
          </div>
          <div className="spd-chart">
            <div className="spd-ct"><span>SOLAR WIND · propagated to Earth · 1 h</span><span style={{ color: '#94a3b8' }}>{wl ? hhmm(parse(wl.t)) : '—'}</span></div>
            <div className="spd-stats">
              {stat('speed', wl?.speed, 'km/s', (wl?.speed ?? 0) >= 500)}{stat('density', wl?.density, 'p/cm³', (wl?.density ?? 0) >= 10)}{stat('Bz', wl?.bz, 'nT', (wl?.bz ?? 0) <= -10)}{stat('Bt', wl?.bt, 'nT', (wl?.bt ?? 0) >= 20)}
            </div>
            <Chart pts={bz} lo={-20} hi={20} color="#38bdf8" unit="Bz nT" h={70} refs={[{ v: 0, label: '0', color: '#475569' }, { v: -10, label: 'south', color: '#eab308' }]} />
            {s.scales?.forecast?.length ? (
              <table className="spd-fc">
                <thead><tr><th>forecast</th><th>R minor</th><th>R major</th><th>S</th><th>G</th></tr></thead>
                <tbody>
                  {s.scales.forecast.map((f) => (
                    <tr key={f.date}><td>{f.date.slice(5)}</td><td>{f.rMinorProb ?? '—'}%</td><td>{f.rMajorProb ?? '—'}%</td><td>{f.sProb ?? '—'}%</td><td style={{ color: LEVEL_COLOR[f.G ?? 0] }}>G{f.G ?? 0}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        </div>
      </div>

      <div className="spd-lower">
        <div className="spd-col">
          <div className="spd-ch">AVIATION IMPACT · now</div>
          <div style={{ padding: '6px 10px', display: 'grid', gap: 6, overflow: 'auto' }}>
            {d.aviation.map((a) => (
              <div key={a.key} className="spd-card" style={{ borderLeft: `4px solid ${LEVEL_COLOR[a.level]}` }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#f1f5f9' }}>{a.label}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: LEVEL_COLOR[a.level] }}>{a.level === 0 ? 'CLEAR' : LEVEL_WORD[a.level].toUpperCase()} · {a.drivers}</span>
                </div>
                <div style={{ fontSize: 11, color: '#cbd5e1', marginTop: 3, lineHeight: 1.4 }}>{a.text}</div>
              </div>
            ))}
            <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.5 }}>
              R = radio blackout (X-ray flux, sunlit side) · S = radiation storm (protons, polar routes, satellites) · G = geomagnetic storm (Kp, GNSS, grids, aurora). NOAA thresholds; indicative levels 0–5.
            </div>
          </div>
        </div>
        <div className="spd-col">
          <div className="spd-ch"><span>SWPC ALERTS · 72 h</span><span style={{ marginLeft: 'auto' }}>{alerts.length}</span></div>
          <Scroller empty={s.alerts === null ? 'SWPC alerts did not answer on this read (gap).' : 'No SWPC watch, warning or alert in 72 h.'} items={alerts.map((a, i) => (
            <a key={i} href="https://www.swpc.noaa.gov/products/alerts-watches-and-warnings" target="_blank" rel="noopener" className="spd-row">
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: KIND_COLOR[a.kind], border: `1px solid ${KIND_COLOR[a.kind]}66`, borderRadius: 3, padding: '0 4px' }}>{a.kind.toUpperCase()}</span>
                {a.scale && a.level != null && <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: LEVEL_COLOR[a.level] }}>{a.scale}{a.level}</span>}
                <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10, color: '#64748b' }}>{ago(a.issued, now)}</span>
              </div>
              <div style={{ fontSize: 12, color: '#e2e8f0', marginTop: 2 }}>{a.headline}</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: '#64748b' }}>{[a.code, a.validUntil ? left(a.validUntil, now) || `until ${a.validUntil.slice(5, 16).replace('T', ' ')}Z` : null].filter(Boolean).join(' · ')}</div>
            </a>
          ))} />
        </div>
        <div className="spd-col" style={{ borderRight: 0 }}>
          <div className="spd-ch"><span>OVIX EVENTS · swpc · 72 h</span><span style={{ marginLeft: 'auto' }}>{d.events.length}</span></div>
          <Scroller empty="No swpc event in OVIX in 72 h — nothing reached a NOAA scale level." items={d.events.map((e, i) => (
            <a key={i} href={e.url ?? undefined} target="_blank" rel="noopener" className="spd-row">
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: e.severity >= 9 ? '#ff1744' : e.severity >= 7 ? '#eab308' : e.severity >= 5 ? '#38bdf8' : '#94a3b8' }}>{e.label ?? e.type ?? 'event'}</span>
                <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 10, color: '#64748b' }}>sev {e.severity.toFixed(0)} · {ago(e.at, now)}</span>
              </div>
              <div style={{ fontSize: 12, color: '#e2e8f0', marginTop: 2 }}>{e.title}</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: '#64748b' }}>{left(e.expires, now)}</div>
            </a>
          ))} />
        </div>
      </div>
    </div>,
    host,
  )
}

const CSS = `
.spd-root{position:fixed;inset:0;z-index:2147483000;background:#060b16;color:#e2e8f0;display:flex;flex-direction:column;font-family:Inter,system-ui,sans-serif}
.spd-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:8px 14px;border-bottom:1px solid #1e293b;background:#0b1220}
.spd-banner{display:flex;gap:18px;flex-wrap:wrap;align-items:baseline;padding:6px 14px;font-size:12px;background:#081020;border-bottom:1px solid #1e293b}
.spd-upper{flex:0 0 50%;display:flex;min-height:0;border-bottom:1px solid #1e293b}
.spd-imgs{flex:0 0 42%;display:flex;min-width:0;border-right:1px solid #1e293b;background:#000}
.spd-fig{flex:1;margin:0;display:flex;flex-direction:column;min-width:0;border-right:1px solid #1e293b}
.spd-fig img{flex:1;min-height:0;width:100%;object-fit:contain;background:#000}
.spd-fig figcaption{display:flex;flex-direction:column;padding:4px 8px;background:#0b1220;font-family:${MONO};font-size:10px;color:#94a3b8;border-top:1px solid #1e293b}
.spd-fig figcaption b{color:#e2e8f0;letter-spacing:.08em}
.spd-charts{flex:1;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;min-height:0;min-width:0}
.spd-chart{padding:6px 10px;border-right:1px solid #1e293b;border-bottom:1px solid #1e293b;min-height:0;overflow:hidden;display:flex;flex-direction:column}
.spd-chart:nth-child(2n){border-right:0}
.spd-chart:nth-child(n+3){border-bottom:0}
.spd-ct{display:flex;justify-content:space-between;gap:8px;font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.1em;color:#94a3b8;margin-bottom:2px}
.spd-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:2px 0 4px}
.spd-stat{display:flex;flex-direction:column;align-items:center;background:#0f172a;border:1px solid #1e293b;border-radius:4px;padding:3px 4px;font-family:${MONO};font-size:9px;color:#64748b}
.spd-stat b{font-size:15px}
.spd-fc{width:100%;border-collapse:collapse;font-family:${MONO};font-size:10px;color:#cbd5e1;margin-top:2px}
.spd-fc th{text-align:left;color:#64748b;font-weight:600;letter-spacing:.06em;padding:1px 4px}
.spd-fc td{padding:1px 4px;border-top:1px solid #111c30}
.spd-lower{flex:1;display:grid;grid-template-columns:1.1fr 1fr 1fr;min-height:0}
.spd-col{display:flex;flex-direction:column;min-height:0;border-right:1px solid #1e293b}
.spd-ch{display:flex;padding:6px 10px;border-bottom:2px solid #1e293b;font-family:${MONO};font-weight:700;font-size:11px;color:#94a3b8;letter-spacing:.1em}
.spd-card{padding:7px 9px;background:#0f172a;border:1px solid #1e293b;border-radius:4px}
.spd-clip{flex:1;overflow:hidden;min-height:0}
.spd-scroller{animation:spdScroll linear infinite}
.spd-col:hover .spd-scroller{animation-play-state:paused}
@keyframes spdScroll{from{transform:translateY(0)}to{transform:translateY(calc(-1 * var(--h)))}}
.spd-row{display:block;padding:7px 10px;border-bottom:1px solid #111c30;text-decoration:none}
.spd-row:hover{background:#0f1a2e}
@media (max-width:1000px){
  .spd-root{overflow-y:auto}
  .spd-root>*{flex:none}
  .spd-upper{flex:none;flex-direction:column}
  .spd-imgs{flex:none;border-right:0;height:14rem}
  .spd-charts{grid-template-columns:1fr;grid-template-rows:auto}
  .spd-chart{border-right:0;border-bottom:1px solid #1e293b}
  .spd-lower{grid-template-columns:1fr}
  .spd-clip{height:18rem;flex:none}
}
`
