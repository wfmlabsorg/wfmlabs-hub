import type { OpRiskPayload, OpRiskDomainEntry } from '@/lib/scoreState'
import type { RegionRiskNode } from '@/components/travelrisk/RegionRiskMap'

/**
 * REGION-SCOPED op-risk reader for the per-domain risk maps (hub-051 item 4).
 * ============================================================================
 * CONSUMES PUBLISHED ENDPOINTS ONLY (01-Source/DATA-PLANE-CONTRACT.md). No new
 * endpoint was added for this, no Neon is touched, and not one score is
 * computed here — every number is read straight off `ovix-api`, which already
 * publishes exactly what these pages need:
 *
 *   GET /api/ovix/regions                        the taxonomy + each node's
 *                                                canonical lat/lon
 *   GET /api/ovix/op-risk?scope=region&region=X  all 12 domains for one node
 *
 * ── WHY THE FAN-OUT IS ACCEPTABLE ────────────────────────────────────────
 * 43 requests (5 macro + 38 sub) per render looks alarming until you measure
 * it: the region scope is a precomputed table read in `ovix-api`, ~117 ms
 * round-trip, and they go out in parallel behind Next's fetch cache with a
 * 5-minute revalidate — which is well inside the index's own 10-minute
 * recompute cadence, so a shorter window would only buy staler-looking data.
 * The alternative — asking API fleet for a bulk endpoint — is the right long
 * term answer and is REPORTED as a gap rather than smuggled in here; the
 * data-plane contract is explicit that a consumer does not add an endpoint to
 * dodge one.
 *
 * ── THE HONESTY RULE, CARRIED INTO THE REGION SCOPE ──────────────────────
 * `ovix-api` publishes `available: false` alongside `score: 1` and
 * `level: "NORMAL"` for a domain with no events in that scope. Measured live:
 * 6 of 12 domains in North America, 6 of 12 in APAC, 8 of 12 in US Northeast.
 * Passing that through as a calm NORMAL would render "we have nothing" as "it
 * is fine" — the exact inversion this surface exists to refuse — so
 * `available` is carried all the way to the marker, which draws hollow.
 */

const OVIX_API = 'https://ovix-api.tedlango.workers.dev'
const REVALIDATE = 300

interface RegionNode { id: string; name: string; parent: string | null; lat: number; lon: number }
interface RegionsPayload {
  macroRegions?: RegionNode[]
  subRegions?: RegionNode[]
  metros?: RegionNode[]
}

async function j<T>(url: string, revalidate = REVALIDATE): Promise<T | null> {
  try {
    const r = await fetch(url, { next: { revalidate } })
    if (!r.ok) return null
    return (await r.json()) as T
  } catch {
    return null
  }
}

export async function fetchRegions(): Promise<RegionsPayload | null> {
  return j<RegionsPayload>(`${OVIX_API}/api/ovix/regions`, 3600)
}

export async function fetchGlobalOpRisk(): Promise<OpRiskPayload | null> {
  return j<OpRiskPayload>(`${OVIX_API}/api/ovix/op-risk?scope=global`, 120)
}

export interface RegionRiskResult {
  nodes: RegionRiskNode[]
  /** Nodes whose op-risk call did not answer at all — a gap, reported as one. */
  unreachable: number
  /** Total taxonomy nodes we asked about. */
  asked: number
}

/**
 * One domain's index across the region taxonomy.
 *
 * METROS ARE NOT INCLUDED. There are 133 of them and they are a level of
 * granularity this map cannot draw legibly at world scale — 133 overlapping
 * discs is the centroid smear PR#10/#11 taught us about, in a new costume. The
 * omission is stated on the page rather than left for a reader to notice.
 */
export async function fetchRegionRisk(domain: string): Promise<RegionRiskResult> {
  const regions = await fetchRegions()
  const macro = regions?.macroRegions || []
  const sub = regions?.subRegions || []
  const all: { node: RegionNode; tier: 'macro' | 'sub' }[] = [
    ...macro.map((node) => ({ node, tier: 'macro' as const })),
    ...sub.map((node) => ({ node, tier: 'sub' as const })),
  ].filter((x) => typeof x.node.lat === 'number' && typeof x.node.lon === 'number')

  const payloads = await Promise.all(
    all.map((x) =>
      j<OpRiskPayload>(
        `${OVIX_API}/api/ovix/op-risk?scope=region&region=${encodeURIComponent(x.node.id)}`,
      ),
    ),
  )

  let unreachable = 0
  const nodes: RegionRiskNode[] = []
  const key = domain.toLowerCase()

  all.forEach((x, i) => {
    const payload = payloads[i]
    if (!payload) {
      unreachable++
      // A region we could not read is NOT a region with no risk. It is carried
      // onto the map as an explicit no-reading mark, never dropped — dropping
      // it would shrink the map every time the API hiccuped and nobody would
      // ever know the difference.
      nodes.push({
        id: x.node.id, name: x.node.name, lat: x.node.lat, lon: x.node.lon, tier: x.tier,
        score: null, level: null, available: false, eventCount: null,
        topEvent: null, state: null,
      })
      return
    }
    const entry: OpRiskDomainEntry | undefined = (payload.domains || []).find(
      (d) => (d.domain || '').toLowerCase() === key,
    )
    const available = !!entry && entry.available !== false && typeof entry.score === 'number'
    nodes.push({
      id: x.node.id,
      name: x.node.name,
      lat: x.node.lat,
      lon: x.node.lon,
      tier: x.tier,
      score: available ? (entry!.score as number) : null,
      level: entry?.level ?? null,
      available,
      eventCount: typeof entry?.eventCount === 'number' ? entry.eventCount : null,
      topEvent: entry?.topEvent ?? null,
      state: entry?.state ?? null,
    })
  })

  return { nodes, unreachable, asked: all.length }
}
