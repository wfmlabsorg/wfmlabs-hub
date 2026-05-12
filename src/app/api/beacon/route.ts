import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Beacon Agent API — receives content from the Beacon Worker.
 *
 * POST /api/beacon
 * Headers: X-BEACON-API-KEY: <shared-secret>
 * Body: { action, title?, body?, slug?, articleId?, commentBody?, tags?, category? }
 */

type BeaconAction = 'post' | 'comment' | 'engage'

interface BeaconPayload {
  action: BeaconAction
  // For 'post'
  title?: string
  body?: string
  slug?: string
  category?: string
  tags?: string[]
  // For 'comment' / 'engage'
  articleId?: number | string
  commentBody?: string
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
        type: 'heading' as const, tag: 'h2' as const,
        children: parseInline(h2Match[1]),
        direction: 'ltr' as const, format: '' as const, indent: 0, version: 1,
      }
    }
    const h3Match = trimmed.match(/^###\s+(.+)/)
    if (h3Match) {
      return {
        type: 'heading' as const, tag: 'h3' as const,
        children: parseInline(h3Match[1]),
        direction: 'ltr' as const, format: '' as const, indent: 0, version: 1,
      }
    }

    // List items → paragraph (simplified)
    if (trimmed.match(/^[-*]\s/m)) {
      const items = trimmed.split(/\n/).filter(l => l.trim())
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
        direction: 'ltr' as const, format: '' as const, indent: 0, version: 1,
      }
    }

    // Regular paragraph
    return {
      type: 'paragraph' as const,
      children: parseInline(trimmed.replace(/\n/g, ' ')),
      direction: 'ltr' as const, format: '' as const, indent: 0, version: 1,
    }
  })

  return { root: { type: 'root', children, direction: 'ltr' as const, format: '' as const, indent: 0, version: 1 } }
}

/** Parse inline markdown: **bold**, *italic*, [links](url) */
function parseInline(text: string): any[] {
  const nodes: any[] = []
  // Regex to match **bold**, *italic*, [text](url)
  const pattern = /(\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((.+?)\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    // Text before this match
    if (match.index > lastIndex) {
      nodes.push(textNode(text.slice(lastIndex, match.index), 0))
    }

    if (match[2]) {
      // **bold**
      nodes.push(textNode(match[2], 1)) // format 1 = bold
    } else if (match[3]) {
      // *italic*
      nodes.push(textNode(match[3], 2)) // format 2 = italic
    } else if (match[4] && match[5]) {
      // [text](url)
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

  // Remaining text
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

async function getBeaconMemberId(payload: Awaited<ReturnType<typeof getPayload>>): Promise<number | null> {
  const result = await payload.find({
    collection: 'members',
    where: { username: { equals: 'beacon' } },
    limit: 1,
  })
  if (result.docs.length === 0) return null
  return result.docs[0].id as number
}

export async function POST(req: Request) {
  // Auth: validate X-BEACON-API-KEY
  const apiKey = req.headers.get('x-beacon-api-key')
  if (!apiKey || !process.env.BEACON_API_KEY || apiKey !== process.env.BEACON_API_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let data: BeaconPayload
  try {
    data = (await req.json()) as BeaconPayload
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!data.action || !['post', 'comment', 'engage'].includes(data.action)) {
    return Response.json({ error: 'Invalid or missing action. Must be: post | comment | engage' }, { status: 400 })
  }

  const payload = await getPayload({ config })
  const beaconId = await getBeaconMemberId(payload)
  if (!beaconId) {
    return Response.json({ error: 'Beacon member account not found. Run seed-beacon.ts first.' }, { status: 500 })
  }

  try {
    switch (data.action) {
      case 'post': {
        if (!data.title || !data.body) {
          return Response.json({ error: 'post action requires title and body' }, { status: 400 })
        }

        const slug = data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

        // Find topic IDs if tags provided
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
            primaryContributor: beaconId,
            author: beaconId,
            status: 'published',
            publishedAt: new Date().toISOString(),
            publishDate: new Date().toISOString(),
            description: data.category ? `[${data.category}]` : undefined,
            tier: 'free',
            ...(topicIds.length > 0 ? { topics: topicIds } : {}),
          },
          overrideAccess: true,
        })

        return Response.json({ success: true, id: article.id }, { status: 201 })
      }

      case 'comment':
      case 'engage': {
        if (!data.articleId || !data.commentBody) {
          return Response.json({ error: `${data.action} action requires articleId and commentBody` }, { status: 400 })
        }

        const discussion = await payload.create({
          collection: 'discussions',
          data: {
            asset: {
              relationTo: 'articles',
              value: Number(data.articleId),
            },
            author: beaconId,
            body: markdownToLexical(data.commentBody),
            isResolved: false,
            reactionCount: 0,
          },
          overrideAccess: true,
        })

        return Response.json({ success: true, id: discussion.id }, { status: 201 })
      }

      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e) {
    console.error('Beacon API error:', e)
    return Response.json({ error: 'Server error', detail: String(e) }, { status: 500 })
  }
}
