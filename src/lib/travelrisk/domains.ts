/**
 * TRAVEL-FIRST DOMAIN ORDERING (hub-047)
 * ----------------------------------------------------------------------------
 * PRESENTATION ONLY. This file re-ORDERS the canonical 12 domains for the
 * travelrisk surface. It does not add a domain, rename one, remove one from the
 * taxonomy, or touch scoring / declare logic anywhere. Ted's standing constraint
 * (2026-07-29) is that the major categories do not change — and they don't:
 * `ovix-api` still publishes all 12, scored identically, and community.wfmlabs.com
 * still renders them in its own order.
 *
 * The rank is by IMPACT ON A FLIGHT IN THE NEXT 48 HOURS. Each `why` is the
 * defence of that rank (01-Source/TRAVELRISK-SITE-SPEC.md §2) and is rendered
 * on the board, so the ordering argues for itself rather than looking arbitrary.
 *
 * ── THE OPEN AMBIGUITY, PRESERVED ──────────────────────────────────────────
 * Ted said "the 10 buckets"; the platform has 12. All 12 are built here, in
 * this order. Dropping to 10 is the ONE LINE marked below — not a refactor.
 * The two that would go are ranks 11-12 (supply_chain, financial): they matter
 * to a travel business but rarely to a flight in the next 48 hours. Do NOT drop
 * them without Ted's word. Demotion is not deletion.
 */

export interface TravelRiskDomain {
  /** Canonical domain key as published by `ovix-api` /api/ovix/op-risk. */
  domain: string
  label: string
  /** 1-based flight-impact rank. */
  rank: number
  /** Why it sits here for aviation — rendered on the board. */
  why: string
}

export const TRAVELRISK_DOMAIN_ORDER: readonly TravelRiskDomain[] = [
  { domain: 'travel', rank: 1, label: 'Travel', why: 'The direct signal — ground stops, carrier IROPS, GDS outages, rail.' },
  { domain: 'weather', rank: 2, label: 'Weather', why: 'The single largest cause of delay and cancellation worldwide.' },
  { domain: 'infrastructure', rank: 3, label: 'Infrastructure', why: 'ATC system outages, airport power, telecom, cloud and booking dependencies.' },
  { domain: 'labor', rank: 4, label: 'Labor', why: 'ATC, airline and ground-handler strikes — routinely closes European airspace.' },
  { domain: 'geopolitical', rank: 5, label: 'Geopolitical', why: 'Airspace closures, overflight bans, conflict-zone reroutes.' },
  { domain: 'cyber', rank: 6, label: 'Cyber', why: 'Airline IT and GDS compromise — the AA-class event.' },
  { domain: 'seismic', rank: 7, label: 'Seismic', why: 'Volcanic ash is a first-order aviation hazard; quakes close airports.' },
  { domain: 'disaster', rank: 8, label: 'Disaster', why: 'Airport closure, mass evacuation, terminal damage.' },
  { domain: 'health', rank: 9, label: 'Health', why: 'Entry rules, screening, quarantine — border friction.' },
  { domain: 'environmental', rank: 10, label: 'Environmental', why: 'Smoke, ash dispersion and air quality affecting operations.' },
  { domain: 'supply_chain', rank: 11, label: 'Supply Chain', why: 'Jet fuel, parts, catering.' },
  { domain: 'financial', rank: 12, label: 'Financial', why: 'Carrier solvency, fuel cost.' },
] as const

/**
 * ── THE ONE LINE ────────────────────────────────────────────────────────────
 * The visible set. Showing all 12 today.
 * To show Ted's "10 buckets" instead, and ONLY on his word, change this to:
 *     TRAVELRISK_DOMAIN_ORDER.slice(0, 10)
 * (ranks 11-12 — supply_chain, financial — are ordered last precisely so that
 * the curated 10 is a slice and never a hand-maintained second list.)
 */
export const TRAVELRISK_VISIBLE_DOMAINS: readonly TravelRiskDomain[] = TRAVELRISK_DOMAIN_ORDER

/** Domains hidden by the visible-set line above — named, never silently dropped. */
export const TRAVELRISK_HIDDEN_DOMAINS: readonly TravelRiskDomain[] =
  TRAVELRISK_DOMAIN_ORDER.filter((d) => !TRAVELRISK_VISIBLE_DOMAINS.includes(d))

/**
 * ── PER-DOMAIN RISK MAP ROUTING (hub-051 item 4) ───────────────────────────
 * Ted, 2026-08-01: *"build out links to each of our Risk area maps so that we
 * can open a new page with Weather or Disaster or Travel and see those
 * scorecard maps."*
 *
 * TWELVE REAL, LINKABLE URLS — not a client-side switcher. `/travelrisk/risk/
 * supply-chain` is a page a reader can bookmark, paste into a ticket, and open
 * in a second tab beside another one. A switcher would have been less code and
 * a worse instrument.
 *
 * The canonical domain key keeps its underscore (`supply_chain`) because that
 * is what ovix-api publishes and nothing on this surface may rename a domain.
 * Only the URL segment is hyphenated.
 */
export function domainSlug(domain: string): string {
  return domain.replace(/_/g, '-')
}

/** Resolve a URL segment back to canonical domain metadata, or undefined. */
export function domainFromSlug(slug: string | null | undefined): TravelRiskDomain | undefined {
  const key = String(slug || '').trim().toLowerCase().replace(/-/g, '_')
  return TRAVELRISK_DOMAIN_ORDER.find((d) => d.domain === key)
}

/** Canonical href for a domain's risk-map page. */
export function domainHref(domain: string): string {
  return `/travelrisk/risk/${domainSlug(domain)}`
}

const RANK = new Map(TRAVELRISK_DOMAIN_ORDER.map((d) => [d.domain, d.rank]))

/** Flight-impact rank for a domain key; unknown domains sort last, stably. */
export function travelRank(domain: string | null | undefined): number {
  return RANK.get((domain || '').toLowerCase()) ?? 999
}

/** Metadata for a domain key, or undefined if it is outside the canonical 12. */
export function travelDomainMeta(domain: string | null | undefined): TravelRiskDomain | undefined {
  const k = (domain || '').toLowerCase()
  return TRAVELRISK_DOMAIN_ORDER.find((d) => d.domain === k)
}

/** Stable sort of anything carrying a domain into flight-impact order. */
export function sortByTravelRank<T>(items: T[], key: (t: T) => string | null | undefined): T[] {
  return items
    .map((item, i) => ({ item, i, r: travelRank(key(item)) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.item)
}

/**
 * Domain keys the travel-first ticker should surface first. Used as an OPT-IN
 * re-sort of the shared globe hero — it reorders, it never filters, so nothing
 * disappears from a surface that claims to monitor everything.
 */
export const TRAVELRISK_PRIORITY_CATEGORIES: readonly string[] =
  TRAVELRISK_DOMAIN_ORDER.map((d) => d.domain)
