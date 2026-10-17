/**
 * HIBERNATED SCOUTS AND DOMAINS — a decision, not an outage
 * ============================================================================
 * Ted, 2026-09-05: the fleet's scope is strictly the travel industry. The roc
 * repo carried that out in `wfmlabsorg/roc` commit `05bdfff` (PR #129, merged
 * and deployed 2026-10-04): four scouts had their schedules emptied
 * (`crons = []  # HIBERNATED 2026-09-05 …` in each `wrangler.toml`), and
 * scout-triage was repurposed from health (Triage) to hospitality (Concierge).
 * The workers stay deployed; nothing polls. Re-enabling one is a matter of
 * restoring its schedule in roc — and then removing its row here.
 *
 * Before this module the hub rendered the consequence of that decision as a
 * fault: the pipeline-health route reported the four scouts `DOWN` and their
 * domains `STALE`, and the op-risk boards printed `NO READING` for financial,
 * supply chain and environmental as if a feed had failed. Both are untrue. This
 * is the one typed record of what was switched off on purpose, so every surface
 * can say so in words instead.
 *
 * PRESENTATION ONLY. Nothing here changes a score, a threshold or the canonical
 * 12-domain taxonomy — ovix-api (roc) still publishes all 12 domains, and the
 * three below simply arrive as `available: false / empty_window`.
 */

/** The roc commit that hibernated the scouts (wfmlabsorg/roc PR #129). */
export const HIBERNATION_COMMIT = '05bdfff'
/** When Ted made the call (the date in each `crons = []` comment). */
export const HIBERNATION_DECIDED = '2026-09-05'
/** When it took effect — #129 merged and deployed; last scout writes land this day. */
export const HIBERNATION_EFFECTIVE = '2026-10-04'

/** Short reader-facing label for a hibernated domain. Muted, never amber/red. */
export const HIBERNATED_DOMAIN_LABEL = 'hibernated — not a traveler-care input'

export interface HibernatedScout {
  /** `news_events.scout_agent` value. */
  scout: string
  /** roc worker directory / wrangler `name`. */
  worker: string
  /** Canonical domain the scout fed. */
  domain: string
  /** Why it was hibernated — from the roc commit / wrangler comment. */
  reason: string
}

export const HIBERNATED_SCOUTS: Readonly<Record<string, HibernatedScout>> = {
  Canary: {
    scout: 'Canary', worker: 'scout-canary', domain: 'environmental',
    reason: 'Not a traveler-care volatility input.',
  },
  Convoy: {
    scout: 'Convoy', worker: 'scout-convoy', domain: 'supply_chain',
    reason: 'Supply chain is ports and freight, not a traveler-care input.',
  },
  Ledger: {
    scout: 'Ledger', worker: 'scout-ledger', domain: 'financial',
    reason: 'Not a traveler-care volatility input.',
  },
  Richter: {
    scout: 'Richter', worker: 'scout-richter', domain: 'seismic',
    reason: 'USGS/EMSC already feed the seismic lane deterministically; the news scout was redundant.',
  },
}

export interface RenamedScout {
  from: string
  to: string
  worker: string
  since: string
  note: string
}

/**
 * scout-triage still runs — as Concierge. Its historical `news_events` rows
 * carry `scout_agent = 'Triage'`, which would otherwise surface as a dead scout.
 */
export const RENAMED_SCOUTS: Readonly<Record<string, RenamedScout>> = {
  Triage: {
    from: 'Triage', to: 'Concierge', worker: 'scout-triage', since: HIBERNATION_DECIDED,
    note: 'Repurposed from health to hospitality (api-061). Health signals still arrive via sentinel.',
  },
}

export interface HibernatedDomain {
  domain: string
  /** The hibernated scout(s) that were this domain's only dedicated feed. */
  scouts: string[]
  reason: string
}

/**
 * Domains whose ONLY dedicated feed is a hibernated scout. Seismic is NOT here:
 * Richter was hibernated, but USGS/EMSC still score that lane, so a silent
 * seismic lane is a real gap. Health is not here either (sentinel feeds it).
 */
export const HIBERNATED_DOMAINS: Readonly<Record<string, HibernatedDomain>> = {
  environmental: { domain: 'environmental', scouts: ['Canary'], reason: HIBERNATED_SCOUTS.Canary.reason },
  supply_chain: { domain: 'supply_chain', scouts: ['Convoy'], reason: HIBERNATED_SCOUTS.Convoy.reason },
  financial: { domain: 'financial', scouts: ['Ledger'], reason: HIBERNATED_SCOUTS.Ledger.reason },
}

/** Hibernation record for a canonical domain key, or undefined if it is live. */
export function hibernatedDomain(domain: string | null | undefined): HibernatedDomain | undefined {
  return HIBERNATED_DOMAINS[(domain || '').toLowerCase()]
}

/** One-line tooltip / trace text for a hibernated domain. */
export function hibernationNote(h: HibernatedDomain): string {
  return `${h.scouts.join(', ')} hibernated by decision ${HIBERNATION_DECIDED} (roc ${HIBERNATION_COMMIT}): ${h.reason}`
}
