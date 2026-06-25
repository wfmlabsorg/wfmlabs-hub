/**
 * Beacon Case Canvas — gap-driven academic acquisition (WFM-96 / research-023). THE CENTERPIECE.
 *
 * Ted's finding: cases come back with only C/D evidence because the 1,092-paper library is thin on
 * STRONG, peer-reviewed CX-metric research (CES/FCR/etc.). The fix: when a case comes up short on
 * STRONG evidence, go FIND real scholarly sources for the sharpened question, add them to the pool,
 * and INGEST the strong relevant ones into the corpus so the topic fills itself and future cases
 * benefit. The acquisition path is PEER-REVIEWED ONLY — vendor/marketing is excluded outright.
 *
 * It reuses the iter-2 machinery wholesale:
 *   - tiers.ts   → classify each scholarly hit; only peer_reviewed/preprint/institutional survive.
 *   - deepread.ts→ the SAME appraiser grades each hit (A–V) + extracts the specific finding/stance,
 *                   reading the fetched abstract (we wrap each hit as a synthetic RetrievedPaper).
 *   - webreach.ts→ Exa with academic includeDomains for arXiv/SSRN/edu preprints.
 *   - /api/papers/ingest (WFM-47) → the existing ingest pipeline (paper-fulltext → paper-cards →
 *                   paper-embed) makes a kept hit a permanent, embedded, carded library paper.
 *
 * Sources: Crossref REST (free, no key, returns DOI + title + abstract + authors) is primary for
 * peer-reviewed journal articles; Exa (academic includeDomains) supplements with preprints. No
 * fabrication: every card cites only fetched content (the real abstract/highlight + the source URL).
 */

import { deepRead, type Grade } from '@/lib/beacon/deepread'
import type { RetrievedPaper } from '@/lib/beacon/retrieval'
import { webReach } from '@/lib/beacon/webreach'
import { classifyWebTier, enforceGrade } from '@/lib/beacon/tiers'
import type { EvidenceSource, SourceTier } from '@/lib/beacon/cases'
import type { getPayload } from 'payload'

type Payload = Awaited<ReturnType<typeof getPayload>>

/** A card counts as STRONG when its grade is A/B AND it sits in a research (non-soft) tier. */
const STRONG_GRADES = new Set<Grade>(['A', 'B'])
const RESEARCH_TIERS = new Set<SourceTier>(['peer_reviewed', 'preprint', 'institutional'])

/** Gap threshold: fewer than this many STRONG cards across the question triggers acquisition. */
export const STRONG_TARGET = 2
/** Hard cost cap: never ingest more than this many new papers per case. */
export const MAX_ACQUIRE = 5
/** How many scholarly candidates to deep-read per acquisition pass. */
const ACQUIRE_CANDIDATES = 8

/** Academic preprint / publisher / repository domains for Exa's academic filter. */
const ACADEMIC_DOMAINS = [
  'arxiv.org', 'ssrn.com', 'papers.ssrn.com', 'nber.org', 'doi.org', 'semanticscholar.org',
  'researchgate.net', 'ideas.repec.org', 'osf.io', 'biorxiv.org', 'psyarxiv.com',
  'sciencedirect.com', 'springer.com', 'link.springer.com', 'wiley.com', 'onlinelibrary.wiley.com',
  'tandfonline.com', 'journals.sagepub.com', 'jstor.org', 'emerald.com', 'academic.oup.com',
  'pubsonline.informs.org', 'aeaweb.org', 'mdpi.com',
]

/** True when a built card is STRONG (counts toward the gap threshold). */
export function isStrongCard(grade: Grade, tier: SourceTier | undefined): boolean {
  return STRONG_GRADES.has(grade) && !!tier && RESEARCH_TIERS.has(tier)
}

// ── one acquired scholarly hit (before grading) ──
interface AcquiredHit {
  title: string
  url: string
  authors: string[]
  abstract: string
  publishedDate?: string
  doi?: string
  via: 'crossref' | 'exa'
}

