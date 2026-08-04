/**
 * TRAVELRISK PRESENTATION FILTER (hub-051, item 2/3)
 * ============================================================================
 * DEMOTION IS NOT DELETION.
 *
 * Ted, using the live surface on 2026-08-01: *"get rid of displaying anything
 * related to SEPTA, BART, CTA, etc… no interest in those here."*
 *
 * This module hides a small, NAMED set of producers **on the travelrisk surface
 * only**. It is a render-time filter and nothing else:
 *
 *   · `travel-intel` keeps polling every one of them, on the same cadence.
 *   · `signals.category` is untouched — these rows are still `travel`.
 *   · community.wfmlabs.com still shows all of them, because that surface never
 *     imports this module.
 *   · Nothing is deleted from Neon, and no row stops being written.
 *
 * The filter keys on `signals.source`, which the pipeline writes as
 * `travel-intel/{PRODUCER}` (measured live: travel-intel/CTA 42 · /FAA 38 ·
 * /TTC 24 · /News-Intel 21 · /TomTom 10 · /BART 9 · /MBTA 5 · /TfL 4 · /NWS 2).
 * Keying on the producer rather than on the title text is deliberate — a title
 * regex would silently start hiding an FAA advisory that happened to mention
 * a metro line.
 *
 * ── THE HONESTY OBLIGATION THAT COMES WITH HIDING THINGS ──────────────────
 * A surface that quietly drops rows is indistinguishable from a surface with
 * no data. So every place that applies this filter MUST also render
 * `hiddenNotice()` — the count and the reason, in words. The reader is always
 * told what was withheld and where to go to see it.
 */

export interface HiddenProducer {
  /** Exact `signals.source` value, lowercased for comparison. */
  source: string
  /** Short name for the disclosure line. */
  label: string
  /** Why this surface does not show it. Rendered to the reader. */
  why: string
  /** Grouping for the disclosure sentence. */
  group: 'urban transit' | 'marine' | 'road'
  /** True when Ted named this producer explicitly, false when FOREMAN extended. */
  namedByTed: boolean
}

/**
 * The deny-list. Every entry is justified individually so that adding to it is
 * a deliberate act with an argument attached, not a habit.
 *
 * SCOPE OF AUTHORITY, recorded honestly:
 *   · SEPTA / BART / CTA / TTC / MBTA — named by Ted directly.
 *   · NWS (marine) and TomTom (road) — named by FOREMAN in the hub-051 dispatch
 *     as agreed extensions.
 *   · TfL — NOT named by either. It is the London Underground / Elizabeth line
 *     and is the same class of object as the five Ted named ("TfL: Elizabeth
 *     line: Severe Delays"). Included so the rule is consistent rather than
 *     alphabetical, flagged `namedByTed: false`, and listed by name in the
 *     on-page disclosure so the decision is reviewable and one line to revert.
 */
export const TRAVELRISK_HIDDEN_PRODUCERS: readonly HiddenProducer[] = [
  { source: 'travel-intel/septa', label: 'SEPTA', group: 'urban transit', namedByTed: true,
    why: 'Philadelphia city transit. A bus detour does not move a flight.' },
  { source: 'travel-intel/bart', label: 'BART', group: 'urban transit', namedByTed: true,
    why: 'Bay Area city transit.' },
  { source: 'travel-intel/cta', label: 'CTA', group: 'urban transit', namedByTed: true,
    why: 'Chicago city transit — the highest-volume producer of the set.' },
  { source: 'travel-intel/ttc', label: 'TTC', group: 'urban transit', namedByTed: true,
    why: 'Toronto city transit.' },
  { source: 'travel-intel/mbta', label: 'MBTA', group: 'urban transit', namedByTed: true,
    why: 'Boston city transit.' },
  { source: 'travel-intel/tfl', label: 'TfL', group: 'urban transit', namedByTed: false,
    why: 'London Underground and Elizabeth line — the same class as the five above; included for consistency, not on instruction.' },
  { source: 'travel-intel/nws', label: 'NWS marine', group: 'marine', namedByTed: false,
    why: 'Coastal gale warnings. Real, and irrelevant to an airline schedule.' },
  { source: 'travel-intel/tomtom', label: 'TomTom', group: 'road', namedByTed: false,
    why: 'Road congestion and closures.' },
] as const

const HIDDEN_SET = new Set(TRAVELRISK_HIDDEN_PRODUCERS.map((p) => p.source))

/** Lowercased `signals.source` values this surface does not render. */
export const TRAVELRISK_HIDDEN_SOURCES: readonly string[] =
  TRAVELRISK_HIDDEN_PRODUCERS.map((p) => p.source)

/** True when a signal's `source` is demoted on this surface. */
export function isHiddenProducer(source: string | null | undefined): boolean {
  return HIDDEN_SET.has(String(source || '').trim().toLowerCase())
}

/** Filter any row carrying a `source`. Returns the kept rows AND the count
 *  withheld, because the count is not optional — see the header. */
export function applyProducerFilter<T extends { source?: string | null }>(
  rows: readonly T[],
): { kept: T[]; hidden: number } {
  const kept: T[] = []
  let hidden = 0
  for (const r of rows) {
    if (isHiddenProducer(r.source)) hidden++
    else kept.push(r)
  }
  return { kept, hidden }
}

/**
 * `travel-intel`'s own domain tiles (aviation / roads / transit / maritime /
 * intel) are aggregates over the producers above. A tile whose ENTIRE event
 * population is demoted here would be a score for something this surface does
 * not show, so it is hidden too — but ONLY when the whole population is gone.
 *
 * Derived, never hardcoded: `maritime` today is 21 events of which exactly one
 * is the NWS gale warning, so maritime SURVIVES and keeps its News-Intel
 * Red Sea / Hormuz shipping population. `transit` is 17 of 17 demoted, so it
 * goes. This self-corrects the moment the mix changes.
 */
export function tileIsFullyHidden(
  domain: string,
  events: readonly { domain?: string; source?: string | null }[],
): boolean {
  const d = String(domain || '').toLowerCase()
  const pop = events.filter((e) => String(e.domain || '').toLowerCase() === d)
  if (pop.length === 0) {
    // An empty tile can only be judged by its known producers. `roads` has
    // exactly one (TomTom) and it is demoted, so an empty roads tile is an
    // empty tile for something we do not show.
    return d === 'roads' || d === 'transit'
  }
  return pop.every((e) => isHiddenProducer(e.source))
}

/** The disclosure sentence. Never optional wherever the filter is applied. */
export function hiddenNotice(hidden: number): string {
  const groups = Array.from(new Set(TRAVELRISK_HIDDEN_PRODUCERS.map((p) => p.group)))
  const names = TRAVELRISK_HIDDEN_PRODUCERS.map((p) => p.label).join(', ')
  return (
    `${hidden} item${hidden === 1 ? '' : 's'} withheld from this view: ${groups.join(', ')} feeds ` +
    `(${names}). They are still collected on the same cadence, still carry category "travel", and ` +
    `are still shown in full on community.wfmlabs.com. This is a presentation filter for a ` +
    `flight-impact audience, not a change to what the platform monitors.`
  )
}
