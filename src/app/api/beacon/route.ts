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

/** Convert plain text to Lexical JSON (matches existing discussions/route.ts pattern) */
function textToLexical(text: string) {
  return {
    root: {
      type: 'root' as const,
      children: text
        .split('\n')
        .filter(Boolean)
        .map((paragraph) => ({
          type: 'paragraph' as const,
          children: [
            {
              type: 'text' as const,
              text: paragraph,
              format: 0,
              detail: 0,
              mode: 'normal' as const,
              style: '',
              version: 1,
            },
          ],
          direction: 'ltr' as const,
          format: '' as const,
          indent: 0,
          version: 1,
        })),
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      version: 1,
    },
  }
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
            body: textToLexical(data.body),
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
            body: textToLexical(data.commentBody),
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
