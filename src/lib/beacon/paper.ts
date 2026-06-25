/**
 * Beacon Paper Pipeline — Deep Engagement + publishable draft (research-027 / WFM-101). CENTERPIECE.
 *
 * `/api/beacon/assemble` writes a brief from the curated cards (digest-level). The Paper Pipeline goes
 * DEEPER: it reads the cased papers' FULL TEXT, actively hunts for DISCONFIRMING evidence (the
 * rigorous steelman), and drafts a balanced, honestly-cited publishable paper. The flow:
 *
 *   1. DEEP SUPPORTING READ — load papers.full_text for each cased paper (≤ MAX_FULLTEXT; fallback
 *      research-card + abstract when no full text) and render the richest evidence block via
 *      deepread.assembleEvidence(finalist=true).
 *   2. COUNTER-SEARCH (ONE pass) — re-query the library kNN (retrieval) AND Exa/Crossref academic
 *      (acquire) specifically for evidence that CHALLENGES the assembled position. Library hits are
 *      deep-read in full; acquired hits read their fetched abstract. Disconfirming = a hit that
 *      SUPPORTS the counter-question.
 *   3. SYNTHESIS — ONE Claude call over the supporting [E#] + challenging [C#] material produces both
 *      the structured engagement {supporting, challenging, tensions} AND the paper draft sections.
 *
 * Cost is bounded to THREE Claude calls (library counter deep-read + acquire's appraiser + synthesis)
 * plus the full text of ≤ MAX_FULLTEXT cased papers. No-fabrication is enforced structurally: every
 * citation ref must resolve to a source we actually read (fabricated refs are dropped), and the
 * reference list is built SERVER-SIDE from the read set — the model can never invent a source.
 */

import { callClaude } from './claude'
import { acquireAcademic } from './acquire'
import { embedQuery } from './embed'
import {
  cardCandidates,
  semanticCandidates,
  mergeCandidates,
  attachCards,
  toRetrieved,
  loadPaperDocs,
  type RetrievedPaper,
} from './retrieval'
import { deepRead, assembleEvidence, type Grade } from './deepread'
import { classifyLibraryTier, enforceGrade, tierLabel } from './tiers'
import type {
  BeaconCase,
  CasePaper,
  EvidenceCard,
  PaperDraft,
  PaperEngagement,
  PaperFinding,
  PaperReference,
  PaperTension,
  SourceTier,
} from './cases'
import type { getPayload } from 'payload'
import type { Pool } from 'pg'

type Payload = Awaited<ReturnType<typeof getPayload>>

// ── cost bounds ──
/** Cased papers we read in full text (the deep supporting pass). */
const MAX_FULLTEXT = 8
/** Disconfirming sources surfaced by the single counter-search pass. */
const MAX_CHALLENGING = 6
/** Library candidates deep-read in the counter pass. */
const COUNTER_CANDIDATES = 8
/** Output token ceiling for the synthesis call (engagement + full draft). */
const SYNTH_MAX_TOKENS = 5200

const GRADE_RANK: Record<Grade, number> = { A: 0, B: 1, C: 2, D: 3, V: 4, '—': 5 }

/**
 * One source the engine actually READ — the unit citations resolve to. `ref` (E#/C#) is what the
 * draft cites inline; `content` is the deep block handed to the synthesis call; `read` records depth.
 */
interface ReadSource {
  ref: string
  origin: 'cased' | 'counter'
  title: string
  authors: string[]
  url: string
  tier?: SourceTier
  grade: Grade
  paper_id?: number
  doi?: string
  read: 'full_text' | 'card_abstract' | 'abstract'
  /** Headline finding/claim (used in the prompt header + as a fallback statement). */
  claim: string
  /** The evidence block the model reasons over (full text / card / abstract, budgeted). */
  content: string
}

/** Extract a DOI from a URL/identifier if present (for the reference list). */
function doiOf(url: string): string | undefined {
  const m = /\b(10\.\d{4,9}\/[-._;()/:a-z0-9]+)/i.exec(url || '')
  return m ? m[1] : undefined
}

/**
 * STEP 1 — deep supporting read of the cased papers. Loads papers.full_text for the internal cased
 * cards (bounded to MAX_FULLTEXT, strongest grades first) and renders the richest evidence block;
 * web/own-data cards (no paper_id) fall back to their claim + card abstract. `refOf` mirrors
 * assemble's E# scheme so a paper drafted later lines up with the brief.
 */