/** Normalize a title for dedup: lowercase, strip non-alphanumerics, collapse whitespace. */
function normTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/** Strip JATS/HTML tags Crossref wraps abstracts in, and collapse whitespace. */
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Clamp text to ~`maxSentences` sentences and `maxChars` chars for a scannable card abstract. */
export function clampAbstract(text: string, maxSentences = 3, maxChars = 420): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  const sentences = clean.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [clean]
  let out = sentences.slice(0, maxSentences).join(' ').trim()
  if (out.length > maxChars) out = out.slice(0, maxChars - 1).trimEnd() + '…'
  return out
}

/**
 * Search Crossref for peer-reviewed journal articles on the question. Free, no API key; returns
 * DOI + title + abstract + authors. We filter to journal articles and request only the fields we
 * use. Abstracts are JATS XML → stripped. Returns [] on any error (acquisition must never 500).
 */
async function crossrefSearch(query: string, rows: number): Promise<AcquiredHit[]> {
  const q = (query || '').trim()
  if (!q) return []
  const mailto = process.env.CROSSREF_MAILTO || 'beacon@wfmlabs.com'
  const params = new URLSearchParams({
    'query.bibliographic': q.slice(0, 500),
    rows: String(rows),
    filter: 'type:journal-article,has-abstract:true',
    select: 'DOI,title,abstract,author,issued,URL,container-title',
    mailto,
  })
  try {
    const resp = await fetch(`https://api.crossref.org/works?${params.toString()}`, {
      headers: { 'User-Agent': `WFMLabs-Beacon/1.0 (mailto:${mailto})` },
    })
    if (!resp.ok) {
      console.error('[beacon/acquire] crossref', resp.status)
      return []
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await resp.json()) as { message?: { items?: any[] } }
    const items = data.message?.items || []
    return items
      .map((it): AcquiredHit | null => {
        const doi = String(it.DOI || '').trim()
        const title = stripTags(String((it.title && it.title[0]) || '')).trim()
        const abstract = stripTags(String(it.abstract || ''))
        if (!doi || !title || !abstract) return null
        const authors = (it.author || [])
          .map((a: { given?: string; family?: string }) => [a.given, a.family].filter(Boolean).join(' ').trim())
          .filter(Boolean)
          .slice(0, 12)
        const issued = it.issued?.['date-parts']?.[0]
        const publishedDate = Array.isArray(issued)
          ? `${issued[0]}-${String(issued[1] || 1).padStart(2, '0')}-${String(issued[2] || 1).padStart(2, '0')}`
          : undefined
        return { title, url: `https://doi.org/${doi}`, authors, abstract, publishedDate, doi, via: 'crossref' }
      })
      .filter((h): h is AcquiredHit => h !== null)
  } catch (e) {
    console.error('[beacon/acquire] crossref failed:', String(e).slice(0, 160))
    return []
  }
}

/** Supplement Crossref with Exa restricted to academic domains (preprints/arXiv/SSRN/edu). */
async function exaAcademic(query: string, numResults: number): Promise<AcquiredHit[]> {
  const web = await webReach(query, { numResults, includeDomains: ACADEMIC_DOMAINS })
  return web.map((w) => ({
    title: w.title,
    url: w.url,
    authors: [],
    abstract: clampAbstract(w.highlights.join(' '), 4, 800),
    publishedDate: w.publishedDate,
    via: 'exa' as const,
  }))
}

/** Merge hits from both sources, dedup by DOI then by normalized title. */
function mergeHits(...lists: AcquiredHit[][]): AcquiredHit[] {
  const out: AcquiredHit[] = []
  const seenDoi = new Set<string>()
  const seenTitle = new Set<string>()
  for (const hit of lists.flat()) {
    const doiKey = hit.doi?.toLowerCase()
    const titleKey = normTitle(hit.title)
    if ((doiKey && seenDoi.has(doiKey)) || (titleKey && seenTitle.has(titleKey))) continue
    if (doiKey) seenDoi.add(doiKey)
    if (titleKey) seenTitle.add(titleKey)
    out.push(hit)
  }
  return out
}

