/**
 * Beacon retrieval (WFM-82 → WFM-88 / research-014).
 *
 * v2 retrieval is SEMANTIC-primary. WFM-88 makes it CARD-FIRST: the primary kNN now runs over
 * `research_cards.embedding` (one structured deep-comprehension card per paper, bge-m3 1024-d),
 * ranking PAPERS by how well their card matches the query. Chunk-level kNN over `paper_chunks`
 * (also bge-m3 post research-013) is blended in for passage-level recall, and keyword `LIKE` over
 * title/abstract remains the final fallback when embedding is unavailable. Selected paper docs are
 * loaded via Payload so authorship + Lexical fields are handled exactly as elsewhere; each candidate
 * carries its full Research Card (when present) so the deep-read + draft steps reason over genuine
 * per-paper understanding, not abstract snippets.
 *
 * Cutover: card/chunk kNN only return hits once research-013 has populated bge-m3 embeddings (and
 * resized `paper_chunks.embedding` 384→1024-d). Until then both kNN paths return [] (the query
 * vector is 1024-d; a 384-d column or empty cards table simply yields nothing / errors, which we
 * swallow), and retrieval degrades to keyword `LIKE` — the route never 500s during the cutover.
 */

import type { getPayload } from 'payload'
import type { Pool } from 'pg'
import { toVectorLiteral } from './embed'

type Payload = Awaited<ReturnType<typeof getPayload>>

/** Structured deep-comprehension card (research_cards), 1:1 with a paper. */
export interface ResearchCard {
  thesis: string
  method: { design?: string; sample_n?: number; setting?: string } | null
  keyFindings: { finding: string; stat_or_quote?: string; locator?: string }[]
  evidenceStrength: string
  evidenceJustification: string
  problemTags: string[]
  limitations: string
  applicableQuestions: string[]
  keyQuotes: { quote: string; locator?: string }[]
  sourceBasis: string
  cardStatus: string
}

export interface RetrievedPaper {
  id: number
  title: string
  authors: string[]
  abstract: string
  fullText: string
  whyItMatters: string
  curatorSummary: string
  caveats: string
  sourceType: string
  sourceName: string
  category: string
  url: string
  /** Cosine similarity (1 - distance) of the best matching card/chunk; null for keyword-only hits. */
  bestSim: number | null
  /** Top matching chunks for this paper (semantic hits), richest-first. */
  chunks: { content: string; sectionTitle: string | null }[]
  /** The paper's structured Research Card (deep comprehension); null until research-012/013 fill it. */
  card: ResearchCard | null
}

// ── keyword helpers (fallback / recall supplement) ──
const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'with', 'this', 'that', 'have', 'from', 'your',
  'how', 'what', 'why', 'when', 'should', 'would', 'could', 'about', 'into', 'them', 'they', 'our',
  'can', 'will', 'has', 'was', 'were', 'their', 'which', 'than', 'then', 'need', 'want', 'defend',
])

export function keywords(text: string, max = 8): string[] {
  const seen = new Set<string>()
  for (const w of text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/)) {
    if (w.length > 3 && !STOPWORDS.has(w)) seen.add(w)
    if (seen.size >= max) break
  }
  return [...seen]
}