async function readCasedFullText(
  pool: Pool,
  payload: Payload,
  cased: EvidenceCard[],
  refOf: Map<string, string>,
): Promise<ReadSource[]> {
  const ordered = [...cased]
    .sort((a, b) => (GRADE_RANK[a.grade] ?? 9) - (GRADE_RANK[b.grade] ?? 9))
    .slice(0, MAX_FULLTEXT)

  const internalIds = ordered
    .map((c) => c.source.paper_id)
    .filter((id): id is number => typeof id === 'number')

  // Load the full paper docs + hydrate their research cards (reusing retrieval's own mappers).
  const docs = await loadPaperDocs(payload, internalIds)
  const byId = new Map<number, RetrievedPaper>()
  for (const [id, doc] of docs) byId.set(id, toRetrieved(doc, null, []))
  await attachCards(pool, [...byId.values()])

  const out: ReadSource[] = []
  for (const c of ordered) {
    const ref = refOf.get(c.id) || 'E?'
    const pid = c.source.paper_id
    const rp = pid != null ? byId.get(pid) : undefined
    let read: ReadSource['read']
    let content: string
    if (rp) {
      // assembleEvidence(finalist=true) prefers full text (≤5200 chars), else card + abstract.
      content = assembleEvidence(rp, true)
      read = rp.fullText ? 'full_text' : rp.card ? 'card_abstract' : 'abstract'
    } else {
      read = 'abstract'
      content = [c.claim && `CLAIM: ${c.claim}`, c.source.abstract && `ABSTRACT: ${c.source.abstract}`]
        .filter(Boolean)
        .join('\n')
    }
    out.push({
      ref,
      origin: 'cased',
      title: c.source.title,
      authors: c.source.authors || [],
      url: c.source.url || '',
      tier: c.source.tier,
      grade: c.grade,
      paper_id: pid,
      doi: doiOf(c.source.url || ''),
      read,
      claim: c.claim,
      content,
    })
  }
  return out
}

/**
 * STEP 2 — the single counter-search pass. Builds a counter-question targeting the assembled position,
 * then surfaces disconfirming evidence from BOTH the library (kNN deep-read in full) and Exa/Crossref
 * academic (acquire). A hit that SUPPORTS the counter-question is, by construction, a CHALLENGE to the
 * member's position. Excludes papers already cased (don't re-cite the member's own evidence as a
 * counter) and dedups by paper_id/url. Refs are C1..Cn. Never throws — degrades to whatever it found.
 */
async function counterSearch(
  pool: Pool,
  payload: Payload,
  position: string,
  question: string,
  excludePaperIds: Set<number>,
  excludeUrls: Set<string>,
): Promise<ReadSource[]> {
  const counterQuery =
    `Rigorous evidence that CHALLENGES, contradicts, qualifies, or bounds the following position: ` +
    `"${position.slice(0, 700)}". Original question: ${question}. ` +
    `Surface disconfirming findings, null/negative results, boundary conditions, conflicting studies, and methodological critiques.`

  const found: ReadSource[] = []
  const seenUrl = new Set<string>(excludeUrls)

  // (a) Library kNN counter — deep-read in full text.
  try {
    const vec = await embedQuery(counterQuery)
    if (vec) {
      const [cards, chunks] = await Promise.all([
        cardCandidates(pool, payload, vec, { paperK: 6 }),
        semanticCandidates(pool, payload, vec, { paperK: 6 }),
      ])
      const candidates = mergeCandidates(cards, chunks, COUNTER_CANDIDATES).filter(
        (p) => !excludePaperIds.has(p.id),
      )
      await attachCards(pool, candidates)
      if (candidates.length > 0) {
        const dr = await deepRead(candidates, counterQuery, { maxSelect: 4 })
        for (const r of dr.selected) {
          if (!r.supports || r.grade === '—' || !r.finding) continue
          const url = r.url || ''
          if (url && seenUrl.has(url)) continue
          if (url) seenUrl.add(url)
          const tier = classifyLibraryTier({ url, grade: r.grade })
          found.push({
            ref: '',
            origin: 'counter',
            title: r.title,
            authors: r.authors || [],
            url,
            tier,
            grade: enforceGrade(r.grade, tier),
            paper_id: r.id > 0 ? r.id : undefined,
            doi: doiOf(url),
            read: r.fullText ? 'full_text' : r.card ? 'card_abstract' : 'abstract',
            claim: r.finding,
            content: assembleEvidence(r, true),
          })
        }
      }
    }
  } catch (e) {
    console.error('[beacon/paper] library counter-search skipped:', String(e).slice(0, 160))
  }

  // (b) Exa/Crossref academic counter (acquire) — reads fetched abstracts; ingests strong ones.
  try {
    const acq = await acquireAcademic(payload, counterQuery)
    for (const it of acq.items) {
      const url = it.source.url || ''
      if (url && seenUrl.has(url)) continue
      if (url) seenUrl.add(url)
      found.push({
        ref: '',
        origin: 'counter',
        title: it.source.title,
        authors: it.source.authors || [],
        url,
        tier: it.source.tier,
        grade: it.grade,
        paper_id: it.source.paper_id,
        doi: doiOf(url),
        read: 'abstract',
        claim: it.claim,
        content: [it.claim && `FINDING: ${it.claim}`, it.source.abstract && `ABSTRACT: ${it.source.abstract}`]
          .filter(Boolean)
          .join('\n'),
      })
    }
  } catch (e) {
    console.error('[beacon/paper] academic counter-search skipped:', String(e).slice(0, 160))
  }

  // Strongest challenges first, then number them C1..Cn.
  const ranked = found
    .sort((a, b) => (GRADE_RANK[a.grade] ?? 9) - (GRADE_RANK[b.grade] ?? 9))
    .slice(0, MAX_CHALLENGING)
  ranked.forEach((s, i) => (s.ref = `C${i + 1}`))
  return ranked
}

