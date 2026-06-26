/**
 * Beacon Case Canvas — evidence orchestration (WFM-91 / research-017).
 *
 * Turns a sharpened question into GRADED, BUCKETED evidence cards for the canvas pool. It REUSES the
 * research-014 retrieval stack wholesale — it does not re-implement retrieval:
 *   - embed.ts / retrieval.ts  → card-first bge-m3 kNN over research_cards (+ chunk + keyword recall)
 *   - deepread.ts              → one structured Claude pass grades each candidate (A–V) + extracts the
 *                                 specific finding + stance (the same appraiser the chat brief uses)
 *   - webreach.ts              → an Exa pass when internal coverage is thin OR mode==='web'
 * The only new step is `proposeArguments`: a small Claude call that proposes 2–4 argument buckets and
 * assigns each graded item to one — so the pool arrives pre-grouped for curation. No-fabrication is
 * preserved end-to-end: every card traces to a real paper (paper_id) or a real Exa result (url).
 */

import { embedQuery } from '@/lib/beacon/embed'
import {
  cardCandidates,
  semanticCandidates,
  keywordCandidates,
  mergeCandidates,
  attachCards,
  type RetrievedPaper,
} from '@/lib/beacon/retrieval'
import { deepRead, type Grade } from '@/lib/beacon/deepread'
import { webReach } from '@/lib/beacon/webreach'
import { callClaude } from '@/lib/beacon/claude'
import { classifyLibraryTier, classifyWebTier, enforceGrade, webBaseGrade } from '@/lib/beacon/tiers'
import {
  newCardId,
  toCardStance,
  type ArgumentBucket,
  type CardStance,
  type EvidenceCard,
  type EvidenceSource,
} from '@/lib/beacon/cases'
import { acquireAcademicIterated, clampAbstract, isStrongCard, STRONG_TARGET } from '@/lib/beacon/acquire'
import type { DeepRead } from '@/lib/beacon/deepread'
import type { Pool } from 'pg'
import type { getPayload } from 'payload'

type Payload = Awaited<ReturnType<typeof getPayload>>

const CANDIDATE_CAP = 10
const MIN_ONTOPIC = 2
const THIN_SIM = 0.5

/**
 * A short 2–3 sentence card abstract for a LIBRARY card (research-023): the research_card thesis +
 * lead finding, falling back to the paper's own abstract / extracted finding / why-it-matters.
 */
function libraryAbstract(r: DeepRead): string {
  const card = r.card
  const bits: string[] = []
  if (card?.thesis) bits.push(card.thesis.trim())
  const f = card?.keyFindings?.[0]
  if (f?.finding) bits.push(`${f.finding}${f.stat_or_quote ? ` (${f.stat_or_quote})` : ''}`.trim())
  const text = bits.join(' ').trim() || r.abstract || r.finding || r.whyItMatters || r.curatorSummary || ''
  return clampAbstract(text)
}

/**
 * Surface candidates for a query — CARD-FIRST bge-m3 kNN (research_cards) primary, chunk kNN blended
 * for passage recall, keyword LIKE fallback. Identical policy to /api/beacon/respond's `surface`,
 * with an `exclude` set so `expand` mode doesn't re-fetch papers already in the pool. Each candidate
 * carries its structured Research Card.
 */
async function surface(
  pool: Pool,
  payload: Payload,
  query: string,
  exclude: Set<number>,
): Promise<RetrievedPaper[]> {
  const vec = await embedQuery(query)
  let merged: RetrievedPaper[]
  if (vec) {
    const [cards, chunks] = await Promise.all([
      cardCandidates(pool, payload, vec, { paperK: CANDIDATE_CAP }),
      semanticCandidates(pool, payload, vec, { paperK: CANDIDATE_CAP }),
    ])
    const keyword = await keywordCandidates(payload, query, 6)
    merged = mergeCandidates(mergeCandidates(cards, chunks, CANDIDATE_CAP), keyword, CANDIDATE_CAP)
  } else {
    merged = await keywordCandidates(payload, query, CANDIDATE_CAP)
  }
  await attachCards(pool, merged)
  return merged.filter((p) => !exclude.has(p.id))
}

interface RawItem {
  claim: string
  grade: Grade
  source: EvidenceSource
  /** How this item bears on the position (research-026); undefined for un-appraised web hits. */
  stance?: CardStance
  /** 1–2 sentence why-applies note (research-026); undefined for un-appraised web hits. */
  relevance?: string
}

