// Shared types + presentation helpers for the native Signal Globe hero (hub-010).
// Mirrors the color / sizing scheme from public/roc/globe/globe.html so the
// landing hero and the standalone ROC globe stay visually consistent.
// NO ORANGE — signals use the canonical domain palette per the Mission Control spec.
// Domain colors + labels are delegated to the single source of truth in
// src/lib/domainColors.ts (hub-017) so the globe, signals page and landing all
// share one map.

import { domainColor, domainLabel as canonicalDomainLabel } from '@/lib/domainColors'

export interface GlobeSignal {
  id: number
  category: string
  severity: string | number | null
  severity_label?: string | null
  title: string
  region_name: string | null
  created_at: string
  lat: number
  lon: number
  geo_source?: string
  promoted: boolean
  incident_id: number | null
  incident_slug: string | null
  sev_level: string | null
}

export interface GlobeIncident {
  id: number
  title: string
  slug: string
  domain: string
  sev_level: string
  status: string
  location_lat: number | string | null
  location_lon: number | string | null
  created_at: string
}

export interface GlobeFeed {
  signals: GlobeSignal[]
  incidents: GlobeIncident[]
}

// Auto-tour scope (hub-020): governs what the camera auto-cycles through.
//   incidents → headline tier only · signals → ambient tier only
//   both → incidents first, then signals · none → no hopping (idle spin only)
export type TourScope = 'incidents' | 'signals' | 'both' | 'none'

// Speed presets → tour dwell (ms held on each stop before advancing).
export type TourSpeed = 'slow' | 'medium' | 'fast'
export const TOUR_SPEED_DWELL: Record<TourSpeed, number> = {
  slow: 8000,
  medium: 5000,
  fast: 2500,
}

// Category → point color. Delegated to the canonical domain map (hub-017) so the
// globe dots match the signals page + landing badges exactly.
export function signalColor(category: string | null | undefined): string {
  return domainColor(category)
}

// Incident severity ramp (matches globe.html incidentColor — no orange).
export function incidentColor(sev: string | null | undefined): string {
  switch ((sev || '').toUpperCase()) {
    case 'SEV1':
      return '#ef4444' // red — critical
    case 'SEV2':
      return '#eab308' // yellow — high
    case 'SEV3':
      return '#22d3ee' // cyan — moderate
    case 'SEV4':
      return '#64748b' // slate — low
    default:
      return '#22d3ee'
  }
}

// Incidents are the HEADLINE tier — large, dominant. Deliberately sized well
// above the signal tier (max signal dot = 6px) so the two layers never read as
// the same kind of thing (hub-014 two-tier model).
export function incidentSize(sev: string | null | undefined): number {
  switch ((sev || '').toUpperCase()) {
    case 'SEV1':
      return 20
    case 'SEV2':
      return 17
    case 'SEV3':
      return 14
    case 'SEV4':
      return 12
    default:
      return 13
  }
}

// Numeric severity (0–10) extracted from the signal's severity field.
export function signalSeverityNum(s: GlobeSignal): number {
  const n = typeof s.severity === 'number' ? s.severity : parseFloat(String(s.severity ?? ''))
  return isNaN(n) ? 0 : n
}

// Signals are the AMBIENT tier — small fading dots. Kept deliberately small
// (max 7px) so even a high-severity signal stays visibly subordinate to the
// smallest incident marker (12px). Severity still nudges size for texture.
// Floor raised to 4px (hub-019) so the lowest-severity dots stay legible against
// the density glow without crossing into the incident tier.
export function signalSize(s: GlobeSignal): number {
  const n = signalSeverityNum(s)
  if (n >= 8) return 7
  if (n >= 6) return 6
  if (n >= 4) return 5
  return 4
}

// Short severity chip label, e.g. "7.0" or "SEVERE".
export function severityChip(s: GlobeSignal): string {
  const n = signalSeverityNum(s)
  if (n > 0) return n.toFixed(1)
  if (s.severity_label) return String(s.severity_label).toUpperCase()
  return '—'
}

export function severityChipColor(s: GlobeSignal): string {
  const n = signalSeverityNum(s)
  if (n >= 8) return '#ef4444'
  if (n >= 6) return '#eab308'
  if (n >= 4) return '#22d3ee'
  return '#64748b'
}

// Re-exported from the canonical domain module (hub-017) so existing globe
// importers keep working off one definition.
export const domainLabel = canonicalDomainLabel

// Strip the worker's title scaffold so the human headline shows through.
// Source titles look like: "[Region] <domain> <sev> — Real headline"
//   e.g. "[Global] seismic 6.0 — M 5.0 - Drake Passage" → "M 5.0 - Drake Passage"
//        "[US] cyber 8.0 — AzeoTech DAQFactory"          → "AzeoTech DAQFactory"
// Mirrors the eventKey pattern in spec §40. Falls back to the raw title if the
// strip would leave nothing.
export function cleanTitle(title: string | null | undefined): string {
  if (!title) return title || ''
  let t = title.replace(/^\[[^\]]*\]\s*/, '') // drop [Region] tag
  t = t.replace(/^[a-z0-9_-]+\s+\d+(?:\.\d+)?\s*—\s*/i, '') // drop "<domain> <sev> — "
  return t.trim() || title
}

