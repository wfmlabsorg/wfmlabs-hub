import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Paper-harvest ingest API — receives auto-harvested research papers from the
 * paper-harvest Cloudflare Worker (roc/workers/paper-harvest) and creates them
 * in the `papers` collection for curator review.
 *
 * POST /api/papers/ingest
 * Headers: X-BEACON-API-KEY: <shared-secret>   (reuses the Beacon worker key — research fleet)
 * Body: { papers: IngestPaper[] }
 *
 * Behaviour:
 *  - Deduplicates against existing papers by canonical sourceUrl (arXiv abs URL or doi.org URL).
 *  - Creates new papers as status 'published' (live on /research immediately), primaryContributor = beacon.
 *  - Returns a per-run summary: { created, skipped, failed, results[] }.
 *
 * The worker does the fetching + Claude summarisation; this route owns the Payload
 * write so slugs, the authors sub-table, and Lexical richText are produced correctly.
 */

const CATEGORIES = [
  'queuing-theory', 'ai-machine-learning', 'operations-management', 'workforce-management',
  'customer-experience', 'analytics-forecasting', 'process-optimization', 'technology',
  'economics-finance', 'employee-wellbeing', 'contact-center-operations',
  'scheduling-optimization', 'other',
] as const
type Category = (typeof CATEGORIES)[number]

const PAPER_TYPES = [
  'empirical-study', 'literature-review', 'mathematical-model', 'industry-report',
  'framework', 'case-study', 'reference',
] as const
type PaperType = (typeof PAPER_TYPES)[number]

const SOURCE_TYPES = ['arxiv', 'ssrn', 'journal', 'industry-report', 'blog', 'vendor-research', 'manual'] as const
type SourceType = (typeof SOURCE_TYPES)[number]

interface IngestPaper {
  title: string
  sourceUrl: string
  sourceType?: string
  sourceName?: string
  paperType?: string
  category?: string
  authors?: { name: string; affiliation?: string }[]
  abstract?: string
  publicationDate?: string // ISO date
  summary?: string // Claude-generated curator summary (markdown)
  whyItMatters?: string // Claude-generated relevance note (markdown)
}

interface IngestBody {
  papers?: IngestPaper[]
}

// ── markdown → Lexical (mirrors src/app/api/beacon/route.ts) ──