/**
 * Is this scholarly hit already in the library? Dedup key = canonical source URL (the hard key the
 * ingest route also enforces) OR a normalized-title match. Conservative: any match → skip.
 */
async function isDuplicate(payload: Payload, hit: AcquiredHit): Promise<boolean> {
  try {
    const byUrl = await payload.find({
      collection: 'papers',
      where: { sourceUrl: { equals: hit.url } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (byUrl.docs.length > 0) return true
    const byTitle = await payload.find({
      collection: 'papers',
      where: { title: { like: hit.title.slice(0, 80) } },
      limit: 3,
      depth: 0,
      overrideAccess: true,
    })
    const key = normTitle(hit.title)
    return byTitle.docs.some((d) => normTitle(String(d.title || '')) === key)
  } catch (e) {
    // On a lookup failure, err toward NOT ingesting a possible duplicate.
    console.error('[beacon/acquire] dedup lookup failed:', String(e).slice(0, 120))
    return true
  }
}

/** Wrap an acquired hit as a synthetic RetrievedPaper so the iter-2 deepRead appraiser can grade it. */
function toSynthetic(hit: AcquiredHit, idx: number): RetrievedPaper {
  return {
    id: -1 - idx, // negative sentinel — never collides with real papers.id
    title: hit.title,
    authors: hit.authors,
    abstract: hit.abstract,
    fullText: '',
    whyItMatters: '',
    curatorSummary: '',
    caveats: '',
    sourceType: hit.via === 'crossref' ? 'journal' : 'preprint',
    sourceName: hit.doi ? 'Crossref' : 'Exa',
    category: '',
    url: hit.url,
    bestSim: null,
    chunks: [],
    card: null,
  }
}

/** Map a graded scholarly hit to the ingest route's IngestPaper shape (WFM-47). */
function toIngestPaper(hit: AcquiredHit, tier: SourceTier, finding: string) {
  const sourceType =
    tier === 'preprint' ? (hit.url.includes('ssrn') ? 'ssrn' : 'arxiv') : tier === 'peer_reviewed' ? 'journal' : 'industry-report'
  return {
    title: hit.title,
    sourceUrl: hit.url,
    sourceType,
    sourceName: hit.doi ? `doi:${hit.doi}` : undefined,
    paperType: 'empirical-study',
    category: 'customer-experience',
    authors: hit.authors.map((name) => ({ name })),
    abstract: hit.abstract,
    publicationDate: hit.publishedDate,
    summary: finding || undefined,
  }
}

/**
 * POST kept scholarly papers to the existing ingest endpoint (WFM-47) so paper-fulltext →
 * paper-cards → paper-embed make them permanent embedded library papers. Best-effort: skips
 * silently when the API key/origin are unavailable, never throws. Returns the count actually created.
 */
async function ingestPapers(
  origin: string | undefined,
  papers: ReturnType<typeof toIngestPaper>[],
): Promise<number> {
  if (papers.length === 0) return 0
  const key = process.env.BEACON_API_KEY
  if (!origin || !key) {
    console.warn('[beacon/acquire] skipping ingest — missing origin or BEACON_API_KEY')
    return 0
  }
  try {
    const resp = await fetch(`${origin}/api/papers/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-beacon-api-key': key },
      body: JSON.stringify({ papers }),
    })
    if (!resp.ok) {
      console.error('[beacon/acquire] ingest', resp.status, (await resp.text()).slice(0, 160))
      return 0
    }
    const data = (await resp.json()) as { created?: number }
    return Number(data.created) || 0
  } catch (e) {
    console.error('[beacon/acquire] ingest failed:', String(e).slice(0, 160))
    return 0
  }
}

export interface AcquiredItem {
  claim: string
  grade: Grade
  source: EvidenceSource
}

export interface AcquireResult {
  items: AcquiredItem[]
  searched: number
  ingested: number
}

/**
 * Run a full academic acquisition pass for `question`:
 *   1. Search Crossref (peer-reviewed) + Exa academic (preprints) for scholarly sources.
 *   2. Dedup against the existing library (by URL/title) so we never re-add a paper.
 *   3. Keep ONLY peer_reviewed/preprint/institutional tiers (vendor/web excluded outright).
 *   4. Grade every survivor with the iter-2 deepRead appraiser (reading the fetched abstract).
 *   5. Return supporting hits as evidence items (tier + abstract + link, tagged acquired), and
 *      INGEST the STRONG (A/B) relevant ones into the library (bounded to MAX_ACQUIRE).
 *
 * Cite-only-what-was-fetched is preserved: claims/abstracts come straight from the real abstract or
 * Exa highlight. Returns [] items on any failure (acquisition must never take the route down).
 */
export async function acquireAcademic(
  payload: Payload,
  question: string,
  opts: { origin?: string } = {},
): Promise<AcquireResult> {
  const empty: AcquireResult = { items: [], searched: 0, ingested: 0 }
  const q = (question || '').trim()
  if (!q) return empty

  // 1. Search both scholarly sources in parallel, merge + dedup-within-results.
  const [crossref, exa] = await Promise.all([
    crossrefSearch(q, ACQUIRE_CANDIDATES),
    exaAcademic(q, 6),
  ])
  const merged = mergeHits(crossref, exa).slice(0, ACQUIRE_CANDIDATES + 4)
  if (merged.length === 0) return empty

  // 2. Dedup against the existing corpus.
  const fresh: AcquiredHit[] = []
  for (const hit of merged) {
    if (!(await isDuplicate(payload, hit))) fresh.push(hit)
  }
  if (fresh.length === 0) return { ...empty, searched: merged.length }

  // 3. Keep only scholarly tiers — vendor/web_other excluded from acquisition outright.
  const scholarly = fresh.filter((h) => RESEARCH_TIERS.has(classifyWebTier(h.url, h.title, h.abstract)))
  if (scholarly.length === 0) return { ...empty, searched: merged.length }

  // 4. Grade each survivor with the SAME deepRead appraiser, reading the fetched abstract.
  const synthetics = scholarly.map(toSynthetic)
  const byId = new Map(synthetics.map((s, i) => [s.id, scholarly[i]]))
  const deep = await deepRead(synthetics, q, { maxSelect: synthetics.length })

  // 5. Build evidence items + collect the strong relevant ones for ingest.
  const items: AcquiredItem[] = []
  const toIngest: ReturnType<typeof toIngestPaper>[] = []
  for (const r of deep.selected) {
    if (!r.supports || r.grade === '—') continue
    const hit = byId.get(r.id)
    if (!hit) continue
    const tier = classifyWebTier(hit.url, hit.title, hit.abstract)
    if (!RESEARCH_TIERS.has(tier)) continue
    const grade = enforceGrade(r.grade, tier)
    const claim = (r.finding || hit.title).trim()
    items.push({
      claim,
      grade,
      source: {
        title: hit.title,
        authors: hit.authors,
        url: hit.url,
        type: 'web',
        tier,
        abstract: clampAbstract(hit.abstract),
        acquired: true,
      },
    })
    if (isStrongCard(grade, tier) && toIngest.length < MAX_ACQUIRE) {
      toIngest.push(toIngestPaper(hit, tier, r.finding))
    }
  }

  const ingested = await ingestPapers(opts.origin, toIngest)
  // Only the papers actually written to the library are honestly "newly added"; if ingest no-oped
  // (missing key/origin in a preview), drop the acquired tag so we don't over-claim.
  if (ingested === 0) {
    for (const it of items) it.source.acquired = false
  }
  return { items, searched: merged.length, ingested }
}