// ── Lexical → plain text (whyItMatters / curatorSummary / caveats are Lexical rich text) ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lexicalToText(node: any): string {
  if (!node) return ''
  let raw = node
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      return raw.trim()
    }
  }
  const root = raw.root ?? raw
  const parts: string[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (n: any) => {
    if (!n) return
    if (typeof n.text === 'string') parts.push(n.text)
    if (Array.isArray(n.children)) n.children.forEach(walk)
  }
  walk(root)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRetrieved(p: any, bestSim: number | null, chunks: RetrievedPaper['chunks']): RetrievedPaper {
  return {
    id: Number(p.id),
    title: String(p.title || ''),
    authors: Array.isArray(p.authors)
      ? p.authors.map((a: { name?: string }) => a?.name).filter(Boolean)
      : [],
    abstract: String(p.abstract || ''),
    fullText: String(p.fullText || p.full_text || ''),
    whyItMatters: lexicalToText(p.whyItMatters ?? p.why_it_matters),
    curatorSummary: lexicalToText(p.curatorSummary ?? p.curator_summary),
    caveats: lexicalToText(p.caveats),
    sourceType: String(p.sourceType || p.source_type || 'unknown'),
    sourceName: String(p.sourceName || p.source_name || ''),
    category: String(p.category || ''),
    url: String(p.sourceUrl || p.source_url || ''),
    bestSim,
    chunks,
    card: null,
  }
}

// ── Research Card row → typed card ──
interface CardRow {
  paper_id: number
  thesis: string | null
  method: unknown
  key_findings: unknown
  evidence_strength: string | null
  evidence_justification: string | null
  problem_tags: string[] | null
  limitations: string | null
  applicable_questions: string[] | null
  key_quotes: unknown
  source_basis: string | null
  card_status: string | null
}

function rowToCard(r: CardRow): ResearchCard {
  const findings = Array.isArray(r.key_findings) ? r.key_findings : []
  const quotes = Array.isArray(r.key_quotes) ? r.key_quotes : []
  const method =
    r.method && typeof r.method === 'object' && !Array.isArray(r.method)
      ? (r.method as ResearchCard['method'])
      : null
  return {
    thesis: String(r.thesis || ''),
    method,
    keyFindings: findings.map((f) => {
      const o = (f || {}) as { finding?: string; stat_or_quote?: string; locator?: string }
      return { finding: String(o.finding || ''), stat_or_quote: o.stat_or_quote, locator: o.locator }
    }),
    evidenceStrength: String(r.evidence_strength || ''),
    evidenceJustification: String(r.evidence_justification || ''),
    problemTags: Array.isArray(r.problem_tags) ? r.problem_tags : [],
    limitations: String(r.limitations || ''),
    applicableQuestions: Array.isArray(r.applicable_questions) ? r.applicable_questions : [],
    keyQuotes: quotes.map((q) => {
      const o = (q || {}) as { quote?: string; locator?: string }
      return { quote: String(o.quote || ''), locator: o.locator }
    }),
    sourceBasis: String(r.source_basis || ''),
    cardStatus: String(r.card_status || ''),
  }
}

const CARD_COLS = `paper_id, thesis, method, key_findings, evidence_strength, evidence_justification,
                   problem_tags, limitations, applicable_questions, key_quotes, source_basis, card_status`

/**
 * Hydrate `.card` for any candidate that doesn't already carry one (e.g. arrived via chunk/keyword
 * retrieval). One query over research_cards by paper_id. Best-effort: on error (table absent during
 * cutover) candidates keep card=null and retrieval still works off chunks/abstract.
 */
export async function attachCards(pool: Pool, papers: RetrievedPaper[]): Promise<void> {
  const need = papers.filter((p) => !p.card).map((p) => p.id)
  if (need.length === 0) return
  try {
    const res = await pool.query<CardRow>(
      `SELECT ${CARD_COLS} FROM research_cards
        WHERE paper_id = ANY($1) AND card_status = 'complete'`,
      [need],
    )
    const byPaper = new Map<number, ResearchCard>()
    for (const r of res.rows) byPaper.set(Number(r.paper_id), rowToCard(r))
    for (const p of papers) if (!p.card) p.card = byPaper.get(p.id) ?? null
  } catch (e) {
    console.error('[beacon/retrieval] attachCards skipped:', String(e).slice(0, 160))
  }
}

/** Load full paper docs (preserving order of `ids`) via Payload. */
async function loadPaperDocs(payload: Payload, ids: number[]): Promise<Map<number, unknown>> {
  if (ids.length === 0) return new Map()
  const res = await payload.find({
    collection: 'papers',
    where: { id: { in: ids } },
    limit: ids.length,
    depth: 0,
    overrideAccess: true,
  })
  const map = new Map<number, unknown>()
  for (const d of res.docs) map.set(Number((d as { id: number }).id), d)
  return map
}

interface CardKnnRow extends CardRow {
  dist: number
}

/**
 * CARD-FIRST candidates: pgvector kNN over `research_cards.embedding` (bge-m3 1024-d, cosine),
 * ranking PAPERS directly by how well their deep-comprehension card matches the query. Returns full
 * paper docs each carrying their structured card. This is the primary retrieval path — it reasons
 * over genuine per-paper understanding, not abstract keyword overlap. Empty array if there are no
 * embedded cards yet (pre research-013) or on any error (so retrieval degrades to chunks/keyword).
 */
export async function cardCandidates(
  pool: Pool,
  payload: Payload,
  vec: number[],
  opts: { paperK?: number } = {},
): Promise<RetrievedPaper[]> {
  const paperK = opts.paperK ?? 8
  const lit = toVectorLiteral(vec)
  let rows: CardKnnRow[]
  try {
    const res = await pool.query<CardKnnRow>(
      `SELECT ${CARD_COLS}, (embedding <=> $1::vector) AS dist
         FROM research_cards
        WHERE embedding IS NOT NULL AND card_status = 'complete'
        ORDER BY embedding <=> $1::vector ASC
        LIMIT $2`,
      [lit, paperK],
    )
    rows = res.rows
  } catch (e) {
    console.error('[beacon/retrieval] cardCandidates skipped (cards not embedded yet?):', String(e).slice(0, 160))
    return []
  }
  if (rows.length === 0) return []

  const docs = await loadPaperDocs(payload, rows.map((r) => Number(r.paper_id)))
  const out: RetrievedPaper[] = []
  for (const r of rows) {
    const doc = docs.get(Number(r.paper_id))
    if (!doc) continue
    const rp = toRetrieved(doc, 1 - r.dist, [])
    rp.card = rowToCard(r)
    out.push(rp)
  }
  return out
}

interface ChunkRow {
  paper_id: number
  content: string
  section_title: string | null
  dist: number
}

/**
 * Semantic candidates: pgvector kNN over paper_chunks, grouped chunks → papers, ranked by best
 * (smallest) cosine distance, capped at `paperK` papers each carrying up to `chunksPerPaper`
 * richest matching chunks. Returns full paper docs. Empty array if there are no chunks/embeddings.
 */
export async function semanticCandidates(
  pool: Pool,
  payload: Payload,
  vec: number[],
  opts: { chunkK?: number; paperK?: number; chunksPerPaper?: number } = {},
): Promise<RetrievedPaper[]> {
  const chunkK = opts.chunkK ?? 40
  const paperK = opts.paperK ?? 8
  const chunksPerPaper = opts.chunksPerPaper ?? 4
  const lit = toVectorLiteral(vec)

  let res: { rows: ChunkRow[] }
  try {
    res = await pool.query<ChunkRow>(
      `SELECT paper_id, content, section_title, (embedding <=> $1::vector) AS dist
         FROM paper_chunks
        ORDER BY embedding <=> $1::vector ASC
        LIMIT $2`,
      [lit, chunkK],
    )
  } catch (e) {
    // Pre-cutover the column is still vector(384); a 1024-d query throws a dimension mismatch.
    // Swallow it so retrieval degrades to keyword rather than 500-ing.
    console.error('[beacon/retrieval] chunk kNN skipped (dim mismatch pre-013?):', String(e).slice(0, 160))
    return []
  }

  // Group chunks → papers, keep insertion order (already distance-sorted) = best-first per paper.
  const byPaper = new Map<number, ChunkRow[]>()
  for (const row of res.rows) {
    const arr = byPaper.get(row.paper_id) ?? []
    if (arr.length < chunksPerPaper) arr.push(row)
    byPaper.set(row.paper_id, arr)
  }
  // Rank papers by their best (first) chunk distance.
  const ranked = [...byPaper.entries()]
    .map(([paperId, rows]) => ({ paperId, bestDist: rows[0].dist, rows }))
    .sort((a, b) => a.bestDist - b.bestDist)
    .slice(0, paperK)

  const docs = await loadPaperDocs(payload, ranked.map((r) => r.paperId))
  const out: RetrievedPaper[] = []
  for (const r of ranked) {
    const doc = docs.get(r.paperId)
    if (!doc) continue
    out.push(
      toRetrieved(
        doc,
        1 - r.bestDist,
        r.rows.map((c) => ({ content: c.content, sectionTitle: c.section_title })),
      ),
    )
  }
  return out
}

/** Keyword candidates (Payload `like` over title/abstract). Fallback + recall supplement. */
export async function keywordCandidates(
  payload: Payload,
  query: string,
  limit = 12,
): Promise<RetrievedPaper[]> {
  const kws = keywords(query)
  if (kws.length === 0) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const or: any[] = kws.flatMap((k) => [{ title: { like: k } }, { abstract: { like: k } }])
  const res = await payload.find({
    collection: 'papers',
    where: { or },
    limit,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs.map((d) => toRetrieved(d, null, []))
}

/**
 * Merge a primary (semantic) candidate list with supplemental (keyword) hits for recall, dropping
 * duplicates by paper id and capping the total. Semantic hits keep their rank order first.
 */
export function mergeCandidates(
  primary: RetrievedPaper[],
  supplement: RetrievedPaper[],
  cap: number,
): RetrievedPaper[] {
  const seen = new Set<number>(primary.map((p) => p.id))
  const out = [...primary]
  for (const p of supplement) {
    if (out.length >= cap) break
    if (seen.has(p.id)) continue
    seen.add(p.id)
    out.push(p)
  }
  return out.slice(0, cap)
}

// ── WFMWiki canon (MediaWiki search, optional) — unchanged from v1 ──
export async function searchWiki(
  query: string,
): Promise<{ title: string; snippet: string; url: string }[]> {
  const base = process.env.WFMWIKI_API_URL
  if (!base) return []
  try {
    const u = `${base}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json`
    const resp = await fetch(u, { headers: { 'User-Agent': 'wfmlabs-beacon/1.0' } })
    if (!resp.ok) return []
    const data = (await resp.json()) as { query?: { search?: { title: string; snippet?: string }[] } }
    const origin = base.replace(/\/api\.php.*$/, '')
    return (data.query?.search || []).map((s) => ({
      title: s.title,
      snippet: (s.snippet || '').replace(/<[^>]+>/g, '').slice(0, 300),
      url: `${origin}/wiki/${encodeURIComponent(s.title.replace(/ /g, '_'))}`,
    }))
  } catch {
    return []
  }
}
