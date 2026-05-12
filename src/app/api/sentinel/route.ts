import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Sentinel Agent API — receives incident reports from the Sentinel Worker.
 *
 * POST /api/sentinel
 * Headers: X-SENTINEL-API-KEY: <shared-secret>
 * Body: { action, title?, body?, slug?, severity?, category?, regionId?, regionName?, metadata? }
 */

type SentinelAction = 'incident' | 'summary' | 'signal'

interface SentinelPayload {
  action: SentinelAction
  // Shared
  title?: string
  body?: string
  slug?: string
  severity?: number
  severityLabel?: 'info' | 'moderate' | 'severe' | 'extreme'
  category?:
    | 'weather'
    | 'seismic'
    | 'disaster'
    | 'events'
    | 'cyber'
    | 'infrastructure'
    | 'health'
    | 'financial'
    | 'general'
  regionId?: string
  regionName?: string
  tags?: string[]
  metadata?: Record<string, unknown>
  sourceUrl?: string
}

/**
 * Convert markdown text to Lexical JSON.
 * Handles: **bold**, *italic*, [links](url), headings, paragraphs.
 */
function markdownToLexical(text: string) {
  const blocks = text.split(/\n\n+/).filter(Boolean)

  const children = blocks.map((block) => {
    const trimmed = block.trim()

    // Headings
    const h2Match = trimmed.match(/^##\s+(.+)/)
    if (h2Match) {
      return {
        type: 'heading' as const,
        tag: 'h2' as const,
        children: parseInline(h2Match[1]),
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
        version: 1,
      }
    }
    const h3Match = trimmed.match(/^###\s+(.+)/)
    if (h3Match) {
      return {
        type: 'heading' as const,
        tag: 'h3' as const,
        children: parseInline(h3Match[1]),
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
        version: 1,
      }
    }

    // List items → paragraph (simplified)
    if (trimmed.match(/^[-*]\s/m)) {
      const items = trimmed.split(/\n/).filter((l) => l.trim())
      return {
        type: 'paragraph' as const,
        children: items.flatMap((line, i) => {
          const cleaned = line.replace(/^[-*]\s+/, '• ')
          const nodes = parseInline(cleaned)
          if (i < items.length - 1) {
            nodes.push({ type: 'linebreak' as const, version: 1 } as any)
          }
          return nodes
        }),
        direction: 'ltr' as const,
        format: '' as const,
        indent: 0,
        version: 1,
      }
    }

    // Regular paragraph
    return {
      type: 'paragraph' as const,
      children: parseInline(trimmed.replace(/\n/g, ' ')),
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      version: 1,
    }
  })

  return {
    root: {
      type: 'root',
      children,
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      version: 1,
    },
  }
}

/** Parse inline markdown: **bold**, *italic*, [text](url) */
function parseInline(text: string): any[] {
  const nodes: any[] = []
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((.+?)\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(textNode(text.slice(lastIndex, match.index), 0))
    }

    if (match[2]) {
      nodes.push(textNode(match[2], 1)) // bold
    } else if (match[3]) {
      nodes.push(textNode(match[3], 2)) // italic
    } else if (match[4] && match[5]) {
      nodes.push({
        type: 'link',
        children: [textNode(match[4], 0)],
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 3,
        fields: { linkType: 'custom', url: match[5], newTab: match[5].startsWith('http') },
      })
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    nodes.push(textNode(text.slice(lastIndex), 0))
  }

  if (nodes.length === 0) {
    nodes.push(textNode(text, 0))
  }

  return nodes
}

function textNode(text: string, format: number) {
  return { type: 'text', text, format, detail: 0, mode: 'normal', style: '', version: 1 }
}

async function getSentinelMemberId(
  payload: Awaited<ReturnType<typeof getPayload>>
): Promise<number | null> {
  const result = await payload.find({
    collection: 'members',
    where: { username: { equals: 'sentinel' } },
    limit: 1,
  })
  if (result.docs.length === 0) return null
  return result.docs[0].id as number
}

export async function POST(req: Request) {
  // Auth: validate X-SENTINEL-API-KEY
  const apiKey = req.headers.get('x-sentinel-api-key')
  if (!apiKey || !process.env.SENTINEL_API_KEY || apiKey !== process.env.SENTINEL_API_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let data: SentinelPayload
  try {
    data = (await req.json()) as SentinelPayload
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!data.action || !['incident', 'summary', 'signal'].includes(data.action)) {
    return Response.json(
      { error: 'Invalid or missing action. Must be: incident | summary | signal' },
      { status: 400 }
    )
  }

  const payload = await getPayload({ config })
  const sentinelId = await getSentinelMemberId(payload)
  if (!sentinelId) {
    return Response.json(
      { error: 'Sentinel member account not found. Run seed-sentinel.ts first.' },
      { status: 500 }
    )
  }

  try {
    switch (data.action) {
      case 'incident': {
        if (!data.title || !data.body) {
          return Response.json(
            { error: 'incident action requires title and body' },
            { status: 400 }
          )
        }

        // Always create a Signal
        const signal = await payload.create({
          collection: 'signals',
          data: {
            signalType: 'alert',
            title: data.title,
            message: data.body,
            source: 'sentinel',
            severity: data.severity,
            severityLabel: data.severityLabel,
            category: data.category,
            regionId: data.regionId,
            regionName: data.regionName,
            author: sentinelId,
            sourceUrl: data.sourceUrl,
            metadata: data.metadata,
          },
          overrideAccess: true,
        })

        // If severity >= 7, also publish an Article
        let articleId: number | undefined
        if (data.severity !== undefined && data.severity >= 7) {
          const slug =
            data.slug ||
            data.title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '')

          let topicIds: number[] = []
          if (data.tags && data.tags.length > 0) {
            const topics = await payload.find({
              collection: 'topics',
              where: { slug: { in: data.tags } },
              limit: 20,
            })
            topicIds = topics.docs.map((t) => t.id as number)
          }

          const article = await payload.create({
            collection: 'articles',
            data: {
              title: data.title,
              slug,
              body: markdownToLexical(data.body),
              primaryContributor: sentinelId,
              author: sentinelId,
              status: 'published',
              publishedAt: new Date().toISOString(),
              publishDate: new Date().toISOString(),
              category: 'industry-analysis',
              description: data.category
                ? `[Incident: ${data.category}] Severity ${data.severity}/10`
                : undefined,
              tier: 'free',
              ...(topicIds.length > 0 ? { topics: topicIds } : {}),
            },
            overrideAccess: true,
          })

          articleId = article.id as number
        }

        return Response.json(
          {
            success: true,
            signalId: signal.id,
            ...(articleId ? { articleId } : {}),
          },
          { status: 201 }
        )
      }

      case 'summary': {
        if (!data.title || !data.body) {
          return Response.json(
            { error: 'summary action requires title and body' },
            { status: 400 }
          )
        }

        const slug =
          data.slug ||
          data.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')

        let topicIds: number[] = []
        if (data.tags && data.tags.length > 0) {
          const topics = await payload.find({
            collection: 'topics',
            where: { slug: { in: data.tags } },
            limit: 20,
          })
          topicIds = topics.docs.map((t) => t.id as number)
        }

        const article = await payload.create({
          collection: 'articles',
          data: {
            title: data.title,
            slug,
            body: markdownToLexical(data.body),
            primaryContributor: sentinelId,
            author: sentinelId,
            status: 'published',
            publishedAt: new Date().toISOString(),
            publishDate: new Date().toISOString(),
            category: 'industry-analysis',
            description: 'Daily OVIX Summary',
            tier: 'free',
            ...(topicIds.length > 0 ? { topics: topicIds } : {}),
          },
          overrideAccess: true,
        })

        return Response.json({ success: true, id: article.id }, { status: 201 })
      }

      case 'signal': {
        if (!data.title || !data.body) {
          return Response.json(
            { error: 'signal action requires title and body' },
            { status: 400 }
          )
        }

        const signal = await payload.create({
          collection: 'signals',
          data: {
            signalType: 'alert',
            title: data.title,
            message: data.body,
            source: 'sentinel',
            severity: data.severity,
            severityLabel: data.severityLabel,
            category: data.category,
            regionId: data.regionId,
            regionName: data.regionName,
            author: sentinelId,
            sourceUrl: data.sourceUrl,
            metadata: data.metadata,
          },
          overrideAccess: true,
        })

        return Response.json({ success: true, id: signal.id }, { status: 201 })
      }

      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e) {
    console.error('Sentinel API error:', e)
    return Response.json({ error: 'Server error', detail: String(e) }, { status: 500 })
  }
}