function markdownToLexical(text: string) {
  const blocks = text.split(/\n\n+/).filter(Boolean)
  const children = blocks.map((block) => {
    const trimmed = block.trim()
    const h2Match = trimmed.match(/^##\s+(.+)/)
    if (h2Match) {
      return { type: 'heading' as const, tag: 'h2' as const, children: parseInline(h2Match[1]), direction: 'ltr' as const, format: '' as const, indent: 0, version: 1 }
    }
    const h3Match = trimmed.match(/^###\s+(.+)/)
    if (h3Match) {
      return { type: 'heading' as const, tag: 'h3' as const, children: parseInline(h3Match[1]), direction: 'ltr' as const, format: '' as const, indent: 0, version: 1 }
    }
    if (trimmed.match(/^[-*]\s/m)) {
      const items = trimmed.split(/\n/).filter((l) => l.trim())
      return {
        type: 'paragraph' as const,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        children: items.flatMap((line, i) => { const cleaned = line.replace(/^[-*]\s+/, '• '); const nodes = parseInline(cleaned); if (i < items.length - 1) nodes.push({ type: 'linebreak' as const, version: 1 } as any); return nodes }),
        direction: 'ltr' as const, format: '' as const, indent: 0, version: 1,
      }
    }
    return { type: 'paragraph' as const, children: parseInline(trimmed.replace(/\n/g, ' ')), direction: 'ltr' as const, format: '' as const, indent: 0, version: 1 }
  })
  return { root: { type: 'root', children, direction: 'ltr' as const, format: '' as const, indent: 0, version: 1 } }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseInline(text: string): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodes: any[] = []
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((.+?)\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(tn(text.slice(lastIndex, match.index), 0))
    if (match[2]) nodes.push(tn(match[2], 1))
    else if (match[3]) nodes.push(tn(match[3], 2))
    else if (match[4] && match[5]) nodes.push({ type: 'link', children: [tn(match[4], 0)], direction: 'ltr', format: '', indent: 0, version: 3, fields: { linkType: 'custom', url: match[5], newTab: match[5].startsWith('http') } })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) nodes.push(tn(text.slice(lastIndex), 0))
  if (nodes.length === 0) nodes.push(tn(text, 0))
  return nodes
}
function tn(text: string, format: number) { return { type: 'text', text, format, detail: 0, mode: 'normal', style: '', version: 1 } }

// ── helpers ──

function slugify(title: string, sourceUrl: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70)
  // canonical id fragment from the source URL keeps slugs unique across similar titles
  const idFrag = (sourceUrl.split(/[/?#]/).filter(Boolean).pop() || '').replace(/[^a-z0-9.]/gi, '').slice(0, 16)
  return idFrag ? `${base}-${idFrag}` : base
}

function pick<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

async function getBeaconMemberId(payload: Awaited<ReturnType<typeof getPayload>>): Promise<number | null> {
  const result = await payload.find({ collection: 'members', where: { username: { equals: 'beacon' } }, limit: 1 })
  return result.docs.length ? (result.docs[0].id as number) : null
}

export async function POST(req: Request) {
  const apiKey = req.headers.get('x-beacon-api-key')
  if (!apiKey || !process.env.BEACON_API_KEY || apiKey !== process.env.BEACON_API_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: IngestBody
  try {
    body = (await req.json()) as IngestBody
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const papers = Array.isArray(body.papers) ? body.papers : []
  if (papers.length === 0) {
    return Response.json({ error: 'Body must include a non-empty `papers` array' }, { status: 400 })
  }
  if (papers.length > 50) {
    return Response.json({ error: 'Too many papers in one request (max 50)' }, { status: 400 })
  }

  const payload = await getPayload({ config })
  const beaconId = await getBeaconMemberId(payload)
  if (!beaconId) {
    return Response.json({ error: 'Beacon member account not found. Run seed-beacon.ts first.' }, { status: 500 })
  }

  const results: { sourceUrl: string; status: 'created' | 'skipped' | 'failed'; id?: number | string; reason?: string }[] = []

  for (const p of papers) {
    const sourceUrl = (p.sourceUrl || '').trim()
    if (!p.title?.trim() || !sourceUrl) {
      results.push({ sourceUrl: sourceUrl || '(missing)', status: 'failed', reason: 'title and sourceUrl are required' })
      continue
    }

    try {
      // Dedup by canonical sourceUrl
      const existing = await payload.find({
        collection: 'papers',
        where: { sourceUrl: { equals: sourceUrl } },
        limit: 1,
        depth: 0,
      })
      if (existing.docs.length > 0) {
        results.push({ sourceUrl, status: 'skipped', reason: 'already in corpus', id: existing.docs[0].id as number })
        continue
      }

      const category = pick<Category>(p.category, CATEGORIES, 'workforce-management')
      const paperType = pick<PaperType>(p.paperType, PAPER_TYPES, 'empirical-study')
      const sourceType = pick<SourceType>(p.sourceType, SOURCE_TYPES, 'arxiv')
      const authors = (p.authors || [])
        .filter((a) => a?.name?.trim())
        .slice(0, 30)
        .map((a) => ({ name: a.name.trim(), affiliation: a.affiliation?.trim() || undefined }))

      const created = await payload.create({
        collection: 'papers',
        data: {
          title: p.title.trim(),
          slug: slugify(p.title, sourceUrl),
          primaryContributor: beaconId,
          sourceUrl,
          sourceType,
          sourceName: p.sourceName?.trim() || undefined,
          paperType,
          category,
          authors,
          abstract: p.abstract?.trim() || undefined,
          ...(p.summary?.trim() ? { curatorSummary: markdownToLexical(p.summary) } : {}),
          ...(p.whyItMatters?.trim() ? { whyItMatters: markdownToLexical(p.whyItMatters) } : {}),
          description: p.abstract?.trim()?.slice(0, 280) || undefined,
          status: 'published',
          tier: 'free',
          publishedAt: p.publicationDate || new Date().toISOString(),
        },
        overrideAccess: true,
      })

      results.push({ sourceUrl, status: 'created', id: created.id as number })
    } catch (e) {
      console.error('Paper ingest error:', e)
      results.push({ sourceUrl, status: 'failed', reason: String(e).slice(0, 200) })
    }
  }

  const summary = {
    created: results.filter((r) => r.status === 'created').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    failed: results.filter((r) => r.status === 'failed').length,
  }
  return Response.json({ success: true, ...summary, results }, { status: 201 })
}
