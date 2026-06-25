/**
 * Beacon deep-read + selection (WFM-82).
 *
 * Turns a ranked candidate set (semanticCandidates) into a small set of papers that genuinely carry
 * the argument. For each candidate we assemble its richest available content (top matching chunks +
 * fullText if present, else abstract + whyItMatters + curatorSummary), then make ONE structured
 * Claude call that, per candidate, judges genuine fit, extracts the specific finding, assigns the
 * A–V evidence grade, and notes stance. We then select 3–4 supporting papers (a "for"/"against" mix
 * is welcome for the steelman) and set the rest aside. The drafting step synthesizes the brief from
 * these deep reads — never from raw abstract dumps. No fabrication: only candidates from the
 * retrieved set are ever passed forward.
 */

import { callClaude } from './claude'
import type { RetrievedPaper, ResearchCard } from './retrieval'
import type { WebSource } from './webreach'

const PER_CANDIDATE_CHARS = 4200
const PER_CHUNK_CHARS = 1100
// Finalists get a genuine deep read: their full card + a generous full-text window (the depth payoff).
const FINALIST_CHARS = 7000
const FINALIST_FULLTEXT_CHARS = 5200

export type Grade = 'A' | 'B' | 'C' | 'D' | 'V' | '—'
const VALID_GRADES = new Set(['A', 'B', 'C', 'D', 'V', '—'])

export interface DeepRead extends RetrievedPaper {
  supports: boolean
  grade: Grade
  finding: string
  relevance: number
  stance: 'for' | 'against' | 'context'
  /** The evidence text actually read for this paper (chunks + fullText/abstract, budgeted). */
  evidence: string
}

export interface DeepReadResult {
  selected: DeepRead[]
  notUsed: { title: string; reason: string }[]
}

/**
 * Render a paper's structured Research Card to text. `full` includes every finding/quote (the deep
 * per-finalist read); the compact form (top findings only) is enough to SCORE a candidate.
 */
export function cardToText(card: ResearchCard, full: boolean): string {
  const lines: string[] = ['RESEARCH CARD' + (card.sourceBasis ? ` (from ${card.sourceBasis})` : '')]
  if (card.thesis) lines.push(`Thesis: ${card.thesis}`)
  if (card.method) {
    const m = card.method
    const bits = [m.design, m.sample_n != null ? `n=${m.sample_n}` : '', m.setting].filter(Boolean)
    if (bits.length) lines.push(`Method: ${bits.join(' · ')}`)
  }
  if (card.evidenceStrength) {
    lines.push(`Evidence grade: ${card.evidenceStrength}${card.evidenceJustification ? ` — ${card.evidenceJustification}` : ''}`)
  }
  const findings = full ? card.keyFindings : card.keyFindings.slice(0, 3)
  if (findings.length) {
    lines.push('Key findings:')
    for (const f of findings) {
      const stat = f.stat_or_quote ? ` — ${f.stat_or_quote}` : ''
      const loc = full && f.locator ? ` (${f.locator})` : ''
      lines.push(`  • ${f.finding}${stat}${loc}`)
    }
  }
  if (full && card.keyQuotes.length) {
    lines.push('Verbatim quotes (for grounded citation):')
    for (const q of card.keyQuotes) lines.push(`  • "${q.quote}"${q.locator ? ` (${q.locator})` : ''}`)
  }
  if (card.problemTags.length) lines.push(`Bears on: ${card.problemTags.join(', ')}`)
  if (full && card.limitations) lines.push(`Limitations: ${card.limitations}`)
  return lines.join('\n')
}

/**
 * Assemble the richest available content for a candidate, within a char budget. Card-first: the
 * structured deep-comprehension card leads (when present), then full text / chunks / abstract.
 * `finalist=true` reads deeper (full card + a generous full-text window) — this is the deep
 * per-finalist read the brief is drafted from.
 */