/** Build raw (ungrouped) evidence items from a deep-read of `question`, plus optional web-reach. */
async function gatherRawItems(
  pool: Pool,
  payload: Payload,
  question: string,
  exclude: Set<number>,
  opts: { maxSelect: number; forceWeb: boolean },
): Promise<RawItem[]> {
  const candidates = await surface(pool, payload, question, exclude)
  const deep = await deepRead(candidates, question, { maxSelect: opts.maxSelect })

  const items: RawItem[] = deep.selected.map((r) => {
    // Library cards are vetted research by default; classifyLibraryTier honors a V grade (interested)
    // and refines peer_reviewed/preprint/institutional from the paper's host when a URL exists.
    const tier = classifyLibraryTier({ url: r.url, grade: r.grade })
    return {
      claim: (r.finding || r.card?.thesis || r.title).trim(),
      grade: enforceGrade(r.grade, tier),
      stance: toCardStance(r.stance),
      relevance: r.rationale || undefined,
      source: {
        title: r.title,
        authors: r.authors,
        url: r.url,
        type: 'internal',
        paper_id: r.id,
        tier,
        abstract: libraryAbstract(r),
      },
    }
  })

  // Web-reach (Exa) when internal coverage is thin OR the caller forced it. Bounded to one call;
  // no-ops silently when EXA_API_KEY is unset. Cite ONLY the fetched highlight + URL.
  const onTopic = deep.selected.filter((s) => s.supports && s.grade !== '—').length
  const bestSim = Math.max(0, ...candidates.map((c) => c.bestSim ?? 0))
  const thin = onTopic < MIN_ONTOPIC || bestSim < THIN_SIM
  if (opts.forceWeb || thin) {
    const web = await webReach(question, { numResults: 6 })
    for (const w of web) {
      const claim = (w.highlights[0] || w.title).replace(/\s+/g, ' ').trim().slice(0, 600)
      if (!claim) continue
      // Classify the open-web hit by domain + fetched content; vendor blogs → V, general web caps at C.
      const tier = classifyWebTier(w.url, w.title, w.highlights.join(' '))
      items.push({
        claim,
        grade: enforceGrade(webBaseGrade(tier), tier),
        source: {
          title: w.title,
          authors: [],
          url: w.url,
          type: 'web',
          tier,
          abstract: clampAbstract(w.highlights.join(' '), 3, 420),
        },
      })
    }
  }
  return items
}