// Stable identity for an event regardless of which city point it was fanned to
// or minor formatting differences ("M 5.0 - Drake Passage" vs "M5.0 — DRAKE
// PASSAGE"). Category-scoped + heavily normalized so geo-fan-out duplicates and
// near-identical re-emits collapse to one key. Untitled signals never merge.
export function eventKey(s: GlobeSignal): string {
  const norm = cleanTitle(s.title).toLowerCase().replace(/[^a-z0-9]+/g, '')
  if (!norm) return `id-${s.id}`
  const category = (s.category || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  return `${category}|${norm}`
}

function signalHasCoords(s: GlobeSignal): boolean {
  return !isNaN(Number(s.lat)) && !isNaN(Number(s.lon))
}

// Rank a representative: plottable (has coords) > precise geo > anything.
function repRank(s: GlobeSignal): number {
  return (signalHasCoords(s) ? 2 : 0) + (s.geo_source === 'precise' ? 1 : 0)
}

// Collapse geo-fan-out duplicates client-side: one real event → one ticker row +
// one representative point (hub-014 Part 2.3). Picks the most plottable / precise
// representative per eventKey, then the newest. Returns newest-first.
export function dedupeSignalsByEvent(list: GlobeSignal[]): GlobeSignal[] {
  const best = new Map<string, GlobeSignal>()
  for (const s of list) {
    const k = eventKey(s)
    const cur = best.get(k)
    if (!cur) {
      best.set(k, s)
      continue
    }
    const dr = repRank(s) - repRank(cur)
    if (dr > 0) best.set(k, s)
    else if (dr === 0 && new Date(s.created_at).getTime() > new Date(cur.created_at).getTime()) {
      best.set(k, s)
    }
  }
  return Array.from(best.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}

// ── Density / heat-glow layer (hub-015) ─────────────────────────────────────
// Aggregate the plotted signal set into coarse geographic clusters so we can
// render a soft heat glow where activity concentrates. This is VOLUME, not
// severity — the color ramp below is deliberately NOT the incident red.

export interface DensityCluster {
  lat: number // centroid latitude
  lon: number // centroid longitude
  count: number // signals in this cell
}

// Bin points onto a coarse lat/lon grid and return one cluster per occupied
// cell with its signal count + centroid. Cheap (single pass, ~50 points) so it
// can recompute on every feed refresh. Caller pre-filters (promoted/age/coords).
export function clusterPoints(
  points: { lat: number; lon: number }[],
  cellDeg = 4,
): DensityCluster[] {
  const cells = new Map<string, { latSum: number; lonSum: number; count: number }>()
  for (const p of points) {
    if (isNaN(p.lat) || isNaN(p.lon)) continue
    const key = `${Math.floor(p.lat / cellDeg)}:${Math.floor(p.lon / cellDeg)}`
    const c = cells.get(key)
    if (c) {
      c.latSum += p.lat
      c.lonSum += p.lon
      c.count++
    } else {
      cells.set(key, { latSum: p.lat, lonSum: p.lon, count: 1 })
    }
  }
  const out: DensityCluster[] = []
  for (const c of cells.values()) {
    out.push({ lat: c.latSum / c.count, lon: c.lonSum / c.count, count: c.count })
  }
  return out
}

// Density intensity ramp: low → high activity, cyan (#22d3ee) → amber (#f59e0b).
// Mission Control palette, deliberately distinct from the incident severity red
// so "busy" never reads as "severe". t is clamped to [0,1]. NO ORANGE (#f97316).
export function densityColor(t: number): string {
  const c = Math.max(0, Math.min(1, t))
  const from = [0x22, 0xd3, 0xee] // cyan
  const to = [0xf5, 0x9e, 0x0b] // amber
  const r = Math.round(from[0] + (to[0] - from[0]) * c)
  const g = Math.round(from[1] + (to[1] - from[1]) * c)
  const b = Math.round(from[2] + (to[2] - from[2]) * c)
  return `rgb(${r}, ${g}, ${b})`
}

export function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`
  return `${Math.floor(seconds / 86400)}d`
}

// Cesium CDN release that globe.html pins. Loaded as a global <script> so Cesium
// never enters the Next bundle and the component stays SSR-safe.
export const CESIUM_VERSION = '1.124'
export const CESIUM_CDN_BASE = `https://cesium.com/downloads/cesiumjs/releases/${CESIUM_VERSION}/Build/Cesium/`
export const OVIX_API_BASE = 'https://ovix-api.tedlango.workers.dev'
// Poll the feed at the endpoint's max window (360 min). The default 150 returns
// only ~6 signals, which starved the globe + ticker and left auto-fly with no
// material; 360 returns ~40+ resolved/coord-bearing signals so the ticker is
// populated and every ticker row is flyable (hub-013).
export const ROC_GLOBE_FEED = '/api/roc-globe?mins=360'