export function assembleEvidence(p: RetrievedPaper, finalist = false): string {
  const parts: string[] = []
  if (p.card) parts.push(cardToText(p.card, finalist))
  // Top matching chunks — the most query-relevant slices of the paper.
  for (const c of p.chunks) {
    const head = c.sectionTitle ? `[${c.sectionTitle}] ` : ''
    parts.push(head + c.content.slice(0, PER_CHUNK_CHARS))
  }
  if (p.fullText) {
    parts.push('FULL TEXT: ' + p.fullText.slice(0, finalist ? FINALIST_FULLTEXT_CHARS : PER_CANDIDATE_CHARS))
  } else {
    if (p.abstract) parts.push('ABSTRACT: ' + p.abstract)
    if (p.whyItMatters) parts.push('WHY IT MATTERS: ' + p.whyItMatters)
    if (p.curatorSummary) parts.push('CURATOR SUMMARY: ' + p.curatorSummary)
  }
  if (p.caveats) parts.push('CAVEATS: ' + p.caveats)
  // De-dup near-identical fragments (chunks often overlap the abstract) and budget the whole thing.
  const seen = new Set<string>()
  const deduped: string[] = []
  for (const part of parts) {
    const k = part.slice(0, 120).toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    deduped.push(part)
  }
  return deduped.join('\n\n').slice(0, finalist ? FINALIST_CHARS : PER_CANDIDATE_CHARS)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseScores(text: string): any[] {
  // Be liberal: pull the first JSON array out of the reply (Claude may wrap it in prose/fences).
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return []
  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Deep-read all candidates in ONE structured Claude call (bounded cost/latency), then select 3–4.
 * `question` is the sharpened research question from intake. Degrades gracefully: if scoring fails
 * or returns nothing usable, we fall back to taking the top candidates ungraded so the draft step
 * still has real, retrieved sources.
 */
export async function deepRead(
  candidates: RetrievedPaper[],
  question: string,
  opts: { maxSelect?: number } = {},
): Promise<DeepReadResult> {
  const maxSelect = opts.maxSelect ?? 4
  if (candidates.length === 0) return { selected: [], notUsed: [] }

  const evidence = candidates.map((p) => assembleEvidence(p))
  const blocks = candidates
    .map((p, i) => {
      const auth = p.authors.slice(0, 4).join(', ') || 'n/a'
      const simStr = p.bestSim != null ? ` (kNN sim ${p.bestSim.toFixed(2)})` : ' (keyword hit)'
      return `### Candidate ${i}${simStr}\nTitle: ${p.title}\nAuthors: ${auth}\nType: ${p.sourceType}${p.sourceName ? '/' + p.sourceName : ''} | Category: ${p.category}\nContent:\n${evidence[i]}`
    })
    .join('\n\n')

  const system = `You are Beacon's evidence appraiser. You are given a sharpened research question and a set of candidate sources retrieved from the WFM Labs Research Library. Most candidates carry a structured RESEARCH CARD (thesis, method, graded key findings) — a deep prior read of the paper; weight it heavily. For EACH candidate, judge whether it genuinely bears on the question, extract the single most specific finding/claim it offers (with any concrete numbers), assign an evidence grade, and note its stance toward the member's likely position.

Evidence Strength Scale:
- A Strong: multiple converging peer-reviewed studies / controlled trials; recent; generalizable.
- B Moderate: one solid study, or several weaker studies that agree; some generalizability questions.
- C Suggestive: limited, small-sample, observational, or context mismatch. Directional only.
- D Contested: credible evidence on both sides; no consensus.
- V Vendor/Interested: commercial stake; hypothesis-generating only.
- "—" Absent: doesn't actually bear on the question / no usable evidence.

Rules:
- Be strict. A candidate that merely shares keywords but doesn't inform the question gets supports=false and grade "—".
- "finding" must be the SPECIFIC evidence this paper offers (e.g. "CES predicts repurchase better than CSAT/NPS across 75,000 customers"), not a generic restatement. Do NOT invent numbers not in the content.
- stance: "for" (supports the member's position), "against" (steelman / complicates it), or "context" (background/definitional).

Output ONLY a JSON array, one object per candidate, in order:
[{"i":0,"supports":true,"grade":"A","relevance":92,"stance":"for","finding":"..."}, ...]
relevance is 0–100. No prose outside the array.`

  let scores: { i: number; supports: boolean; grade: string; relevance: number; stance: string; finding: string }[] = []
  try {
    const raw = await callClaude(
      system,
      [{ role: 'user', content: `SHARPENED QUESTION:\n${question}\n\nCANDIDATES:\n${blocks}` }],
      2600,
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scores = parseScores(raw).filter((s: any) => typeof s?.i === 'number')
  } catch (e) {
    console.error('[beacon/deepread] scoring call failed, degrading to ungraded top candidates:', String(e).slice(0, 160))
  }

  const reads: DeepRead[] = candidates.map((p, i) => {
    const s = scores.find((x) => x.i === i)
    const gradeRaw = String(s?.grade || '').trim()
    const grade: Grade = (VALID_GRADES.has(gradeRaw) ? gradeRaw : '—') as Grade
    const stanceRaw = String(s?.stance || 'for')
    const stance: DeepRead['stance'] =
      stanceRaw === 'against' || stanceRaw === 'context' ? stanceRaw : 'for'
    // If scoring failed entirely, treat candidates as provisionally supporting so the draft has sources.
    const scored = !!s
    return {
      ...p,
      supports: scored ? !!s?.supports && grade !== '—' : true,
      grade,
      relevance: typeof s?.relevance === 'number' ? s.relevance : p.bestSim != null ? Math.round(p.bestSim * 100) : 50,
      stance,
      finding: String(s?.finding || '').trim(),
      evidence: evidence[i],
    }
  })

  const supporting = reads.filter((r) => r.supports).sort((a, b) => b.relevance - a.relevance)
  let selected = supporting.slice(0, maxSelect)
  // Guarantee the draft has at least 3 real sources where candidates allow (avoid an empty brief).
  if (selected.length < Math.min(3, reads.length)) {
    const filler = reads
      .filter((r) => !selected.includes(r))
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, Math.min(3, reads.length) - selected.length)
    selected = [...selected, ...filler]
  }
  const selectedIds = new Set(selected.map((r) => r.id))
  const notUsed = reads
    .filter((r) => !selectedIds.has(r.id))
    .map((r) => ({
      title: r.title,
      reason:
        r.grade === '—' || !r.supports
          ? 'does not bear on the sharpened question'
          : `lower-priority ${r.stance} evidence (grade ${r.grade})`,
    }))

  return { selected, notUsed }
}

interface WikiHit {
  title: string
  snippet: string
  url: string
}

/**
 * Build the SOURCES block from deep reads — synthesized findings + grades, not raw abstract dumps.
 * Finalists are re-rendered in DEPTH here (full structured card + a generous full-text window) so the
 * draft step reasons over genuine per-paper understanding. Web sources (Exa, when internal coverage
 * was thin) are listed distinctly and may be cited ONLY from their fetched highlights + URL.
 */
export function deepSourcesBlock(result: DeepReadResult, wiki: WikiHit[], web: WebSource[] = []): string {
  const { selected, notUsed } = result
  if (selected.length === 0 && wiki.length === 0 && web.length === 0) {
    return '# SOURCES AVAILABLE THIS TURN\n(none retrieved — the library returned nothing for this query; treat the evidence as Absent (—) unless the member supplied facts directly.)'
  }
  const lines: string[] = [
    '# SOURCES AVAILABLE THIS TURN (deep-read)',
    'These are the papers Beacon retrieved (card-first semantic kNN) and READ IN DEPTH for this question. Cite ONLY these (plus WFMWiki, the listed web sources, and the member’s own statements). Each carries its structured Research Card + the specific extracted finding + evidence grade — synthesize the brief from these, do not dump them. Do NOT cite anything not listed here.',
    '',
  ]
  if (wiki.length) {
    lines.push('## WFMWiki canon')
    wiki.forEach((w, i) => lines.push(`[W${i + 1}] ${w.title} — ${w.snippet} (${w.url})`))
    lines.push('')
  }
  lines.push('## Deep-read sources (selected)')
  selected.forEach((p, i) => {
    const auth = p.authors.slice(0, 4).join(', ') || 'n/a'
    const sim = p.bestSim != null ? `; semantic match ${p.bestSim.toFixed(2)}` : '; keyword match'
    lines.push(
      `[P${i + 1}] "${p.title}" — ${auth}. type=${p.sourceType}${p.sourceName ? '/' + p.sourceName : ''}; category=${p.category}; stance=${p.stance}; grade=${p.grade}${sim}. ${p.url}`,
    )
    if (p.finding) lines.push(`    FINDING: ${p.finding}`)
    // Deep per-finalist read: full card + generous full-text window (not the compact scoring snippet).
    lines.push(`    DEEP READ:\n${assembleEvidence(p, true)}`)
  })
  if (web.length) {
    lines.push('')
    lines.push('## Web sources (fetched beyond the library — thin internal coverage)')
    lines.push('Internal coverage was thin, so Beacon reached the open web via Exa. Cite these ONLY from the fetched highlight text + URL below; never embellish beyond what was fetched. Tag them distinctly in the SOURCES table as `web · fetched ' + new Date().toISOString().slice(0, 10) + '` and grade them conservatively (industry/web → typically C, vendor → V).')
    web.forEach((w, i) => {
      const date = w.publishedDate ? `; published ${w.publishedDate.slice(0, 10)}` : ''
      lines.push(`[Wb${i + 1}] "${w.title}"${date}. ${w.url}`)
      for (const h of w.highlights.slice(0, 3)) lines.push(`    HIGHLIGHT: ${h.replace(/\s+/g, ' ').slice(0, 500)}`)
    })
  }
  if (notUsed.length) {
    lines.push('')
    lines.push('## Considered but not used (do NOT cite these as support)')
    notUsed.slice(0, 10).forEach((n) => lines.push(`- "${n.title}" — ${n.reason}`))
  }
  return lines.join('\n')
}
