import { getPayload } from 'payload'
import config from '@payload-config'
import { auth } from '@/lib/auth'

/**
 * POST /api/articles/submit — Member-submitted articles.
 * Creates article in 'draft' status for admin review.
 */

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
        children: items.flatMap((line, i) => { const cleaned = line.replace(/^[-*]\s+/, '\u2022 '); const nodes = parseInline(cleaned); if (i < items.length - 1) nodes.push({ type: 'linebreak' as const, version: 1 } as any); return nodes }),
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

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const payload = await getPayload({ config })

  // Find the member
  const members = await payload.find({
    collection: 'members',
    where: { email: { equals: session.user.email } },
    limit: 1,
  })
  const member = members.docs[0]
  if (!member) {
    return Response.json({ error: 'Member not found' }, { status: 404 })
  }

  let data: { title?: string; category?: string; excerpt?: string; body?: string }
  try {
    data = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!data.title?.trim() || !data.category || !data.body?.trim()) {
    return Response.json({ error: 'Title, category, and body are required' }, { status: 400 })
  }

  const slug = data.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  try {
    const article = await payload.create({
      collection: 'articles',
      data: {
        title: data.title.trim(),
        slug,
        category: data.category as 'think-tank' | 'topic-surface' | 'wiki-highlight' | 'research-finding' | 'opinion' | 'tutorial' | 'industry-analysis',
        excerpt: data.excerpt?.trim() || undefined,
        body: markdownToLexical(data.body),
        primaryContributor: member.id,
        author: member.id,
        status: 'draft',
        tier: 'free',
      },
      overrideAccess: true,
    })

    return Response.json({ success: true, id: article.id, slug }, { status: 201 })
  } catch (e) {
    console.error('Article submit error:', e)
    return Response.json({ error: 'Failed to create article' }, { status: 500 })
  }
}