/** Render a read source for the synthesis prompt: its ref, provenance, tier/grade, and evidence block. */
function sourceBlock(s: ReadSource): string {
  const auth = s.authors.slice(0, 4).join(', ') || 'n/a'
  const tier = s.tier ? tierLabel(s.tier) : 'library'
  const depth =
    s.read === 'full_text' ? 'FULL TEXT read' : s.read === 'card_abstract' ? 'research-card + abstract' : 'abstract read'
  return (
    `### [${s.ref}] "${s.title}" — ${auth}\n` +
    `tier=${tier} | grade=${s.grade} | ${depth}${s.url ? ` | ${s.url}` : ''}\n` +
    `EVIDENCE:\n${s.content}`
  )
}

/** All citation refs (E#/C#) that actually appear in the supplied text. */
function citedRefs(text: string): Set<string> {
  const out = new Set<string>()
  for (const m of text.matchAll(/\b([EC]\d+)\b/g)) out.add(m[1])
  return out
}

/**
 * Strip unresolvable inline citations from a draft prose section. The synthesis model can emit a
 * bracketed citation — e.g. [E99] or a grouped [E1, C2] — that points at no real read source; left
 * in the stored paper those become dangling, unverifiable references. We drop any ref not in `valid`
 * (consistent with how engagement refs are validated), keep the resolvable ones, and tidy the
 * whitespace/punctuation a removal leaves behind so no unresolvable citation survives.
 */
function stripUnresolvedCitations(text: string, valid: Set<string>): string {
  if (!text) return text
  return text
    .replace(/\[\s*([EC]\d+(?:\s*[,;]\s*[EC]\d+)*)\s*\]/g, (_full, inner: string) => {
      const kept = inner
        .split(/\s*[,;]\s*/)
        .map((r) => r.trim())
        .filter((r) => valid.has(r))
      return kept.length ? `[${kept.join(', ')}]` : ''
    })
    // Tidy artifacts left by a removed citation: doubled spaces and a space before punctuation.
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([.,;:)])/g, '$1')
    .trim()
}

interface SynthFinding {
  ref?: string
  statement?: string
  detail?: string
  grade?: string
}
interface SynthOut {
  engagement?: {
    supporting?: SynthFinding[]
    challenging?: SynthFinding[]
    tensions?: { statement?: string; refs?: string[] }[]
  }
  draft?: Partial<Record<keyof PaperDraft, string>>
}

const VALID_GRADES = new Set<Grade>(['A', 'B', 'C', 'D', 'V', '—'])

/** Coerce a model finding into a PaperFinding, dropping any ref not in the read set (no-fabrication). */
function toFinding(f: SynthFinding, valid: Set<string>): PaperFinding | null {
  const ref = String(f?.ref || '').trim()
  if (!valid.has(ref)) return null // fabricated / unresolvable ref → drop
  const statement = String(f?.statement || '').trim()
  if (!statement) return null
  const g = String(f?.grade || '').trim() as Grade
  return {
    ref,
    statement,
    detail: String(f?.detail || '').trim(),
    grade: VALID_GRADES.has(g) ? g : undefined,
  }
}

