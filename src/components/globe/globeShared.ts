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

export function incidentSize(sev: string | null | undefined): number {
  switch ((sev || '').toUpperCase()) {
    case 'SEV1':
      return 14
    case 'SEV2':
      return 11
    case 'SEV3':
      return 9
    case 'SEV4':
      return 7
    default:
      return 8
  }
}

// Numeric severity (0–10) extracted from the signal's severity field.
export function signalSeverityNum(s: GlobeSignal): number {
  const n = typeof s.severity === 'number' ? s.severity : parseFloat(String(s.severity ?? ''))
  return isNaN(n) ? 0 : n
}

// Point size scales with severity (4–9px) so big events read larger.
export function signalSize(s: GlobeSignal): number {
  const n = signalSeverityNum(s)
  if (n >= 8) return 9
  if (n >= 6) return 7
  if (n >= 4) return 6
  return 5
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
