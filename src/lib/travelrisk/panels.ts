import type { OpRiskPayload } from '@/lib/scoreState'

/**
 * Tier-2 panels (2026-10-12). The region window and its panels read two ovix-api endpoints and
 * compute nothing: the registry (panel → op-risk domain → official sources) lives in ovix-api
 * so World Glass, the window and the brief can never disagree about what explains a score.
 *
 *   GET /api/ovix/panels?node=<id>      node, parent, op-risk reading, panels it can open, registry
 *   GET /api/ovix/panels/<panel>?node=  one panel's data (nws today)
 */

const OVIX_API = 'https://ovix-api.tedlango.workers.dev'

export interface PanelNode {
  id: string; name: string; tier: 'global' | 'macro' | 'sub' | 'metro'
  parent: string | null; isUS: boolean; nwsStates: string[] | null
  bbox: [number, number, number, number] | null // [south, west, north, east]
}
export interface PanelDef { id: string; title: string; domain: string; coverage: 'us' | 'global'; status: 'live' | 'planned'; blurb: string; sources: string[] }
export interface OpRiskDomainFull {
  domain: string; score: number; level: string; available: boolean; eventCount?: number
  topEvent: string | null; topSource: string | null; guardApplied?: string; state?: string
}
export interface RegionWindow {
  node: PanelNode; parent: { id: string; name: string } | null
  opRisk: (OpRiskPayload & { domains?: OpRiskDomainFull[]; regionName?: string | null }) | null
  panels: PanelDef[]; registry: PanelDef[]; generatedAt: string
}
export interface NwsAlert { event: string; severityLabel: string; severity: number; area: string; states: string[]; issued: string; expires: string | null; headline: string | null; url: string | null; source: string }
export interface NwsPanel {
  panel: PanelDef; node: PanelNode; coverage: 'full' | 'partial' | 'none'; note?: string; generatedAt: string
  summary?: { alerts: number; extreme: number; severe: number; moderate: number; minor: number; tropical: number; reports: number }
  floor?: { domain: string; floor: number; rule: string; reason: string; source: string; count: number } | null
  byEvent?: { key: string; count: number; worst: string }[]
  byState?: { key: string; count: number; worst: string }[]
  reportTypes?: { type: string; count: number }[]
  alerts?: NwsAlert[]
  reports?: { type: string; title: string; area: string; detail: string | null; at: string }[]
  truncated?: { alerts: number; reports: number }
  airports?: AirportStatus[]
  regions?: RegionChip[]
}

export interface RegionChip {
  id: string; name: string; short: string; bbox: [number, number, number, number] | null
  weather: { score: number; level: string; available: boolean; floored: boolean; updated: string | null } | null
  nws: { alerts: number; extreme: number; severe: number }
  floor: { floor: number; rule: string } | null
}

export type AviationImpact = 'disrupt' | 'delay' | 'advisory' | 'clear'
export interface AirportStatus {
  iata: string; name: string; city: string; state: string; lat: number; lon: number; rank: number
  impact: AviationImpact; reachable: boolean; inNode: boolean
  alerts: { event: string; severity: string; impact: AviationImpact; ends: string | null; headline: string | null; url: string | null }[]
}

// ── Space weather (2026-10-15) — mirrors workers/ovix-api/src/panels/space.ts ──────────────────────
export type SpaceScale = 'R' | 'S' | 'G'
export type SpaceLevel = 0 | 1 | 2 | 3 | 4 | 5
export interface SwpcAlert {
  productId: string; issued: string; kind: 'watch' | 'warning' | 'alert' | 'summary' | 'other'; code: string | null
  scale: SpaceScale | null; level: SpaceLevel | null; headline: string; validUntil: string | null; message: string
}
export interface ScaleDay { date: string; R: SpaceLevel | null; S: SpaceLevel | null; G: SpaceLevel | null; rMinorProb: number | null; rMajorProb: number | null; sProb: number | null }
export interface SwpcSnapshot {
  fetchedAt: string
  scales: { current: { R: SpaceLevel; S: SpaceLevel; G: SpaceLevel }; observedAt: string | null; yesterday: ScaleDay | null; forecast: ScaleDay[] } | null
  kp: { series: { t: string; kp: number }[]; latest: { t: string; kp: number } | null; estimated: { t: string; kp: number } | null } | null
  xray: { series: { t: string; flux: number }[]; latest: { t: string; flux: number; cls: string | null } | null; peak: { t: string; flux: number; cls: string | null } | null } | null
  protons: { series: { t: string; p10: number | null; p100: number | null }[]; latest: { t: string; p10: number | null; p100: number | null } | null } | null
  wind: { series: { t: string; speed: number | null; density: number | null; bz: number | null; bt: number | null }[]; latest: { t: string; speed: number | null; density: number | null; bz: number | null; bt: number | null } | null } | null
  alerts: SwpcAlert[] | null
  gaps: string[]
}
export interface SpaceAviation { key: 'hf' | 'polar' | 'gnss' | 'satcom'; label: string; level: SpaceLevel; text: string; drivers: string }
export interface SpacePanel {
  panel: PanelDef; node: PanelNode; coverage: 'full'; generatedAt: string
  snapshot: SwpcSnapshot
  levels: { now: { R: SpaceLevel; S: SpaceLevel; G: SpaceLevel }; today: { R: SpaceLevel; S: SpaceLevel; G: SpaceLevel } | null; worstNow: SpaceLevel; worstToday: SpaceLevel | null }
  score: { value: number; band: 'QUIET' | 'MINOR' | 'ELEVATED' | 'SEVERE'; banner: string; todayValue: number | null }
  aviation: SpaceAviation[]
  sun: { lat: number; lon: number; daylit: string[] }
  images: { suvi195: string; lascoC3: string; auroraNorth: string; auroraSouth: string; overview: string }
  events: { title: string; type: string | null; severity: number; label: string | null; at: string; expires: string | null; url: string | null; detail: string | null }[]
  floor: { domain: string; floor: number; rule: string; reason: string; source: string; count: number } | null
  sources: { live: string; events: string }
}

export type Fetched<T> = { ok: true; data: T } | { ok: false; status: number | null }

async function get<T>(path: string, revalidate: number): Promise<Fetched<T>> {
  try {
    const r = await fetch(`${OVIX_API}${path}`, { next: { revalidate }, signal: AbortSignal.timeout(15000) })
    if (!r.ok) return { ok: false, status: r.status }
    return { ok: true, data: (await r.json()) as T }
  } catch {
    return { ok: false, status: null }
  }
}

export const fetchRegionWindow = (node: string) => get<RegionWindow>(`/api/ovix/panels?node=${encodeURIComponent(node)}`, 120)
export const fetchNwsPanel = (node: string) => get<NwsPanel>(`/api/ovix/panels/nws?node=${encodeURIComponent(node)}`, 60)
export const fetchSpacePanel = (node: string) => get<SpacePanel>(`/api/ovix/panels/space?node=${encodeURIComponent(node)}`, 60)

/** "2026-10-12 15:06:00+00" → "Oct 12 15:06Z" */
export function fmtZ(v: string | null | undefined): string {
  if (!v) return '—'
  const t = Date.parse(v.includes('T') ? v : v.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'))
  if (Number.isNaN(t)) return v
  const d = new Date(t)
  return `${d.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} ${d.toISOString().slice(11, 16)}Z`
}