interface ProposedArgs {
  arguments: { key: string; label: string }[]
  assignments: { i: number; key: string }[]
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'argument'

/**
 * Propose 2–4 argument buckets for the question and assign each graded item to one (one Claude call).
 * Degrades gracefully: on any parse/transport failure every item lands in a single "Evidence" bucket
 * so the pool is never empty. Keys are normalized to slugs the UI can address.
 */
async function proposeArguments(question: string, items: RawItem[]): Promise<ProposedArgs> {
  const fallback = (): ProposedArgs => ({
    arguments: [{ key: 'evidence', label: 'Evidence' }],
    assignments: items.map((_, i) => ({ i, key: 'evidence' })),
  })
  if (items.length === 0) return { arguments: [], assignments: [] }

  const list = items
    .map((it, i) => `${i}. [${it.source.type}/${it.grade}] ${it.claim.slice(0, 280)}`)
    .join('\n')
  const system = `You organize graded evidence into argument buckets for an analyst's case.
Given a sharpened research question and a numbered list of evidence items (each tagged with its source type and A–V grade), propose 2–4 ARGUMENT BUCKETS — the distinct lines of reasoning the evidence falls into (e.g. "Cost impact", "Service quality", "The opposing case"). Then assign EVERY item to exactly one bucket by its number.
- Buckets are short noun phrases (2–5 words). Include an "opposing"/"steelman" bucket when items complicate the position.
- Assign every item index exactly once; do not invent items.
Respond with ONLY minified JSON: {"arguments":[{"key":"short-slug","label":"Human Label"}],"assignments":[{"i":0,"key":"short-slug"}]}`

  try {
    const raw = await callClaude(system, [{ role: 'user', content: `QUESTION:\n${question}\n\nITEMS:\n${list}` }], 900)
    const parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as ProposedArgs
    const args = (parsed.arguments || [])
      .filter((a) => a?.label)
      .map((a) => ({ key: slug(a.key || a.label), label: String(a.label).trim().slice(0, 60) }))
    if (args.length === 0) return fallback()
    const keys = new Set(args.map((a) => a.key))
    const fallbackKey = args[0].key
    const assignments = items.map((_, i) => {
      const a = (parsed.assignments || []).find((x) => x.i === i)
      const key = a && keys.has(slug(a.key)) ? slug(a.key) : fallbackKey
      return { i, key }
    })
    return { arguments: args, assignments }
  } catch (e) {
    console.error('[beacon/evidence] proposeArguments failed, single-bucket fallback:', String(e).slice(0, 160))
    return fallback()
  }
}

export interface BuiltEvidence {
  arguments: ArgumentBucket[]
  cards: EvidenceCard[]
}

/**
 * INITIAL / WEB build: deep-read the question, grade + web-reach, then bucket. Returns the full set
 * of argument buckets (with ordered card_ids) and the graded cards (all state='pool'). The route
 * persists these as the case's evidence_pool + arguments.
 */
export async function buildInitialEvidence(
  pool: Pool,
  payload: Payload,
  question: string,
  opts: { forceWeb?: boolean; exclude?: Set<number>; acquire?: boolean } = {},
): Promise<BuiltEvidence> {
  const exclude = opts.exclude ?? new Set<number>()
  const items = await gatherRawItems(pool, payload, question, exclude, { maxSelect: 6, forceWeb: !!opts.forceWeb })

  // ── Gap-driven, OUTCOME-DRIVEN academic acquisition (research-023 → strengthened in research-030) ──
  // Count STRONG cards (grade A/B AND a research tier). When the library + web-reach come up short on
  // the question, run acquisition as a BLOCKING pre-step that ITERATES across query variants until it
  // has added ≥STRONG_TARGET A/B-grade scholarly sources (or bounded-exhausts), ingesting the strong
  // relevant ones so the thin topic fills itself. Honest-gap preserved: if nothing grades B+, we keep
  // whatever weaker items it found and return — never fabricating strength.
  const strongCount = items.filter((it) => isStrongCard(it.grade, it.source.tier)).length
  if (opts.acquire !== false && strongCount < STRONG_TARGET) {
    const acq = await acquireAcademicIterated(payload, question)
    for (const a of acq.items) {
      items.push({ claim: a.claim, grade: a.grade, source: a.source, stance: a.stance, relevance: a.relevance })
    }
    if (acq.items.length) {
      const addedStrong = acq.items.filter((a) => isStrongCard(a.grade, a.source.tier)).length
      console.log(`[beacon/evidence] iterated acquisition: +${acq.items.length} scholarly cards (${addedStrong} strong A/B), ${acq.ingested} ingested (strong was ${strongCount}/${STRONG_TARGET})`)
    }
  }

  const { arguments: args, assignments } = await proposeArguments(question, items)

  const buckets: ArgumentBucket[] = args.map((a) => ({ key: a.key, label: a.label, card_ids: [] }))
  const byKey = new Map(buckets.map((b) => [b.key, b]))
  const cards: EvidenceCard[] = items.map((it, i) => {
    const key = assignments.find((x) => x.i === i)?.key ?? buckets[0]?.key ?? 'evidence'
    const card: EvidenceCard = {
      id: newCardId(),
      claim: it.claim,
      grade: it.grade,
      source: it.source,
      supports_argument: key,
      state: 'pool',
      stance: it.stance,
      relevance: it.relevance,
    }
    byKey.get(key)?.card_ids.push(card.id)
    return card
  })
  return { arguments: buckets, cards }
}

/**
 * EXPAND build: fetch N more cards for ONE existing bucket (no re-bucketing). The new cards are
 * assigned straight to `bucketKey`; the route appends them to evidence_pool and that bucket's
 * card_ids. `existingPaperIds` excludes papers already in the pool so expand returns fresh evidence.
 * `forceWeb` (the +web action) forces an Exa pass even when internal coverage is fine.
 */
export async function buildExpandEvidence(
  pool: Pool,
  payload: Payload,
  question: string,
  bucketKey: string,
  opts: { forceWeb?: boolean; exclude?: Set<number>; count?: number } = {},
): Promise<EvidenceCard[]> {
  const exclude = opts.exclude ?? new Set<number>()
  const items = await gatherRawItems(pool, payload, question, exclude, {
    maxSelect: opts.count ?? 3,
    forceWeb: !!opts.forceWeb,
  })
  return items.map((it) => ({
    id: newCardId(),
    claim: it.claim,
    grade: it.grade,
    source: it.source,
    supports_argument: bucketKey,
    state: 'pool',
    stance: it.stance,
    relevance: it.relevance,
  }))
}
