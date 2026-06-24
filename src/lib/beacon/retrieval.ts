/**
 * Beacon retrieval (WFM-82).
 *
 * v2 retrieval is SEMANTIC-primary: embed the query (see embed.ts) and run pgvector kNN over
 * `paper_chunks`, group chunks → papers, rank by best chunk similarity, then load the full paper
 * docs for the top candidates. Keyword `LIKE` over title/abstract is kept only as a recall
 * supplement and as the fallback when embedding is unavailable. Selected paper docs are loaded via
 * Payload so authorship + Lexical fields (whyItMatters / curatorSummary / caveats) are handled
 * exactly as elsewhere.
 */

import type { getPayload } from 'payload'
import type { Pool } from 'pg'
import { toVectorLiteral } from './embed'

type Payload = Awaited<ReturnType<typeof getPayload>>

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
  /** Cosine similarity (1 - distance) of the best matching chunk; null for keyword-only hits. */
  bestSim: number | null
  /** Top matching chunks for this paper (semantic hits), richest-first. */
  chunks: { content: string; sectionTitle: string | null }[]
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

  const res = await pool.query<ChunkRow>(
    `SELECT paper_id, content, section_title, (embedding <=> $1::vector) AS dist
       FROM paper_chunks
      ORDER BY embedding <=> $1::vector ASC
      LIMIT $2`,
    [lit, chunkK],
  )

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
