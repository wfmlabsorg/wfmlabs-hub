import { auth } from '@/lib/auth'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getPool } from '@/lib/db'
import { randomUUID } from 'crypto'

/**
 * POST /api/beacon/propose — the §6 propose→published trust gate (WFM-71 / PR3).
 *
 * A commissioned brief is PRIVATE to the member. When a session produces a *generalizable*
 * insight, the member can opt to contribute it: this route asks Beacon to write a SANITIZED,
 * member-stripped version and creates a `wiki-entries` record at status 'proposed'. A human
 * ratifies it to 'published' in the admin — Beacon never publishes member-specific work itself.
 *
 * Body: { channel: string }  — must be the caller's own `dm:beacon:<memberId>`.
 */

const MODEL = 'claude-sonnet-4-6'

const WIKI_CATEGORIES = ['concept', 'process', 'metric', 'technology', 'framework', 'role', 'glossary'] as const
type WikiCategory = (typeof WIKI_CATEGORIES)[number]

// ── markdown → Lexical (compact; mirrors the other Beacon routes) ──
function markdownToLexical(text: string) {
  const blocks = text.split(/\n\n+/).filter(Boolean)
  const children = blocks.map((block) => {
    const t = block.trim()
    const h2 = t.match(/^##\s+(.+)/)
    if (h2) return { type: 'heading' as const, tag: 'h2' as const, children: [tn(h2[1])], direction: 'ltr' as const, format: '' as const, indent: 0, version: 1 }
    const h3 = t.match(/^###\s+(.+)/)
    if (h3) return { type: 'heading' as const, tag: 'h3' as const, children: [tn(h3[1])], direction: 'ltr' as const, format: '' as const, indent: 0, version: 1 }
    return { type: 'paragraph' as const, children: [tn(t.replace(/\n/g, ' '))], direction: 'ltr' as const, format: '' as const, indent: 0, version: 1 }
  })
  return { root: { type: 'root', children, direction: 'ltr' as const, format: '' as const, indent: 0, version: 1 } }
}
function tn(text: string) {
  return { type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 }
}

function slugify(title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70)
  return `${base || 'beacon-insight'}-${randomUUID().slice(0, 8)}`
}

const SANITIZE_PROMPT = `You are Beacon, curating community canon. Below is the transcript of a PRIVATE commissioned research session with a member. Decide whether it produced a GENERALIZABLE insight worth proposing to the community wiki, and if so write a SANITIZED version.

Hard rules:
- STRIP everything member-specific: the member's name/username, their company, their exact numbers/targets, their particular context. Keep ONLY the generalizable, evidence-backed insight that would help any WFM practitioner.
- Only propose if there is a genuine, evidence-grounded, generalizable insight. If the session was too specific, inconclusive, or the evidence was absent, do NOT propose.
- Cite ONLY sources that actually appeared in the session. Never fabricate a source, title, author, or stat.
- Neutral, encyclopedic tone — this is canon, not a position brief. State the insight, note the strength of evidence (A–V scale), and where the evidence runs out.

Respond ONLY with minified JSON (no markdown fence) of shape:
{"propose": boolean, "reason": string, "title": string, "category": one of ["concept","process","metric","technology","framework","role","glossary"], "body": string (markdown, 2-5 short paragraphs), "sources": [{"label": string, "url": string, "note": string}]}`

async function callClaude(system: string, user: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1800, system, messages: [{ role: 'user', content: user }] }),
  })
  if (!resp.ok) throw new Error(`Claude ${resp.status}: ${(await resp.text()).slice(0, 200)}`)
  const data = (await resp.json()) as { content?: { text?: string }[] }
  return data.content?.[0]?.text?.trim() || ''
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.payloadMemberId) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { channel?: string } | null
  const memberId = Number(session.user.payloadMemberId)
  if (!body?.channel || body.channel !== `dm:beacon:${memberId}`) {
    return Response.json({ error: 'invalid or forbidden channel' }, { status: 403 })
  }

  const payload = await getPayload({ config })
  const member = await payload.findByID({ collection: 'members', id: memberId, overrideAccess: true })
  if (!member) return Response.json({ error: 'member not found' }, { status: 404 })
  const isAdmin = session.user.role === 'admin'
  if (!isAdmin && member.membershipTier === 'free') {
    return Response.json({ error: 'Commissioned research sessions are a premium feature.' }, { status: 402 })
  }

  const beaconRes = await payload.find({ collection: 'members', where: { username: { equals: 'beacon' } }, limit: 1, overrideAccess: true })
  const beacon = beaconRes.docs[0]
  if (!beacon) return Response.json({ error: 'Beacon agent not found' }, { status: 500 })

  // Load the session transcript (sanitised server-side; never published verbatim).
  const pool = getPool()
  const hist = await pool.query<{ sender_display_name: string; sender_type: string; body: string }>(
    `SELECT sender_display_name, sender_type, body FROM chat_messages
     WHERE channel = $1 AND message_type = 'text' ORDER BY created_at ASC LIMIT 80`,
    [body.channel],
  )
  if (hist.rows.length < 2) {
    return Response.json({ error: 'Not enough of a session to propose anything yet.' }, { status: 400 })
  }
  const transcript = hist.rows
    .map((r) => `${r.sender_type === 'agent' ? 'Beacon' : 'Member'}: ${r.body}`)
    .join('\n\n')
    .slice(0, 24000)

  let parsed: { propose?: boolean; reason?: string; title?: string; category?: string; body?: string; sources?: { label?: string; url?: string; note?: string }[] }
  try {
    const raw = await callClaude(SANITIZE_PROMPT, `TRANSCRIPT:\n\n${transcript}`)
    parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
  } catch (e) {
    return Response.json({ error: 'Beacon could not assess this session', detail: String(e).slice(0, 200) }, { status: 502 })
  }

  if (!parsed.propose || !parsed.title?.trim() || !parsed.body?.trim()) {
    return Response.json({ proposed: false, reason: parsed.reason || 'No generalizable insight to propose from this session yet.' })
  }

  const category: WikiCategory = (WIKI_CATEGORIES as readonly string[]).includes(parsed.category || '')
    ? (parsed.category as WikiCategory)
    : 'concept'
  const sources = (parsed.sources || [])
    .filter((s) => s?.label?.trim())
    .slice(0, 20)
    .map((s) => ({ label: s.label!.trim(), url: s.url?.trim() || undefined, note: s.note?.trim() || undefined }))

  try {
    const entry = await payload.create({
      collection: 'wiki-entries',
      data: {
        title: parsed.title.trim(),
        slug: slugify(parsed.title),
        primaryContributor: beacon.id,
        category,
        body: markdownToLexical(parsed.body),
        description: 'Proposed by Beacon from a commissioned research session (sanitized).',
        status: 'proposed',
        tier: 'free',
        ...(sources.length ? { sources } : {}),
      },
      overrideAccess: true,
    })
    return Response.json({ proposed: true, id: entry.id, title: parsed.title.trim() }, { status: 201 })
  } catch (e) {
    console.error('Beacon propose error:', e)
    return Response.json({ error: 'Failed to create proposed entry', detail: String(e).slice(0, 200) }, { status: 500 })
  }
}