/**
 * STEP 3 + assembly — run the synthesis call and build the persisted CasePaper. The reference list is
 * built server-side from the read sources that were actually cited (fallback: all read sources), so
 * the bibliography can never contain a source we did not read.
 */
export async function developPaper(
  pool: Pool,
  payload: Payload,
  theCase: BeaconCase,
  opts: { username: string },
): Promise<CasePaper> {
  const cased = theCase.evidence_pool.filter((c) => c.state === 'cased')

  // Stable E# refs over the cased set (mirrors assemble), then the deep full-text read.
  const refOf = new Map<string, string>()
  cased.forEach((c, i) => refOf.set(c.id, `E${i + 1}`))
  const supporting = await readCasedFullText(pool, payload, cased, refOf)

  // The position we are stress-testing (assembled synthesis), plus the question for the counter-query.
  const sections = theCase.sections
  const commission = theCase.commission
  const question = (commission?.sharpened_question || commission?.decision || theCase.title || '').trim()
  const position = (sections?.position || '').trim()

  const excludePaperIds = new Set<number>(supporting.map((s) => s.paper_id).filter((x): x is number => x != null))
  const excludeUrls = new Set<string>(supporting.map((s) => s.url).filter(Boolean))
  const challenging = await counterSearch(pool, payload, position, question, excludePaperIds, excludeUrls)

  // Scope the citable refs per engagement side so a finding can only cite its OWN source set:
  // supporting findings may cite only the cased E# papers; challenging findings may cite only the
  // counter-search C# papers. validRefs (the union) is used for tensions — which legitimately span
  // both sides — and for sanitizing draft prose / building the reference list.
  const supportingRefs = new Set<string>(supporting.map((s) => s.ref))
  const challengingRefs = new Set<string>(challenging.map((s) => s.ref))
  const validRefs = new Set<string>([...supportingRefs, ...challengingRefs])
  const allRead = [...supporting, ...challenging]

  const today = new Date().toISOString().slice(0, 10)
  const system = `You are Beacon's research-paper synthesist for WFM Labs. A premium member has assembled a defensible position from curated evidence; your job is to develop it into a BALANCED, INTELLECTUALLY HONEST, publishable paper that genuinely engages BOTH the supporting and the challenging evidence.

Today is ${today}. The commissioning member is @${opts.username}.

THE COMMISSION
- decision: ${commission?.decision || '(unspecified)'}
- skeptic to satisfy: ${commission?.skeptic || '(unspecified)'}
- context: ${commission?.context || '(unspecified)'}
- sharpened question: ${question || '(unspecified)'}

THE MEMBER'S ASSEMBLED POSITION (the theory this paper argues — carry it faithfully):
${position || '(no assembled position — derive a tight thesis from the supporting evidence)'}
${sections?.steelman ? `\nAssembled steelman: ${sections.steelman}` : ''}${sections?.gaps ? `\nAssembled gaps: ${sections.gaps}` : ''}${sections?.bottom_line ? `\nAssembled bottom line: ${sections.bottom_line}` : ''}

SUPPORTING SOURCE MATERIAL — the member's cased papers, read in DEPTH (cite these as [E#]):
${supporting.map(sourceBlock).join('\n\n') || '(none)'}

CHALLENGING SOURCE MATERIAL — disconfirming evidence surfaced by a dedicated counter-search (cite these as [C#]):
${challenging.map(sourceBlock).join('\n\n') || '(none found — say so honestly; do NOT invent opposition)'}

RULES (enforced):
- NO FABRICATION. Cite ONLY the [E#]/[C#] ids listed above, inline in your prose. Never invent a citation, a finding, a statistic, or a source. If the evidence does not say it, do not write it.
- Engage the CHALLENGING evidence honestly — it must be developed in its own right (counter_case_and_limitations), never buried or strawmanned. A paper that ignores [C#] is a failure.
- CALIBRATE to the grades shown. Peer-reviewed/preprint/institutional = hard research (can carry a claim). grade V (vendor/interested) = hypothesis-generating ONLY, never load-bearing. web/unverified (cap C) = suggestive only. State explicitly where you lean on hard vs soft evidence; never present a V/C source as settled.
- The "detail" of each engagement finding must contain the SPECIFIC full-text-grounded evidence (numbers, method, quotes) — not a restatement.

Produce ONLY a minified JSON object (no prose, no code fence):
{"engagement":{"supporting":[{"ref":"E1","statement":"the supporting finding","detail":"deep, specific, full-text-grounded elaboration with numbers/method","grade":"A"}],"challenging":[{"ref":"C1","statement":"the disconfirming finding","detail":"deep, specific elaboration of how it challenges the position","grade":"B"}],"tensions":[{"statement":"where supporting and challenging evidence collide, or an open question the evidence cannot yet settle","refs":["E2","C1"]}]},"draft":{"title":"a precise, publishable title","abstract":"150-250 words; states the question, the position, the weight of evidence for AND against, and the calibrated conclusion","introduction":"frames the WFM decision problem and why it matters; cites [E#]/[C#] as relevant","theory":"the member's position stated rigorously as the paper's thesis","evidence_for":"the deep supporting case, [E#]-cited, weighting hard vs soft evidence explicitly","counter_case_and_limitations":"the challenging evidence engaged in its own right, [C#]-cited, plus the honest limits of the supporting case","discussion":"weighs both sides, resolves what can be resolved, names what cannot, and gives calibrated guidance","conclusion":"the position that survives scrutiny and exactly where it stops being defensible"}}
Every section is plain prose (no markdown headers inside values; separate paragraphs with \\n\\n). Use ONLY the [E#]/[C#] ids listed above.`

  let raw: string
  try {
    raw = await callClaude(
      system,
      [
        {
          role: 'user',
          content:
            'Develop the assembled position into a balanced, honestly-cited paper. Read the supporting [E#] material in depth, engage the challenging [C#] material on its own terms, and emit the JSON object specified.',
        },
      ],
      SYNTH_MAX_TOKENS,
    )
  } catch (e) {
    throw new Error(`synthesis call failed: ${String(e).slice(0, 200)}`)
  }

  let parsed: SynthOut
  try {
    parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as SynthOut
  } catch {
    throw new Error(`unparseable synthesis: ${raw.slice(0, 200)}`)
  }

  // Build the structured engagement, dropping any fabricated/unresolvable refs.
  const engagement: PaperEngagement = {
    supporting: (parsed.engagement?.supporting || [])
      .map((f) => toFinding(f, supportingRefs))
      .filter((f): f is PaperFinding => f !== null),
    challenging: (parsed.engagement?.challenging || [])
      .map((f) => toFinding(f, challengingRefs))
      .filter((f): f is PaperFinding => f !== null),
    tensions: (parsed.engagement?.tensions || [])
      .map((t): PaperTension => ({
        statement: String(t?.statement || '').trim(),
        refs: (Array.isArray(t?.refs) ? t.refs : []).map((r) => String(r).trim()).filter((r) => validRefs.has(r)),
      }))
      .filter((t) => t.statement),
  }

  const d = parsed.draft || {}
  // Sanitize EVERY draft prose section before persisting: strip any inline [E#]/[C#] citation that
  // does not resolve to a real read source. Fabricated refs are already dropped from engagement + the
  // server-built reference list, but the prose strings were persisted verbatim — so an emitted [E99]
  // would leave a dangling inline citation in the final paper. This closes that gap.
  const prose = (v: unknown, fallback = ''): string =>
    stripUnresolvedCitations(String(v ?? fallback).trim(), validRefs)
  const draftSections = {
    title: prose(d.title || theCase.title || 'Untitled position') || 'Untitled position',
    abstract: prose(d.abstract),
    introduction: prose(d.introduction),
    theory: prose(d.theory, position),
    evidence_for: prose(d.evidence_for),
    counter_case_and_limitations: prose(d.counter_case_and_limitations),
    discussion: prose(d.discussion),
    conclusion: prose(d.conclusion),
  }

  // References = sources actually cited (post-sanitize) anywhere in the draft or engagement
  // (fallback: all read). Built server-side so the bibliography can never contain an unread source.
  const cited = citedRefs(Object.values(draftSections).join('\n') + ' ' + JSON.stringify(engagement))
  const refSources = allRead.filter((s) => cited.has(s.ref))
  const finalRefSources = refSources.length > 0 ? refSources : allRead
  const references: PaperReference[] = finalRefSources.map((s) => ({
    ref: s.ref,
    title: s.title,
    authors: s.authors,
    url: s.url,
    tier: s.tier,
    doi: s.doi,
    paper_id: s.paper_id,
    origin: s.origin,
    read: s.read,
  }))

  const draft: PaperDraft = {
    ...draftSections,
    references,
  }

  return { status: 'draft', engagement, draft, generated_at: new Date().toISOString() }
}
