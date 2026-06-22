// Shared types + presentation helpers for the native Signal Globe hero (hub-010).
// Mirrors the color / sizing scheme from public/roc/globe/globe.html so the
// landing hero and the standalone ROC globe stay visually consistent.
// NO ORANGE — signals use category cyans/blues/greys per the Mission Control spec.

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

// Category → point color (matches globe.html signalCategoryColors).
const SIGNAL_CATEGORY_COLORS: Record<string, string> = {
  weather: '#3b82f6',
  seismic: '#22d3ee',
  disaster: '#06b6d4',
  cyber: '#22c55e',
  infrastructure: '#8b5cf6',
  health: '#ec4899',
  financial: '#0ea5e9',
  environmental: '#14b8a6',
  geopolitical: '#a78bfa',
  travel: '#38bdf8',
  labor: '#818cf8',
  supply_chain: '#2dd4bf',
  events: '#64748b',
  general: '#64748b',
}

export function signalColor(category: string | null | undefined): string {
  return SIGNAL_CATEGORY_COLORS[(category || '').toLowerCase()] || '#22d3ee'
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
// (max 6px) so even a high-severity signal stays visibly subordinate to the
// smallest incident marker (12px). Severity still nudges size for texture.
export function signalSize(s: GlobeSignal): number {
  const n = signalSeverityNum(s)
  if (n >= 8) return 6
  if (n >= 6) return 5
  if (n >= 4) return 4
  return 3
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

export function domainLabel(domain: string | null | undefined): string {
  return (domain || 'general').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// Strip the worker's title scaffold so the human headline shows through.
// Source titles look like: "[Region] <domain> <sev> — Real headline"
//   e.g. "[Global] seismic 6.0 — M 5.0 - Drake Passage" → "M 5.0 - Drake Passage"
//        "[US] cyber 8.0 — AzeoTech DAQFactory"          → "AzeoTech DAQFactory"
// Mirrors the eventKey pattern in spec §40. Falls back to the raw title if the
// strip would leave nothing.
export function cleanTitle(title: string | null | undefined): string {
  if (!title) return title || ''
  let t = title.replace(/^\[[^\]]*\]\s*/, '') // drop [Region] tag
  t = t.replace(/^[a-z_]+\s+\d+(?:\.\d+)?\s*—\s*/i, '') // drop "<domain> <sev> — "
  return t.trim() || title
}

// Stable identity for an event regardless of which city point it was fanned to
// or minor formatting differences ("M 5.0 - Drake Passage" vs "M5.0 — DRAKE
// PASSAGE"). Category-scoped + heavily normalized so geo-fan-out duplicates and
// near-identical re-emits collapse to one key. Untitled signals never merge.
export function eventKey(s: GlobeSignal): string {
  const norm = cleanTitle(s.title).toLowerCase().replace(/[^a-z0-9]+/g, '')
  if (!norm) return `id-${s.id}`
  return `${(s.category || '').toLowerCase()}|${norm}`
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
