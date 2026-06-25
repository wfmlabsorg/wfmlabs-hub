/**
 * Beacon "publish to corpus" mapping (research-029 / WFM-103) — the flywheel.
 *
 * A finished Beacon paper draft (the `paper.draft` JSONB produced by research-027) can be published
 * into WFM Labs' OWN research corpus so that, once a curator ratifies it, it becomes citable in future
 * Beacon cases. This module is the PURE mapping from a `PaperDraft` → the `papers`-collection row data
 * the publish route writes. No I/O here (kept side-effect-free so it is trivially unit-testable);
 * the route owns auth, ownership, Payload create/update, and persisting the case-paper status.
 *
 * Design choices:
 *  - The corpus row lands at status `proposed` (the route sets it) — NEVER auto-published. A
 *    curator/FOREMAN ratifies it to `published`, which triggers card+embed (see lib/papers/cardEmbed).
 *  - `sourceUrl` is a STABLE canonical internal URL keyed only on the case id (host hard-pinned to the
 *    production host, NOT the deploy env) so it is a deterministic dedup key — re-publishing the same
 *    case updates the same corpus row instead of creating duplicates.
 *  - `sourceType` uses the nearest existing Papers.ts enum, `manual` (an internally-authored paper,
 *    not harvested from arXiv/journal/etc); the synthesis provenance is made explicit via
 *    `sourceName`, the authorship line, and the Provenance block appended to `fullText`.
 *  - `fullText` is the assembled body (abstract→conclusion + references + provenance). It is the
 *    machine-readable corpus text the card/embed pipeline reads to make the paper retrievable.
 */

import type { PaperDraft, PaperReference } from '@/lib/beacon/cases'

/** The `papers.category` enum (mirrors Papers.ts) — keeps the corpus row type-safe. */
export type PaperCategory =
  | 'queuing-theory'
  | 'ai-machine-learning'
  | 'operations-management'
  | 'workforce-management'
  | 'customer-experience'
  | 'analytics-forecasting'
  | 'process-optimization'
  | 'technology'
  | 'economics-finance'
  | 'employee-wellbeing'
  | 'contact-center-operations'
  | 'scheduling-optimization'
  | 'other'

/** Hard-pinned production host so the dedup key is deterministic across deploy environments. */
export const CORPUS_HOST = 'https://community.wfmlabs.com'

/** The stable canonical internal URL for a published case paper — the corpus dedup key. */
export function corpusCaseUrl(caseId: number): string {
  return `${CORPUS_HOST}/research/paper/${caseId}`
}

/** URL-safe slug, stabilised by the case id so re-publish keeps one row and cases never collide. */
export function corpusPaperSlug(title: string, caseId: number): string {
  const base = (title || 'beacon-paper')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70)
  return `${base || 'beacon-paper'}-case-${caseId}`
}

/** One reference rendered as a plain-text bibliography line: "[E1] Title — Authors. url (doi)". */
function formatReference(r: PaperReference): string {
  const authors = r.authors?.length ? r.authors.join(', ') : 'Unknown'
  const locator = r.doi ? `https://doi.org/${r.doi.replace(/^https?:\/\/doi\.org\//i, '')}` : r.url
  return `[${r.ref}] ${r.title} — ${authors}.${locator ? ` ${locator}` : ''}`
}

/**
 * Assemble the publishable body (plain text/markdown) from the draft's sections, in reading order,
 * followed by the server-built reference list and a provenance footer. The reference list is taken
 * straight from `draft.references` (built server-side by the paper engine from sources actually read —
 * never fabricated), so the corpus body's bibliography inherits that no-fabrication guarantee.
 */
export function assembleFullText(draft: PaperDraft, caseId: number, memberUsername: string): string {
  const sections: Array<[string, string | undefined]> = [
    ['Abstract', draft.abstract],
    ['Introduction', draft.introduction],
    ['Position', draft.theory],
    ['Evidence', draft.evidence_for],
    ['Counter-Case and Limitations', draft.counter_case_and_limitations],
    ['Discussion', draft.discussion],
    ['Conclusion', draft.conclusion],
  ]
  const body = sections
    .filter(([, text]) => text && text.trim())
    .map(([heading, text]) => `## ${heading}\n\n${(text as string).trim()}`)
    .join('\n\n')

  const refs = (draft.references || []).length
    ? `## References\n\n${draft.references.map(formatReference).join('\n\n')}`
    : ''

  const sourcePaperIds = Array.from(
    new Set((draft.references || []).map((r) => r.paper_id).filter((id): id is number => typeof id === 'number')),
  )
  const provenance = [
    '---',
    `*Provenance: original WFM Labs synthesis developed via Beacon from case #${caseId}, ` +
      `commissioned by @${memberUsername}. It synthesises ${draft.references?.length ?? 0} source(s) ` +
      `read by the paper engine (supporting + counter-search evidence).` +
      (sourcePaperIds.length ? ` Source library paper ids: ${sourcePaperIds.join(', ')}.` : '') +
      '*',
  ].join('\n')

  return [body, refs, provenance].filter(Boolean).join('\n\n')
}

/** The Papers-collection fields derived purely from the draft. The route adds primaryContributor + status. */
export interface CorpusPaperData {
  title: string
  slug: string
  sourceUrl: string
  sourceType: 'manual'
  sourceName: string
  paperType: 'literature-review'
  category: PaperCategory
  authors: { name: string; affiliation?: string }[]
  abstract?: string
  fullText: string
  description?: string
}

/**
 * Map a finished `PaperDraft` to the corpus `papers` row data. Pure: the route supplies identity
 * (caseId, member) and owns the write + status. Authorship is "Beacon / @member" per the spec.
 */
export function buildCorpusPaperData(
  draft: PaperDraft,
  opts: { caseId: number; memberUsername: string; category?: PaperCategory },
): CorpusPaperData {
  const title = (draft.title || `Beacon synthesis — case #${opts.caseId}`).trim()
  const abstract = draft.abstract?.trim() || undefined
  return {
    title,
    slug: corpusPaperSlug(title, opts.caseId),
    sourceUrl: corpusCaseUrl(opts.caseId),
    sourceType: 'manual',
    sourceName: 'Beacon Synthesis (WFM Labs)',
    paperType: 'literature-review',
    category: opts.category || 'workforce-management',
    authors: [
      { name: 'Beacon', affiliation: 'WFM Labs' },
      { name: `@${opts.memberUsername}` },
    ],
    abstract,
    fullText: assembleFullText(draft, opts.caseId, opts.memberUsername),
    description: abstract?.slice(0, 280) || `Beacon synthesis from case #${opts.caseId}.`,
  }
}
