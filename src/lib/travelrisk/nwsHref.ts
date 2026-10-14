/**
 * nwsHref.ts — where an individual NWS warning takes a reader (Ted, 2026-10-14).
 *
 * An alert's own link is `https://api.weather.gov/alerts/urn:oid:…`, which opens raw JSON. A warning
 * on any hub surface should instead open the NWS dashboard we built: the tier-2 panel at
 * `/travelrisk/region/<node>/nws`, for the US sub-region that holds the warning when we can tell,
 * else the global (general) NWS dashboard. The raw JSON stays reachable as a small "json" link, so the
 * provenance is never lost.
 *
 * The six US sub-regions and their states mirror SUB_REGIONS in ovix-api (workers/ovix-api/src/regions.ts).
 */

export const US_NWS_NODES: { id: string; name: string; states: string[] }[] = [
  { id: 'us-northeast', name: 'US Northeast', states: ['NY', 'NJ', 'CT', 'MA', 'PA', 'ME', 'NH', 'VT', 'RI', 'DE', 'MD'] },
  { id: 'us-southeast', name: 'US Southeast', states: ['GA', 'FL', 'NC', 'SC', 'VA', 'TN', 'AL', 'MS', 'LA', 'KY', 'WV'] },
  { id: 'us-midwest', name: 'US Midwest', states: ['IL', 'OH', 'MI', 'IN', 'WI', 'MN', 'IA', 'MO', 'KS', 'NE', 'ND', 'SD'] },
  { id: 'us-south-central', name: 'US South Central', states: ['TX', 'OK', 'AR'] },
  { id: 'us-mountain', name: 'US Mountain West', states: ['AZ', 'CO', 'NM', 'NV', 'UT', 'WY', 'MT', 'ID'] },
  { id: 'us-west-coast', name: 'US West Coast', states: ['CA', 'OR', 'WA'] },
]

export const GENERAL_NWS_NODE = 'global'

/** The NWS dashboard for a region-window node. */
export const nwsDashboardHref = (node: string = GENERAL_NWS_NODE) => `/travelrisk/region/${encodeURIComponent(node)}/nws`

/** True for an alert's own api.weather.gov / alerts.weather.gov link (raw JSON or CAP). */
export function isNwsAlertUrl(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const h = new URL(url).hostname.toLowerCase()
    return h === 'api.weather.gov' || h === 'alerts.weather.gov'
  } catch {
    return false
  }
}

/** "Henderson, NC; Transylvania, NC" → ['NC']. Marine zones and free text yield nothing. */
export function statesOfArea(area: string | null | undefined): string[] {
  const out = new Set<string>()
  for (const seg of (area ?? '').split(';')) {
    const m = /,\s*([A-Z]{2})\s*$/.exec(seg.trim())
    if (m) out.add(m[1])
  }
  return [...out].sort()
}

/** The US sub-region node that holds these states (the first state decides), or null. */
export function nwsNodeForStates(states: readonly string[] | null | undefined): string | null {
  for (const s of states ?? []) {
    const n = US_NWS_NODES.find((r) => r.states.includes(s.toUpperCase()))
    if (n) return n.id
  }
  return null
}

/** A signal's regionId is an ovix-api region id; the six US sub-regions have NWS dashboards of their own. */
export function nwsNodeForRegion(regionId: string | null | undefined): string | null {
  if (!regionId) return null
  return US_NWS_NODES.some((r) => r.id === regionId) ? regionId : null
}

/**
 * Where a warning should take the reader: its sub-region's NWS dashboard when the states or the
 * region say which, else the general one. `current` is the node of the page the reader is on; a
 * warning that would link back to the same dashboard gets null (render it as plain text).
 */
export function nwsHrefFor(w: { states?: readonly string[] | null; area?: string | null; regionId?: string | null }, current?: string | null): string | null {
  const node = nwsNodeForStates(w.states?.length ? w.states : statesOfArea(w.area)) ?? nwsNodeForRegion(w.regionId) ?? GENERAL_NWS_NODE
  if (current && node === current) return null
  return nwsDashboardHref(node)
}
