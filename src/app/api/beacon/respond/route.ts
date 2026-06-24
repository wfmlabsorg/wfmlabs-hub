import { auth } from '@/lib/auth'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getPool } from '@/lib/db'
import { Rest } from 'ably'
import { randomUUID } from 'crypto'
import { BEACON_COMMISSIONED_PROMPT } from '@/lib/beacon/commissioned-prompt'

/**
 * POST /api/beacon/respond  — drive one turn of a commissioned Beacon session (WFM-71).
 *
 * Beacon is a member of type 'agent'. A member runs a commissioned research session in a
 * private DM channel `dm:beacon:<memberId>` (sent via the normal /api/chat/send). After the
 * member posts, the client calls this route; it loads the thread, runs the commissioned
 * session (retrieval over the Research Library + WFMWiki, then Claude with the commissioned
 * instruction set), and posts Beacon's reply back into the channel as an agent message.
 *
 * Body: { channel: string }   — must be `dm:beacon:<sessionMemberId>`.
 * Env:  ANTHROPIC_API_KEY (required), ABLY_API_KEY (required), WFMWIKI_API_URL (optional).
 *
 * v1 retrieval is keyword-based (Payload `like` over title/abstract); it swaps to semantic
 * pgvector retrieval when WFM-70 lands. Privacy: the thread is the member's; nothing here
 * publishes to community canon (the propose→wiki gate is a separate, human-ratified step).
 */

const MODEL = 'claude-sonnet-4-6'

interface ChatRow {
  sender_username: string
  sender_type: string
  body: string
}

interface PaperSource {
  title: string
  authors: string[]
  abstract: string
  sourceType: string
  sourceName: string
  category: string
  url: string
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'with', 'this', 'that', 'have', 'from', 'your',
  'how', 'what', 'why', 'when', 'should', 'would', 'could', 'about', 'into', 'them', 'they', 'our',
  'can', 'will', 'has', 'was', 'were', 'their', 'which', 'than', 'then', 'need', 'want', 'defend',
])

function keywords(text: string, max = 8): string[] {
  const seen = new Set<string>()
  for (const w of text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/)) {
    if (w.length > 3 && !STOPWORDS.has(w)) seen.add(w)
    if (seen.size >= max) break
  }
  return [...seen]
}

// ── retrieval: Research Library (Payload, keyword/v1) ──
async function searchPapers(
  payload: Awaited<ReturnType<typeof getPayload>>,
  query: string,
): Promise<PaperSource[]> {
  const kws = keywords(query)
  if (kws.length === 0) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const or: any[] = kws.flatMap((k) => [{ title: { like: k } }, { abstract: { like: k } }])
  const res = await payload.find({
    collection: 'papers',
    where: { or },
    limit: 12,
    depth: 0,
    overrideAccess: true,
  })
  return res.docs.map((d) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = d as any
    return {
      title: String(p.title || ''),
      authors: Array.isArray(p.authors) ? p.authors.map((a: { name?: string }) => a?.name).filter(Boolean) : [],
      abstract: String(p.abstract || '').slice(0, 600),
      sourceType: String(p.sourceType || 'unknown'),
      sourceName: String(p.sourceName || ''),
      category: String(p.category || ''),
      url: String(p.sourceUrl || ''),
    }
  })
}

// ── retrieval: WFMWiki canon (MediaWiki search, optional) ──
async function searchWiki(query: string): Promise<{ title: string; snippet: string; url: string }[]> {
  const base = process.env.WFMWIKI_API_URL // e.g. https://wiki.wfmlabs.org/api.php
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

function sourcesBlock(papers: PaperSource[], wiki: { title: string; snippet: string; url: string }[]): string {
  if (papers.length === 0 && wiki.length === 0) {
    return '# SOURCES AVAILABLE THIS TURN\n(none retrieved — the library returned nothing for this query; treat the evidence as Absent (—) unless the member supplied facts directly.)'
  }
  const lines: string[] = ['# SOURCES AVAILABLE THIS TURN', 'Cite ONLY these (plus the member’s own statements). Do not recall citations from memory.', '']
  if (wiki.length) {
    lines.push('## WFMWiki canon')
    wiki.forEach((w, i) => lines.push(`[W${i + 1}] ${w.title} — ${w.snippet} (${w.url})`))
    lines.push('')
  }
  if (papers.length) {
    lines.push('## Research Library')
    papers.forEach((p, i) => {
      const auth = p.authors.slice(0, 4).join(', ') || 'n/a'
      lines.push(`[P${i + 1}] "${p.title}" — ${auth}. type=${p.sourceType}${p.sourceName ? `/${p.sourceName}` : ''}; category=${p.category}. ${p.url}\n    abstract: ${p.abstract || '(none)'}`)
    })
  }
  return lines.join('\n')
}

// ── Claude ──
async function callClaude(system: string, messages: { role: 'user' | 'assistant'; content: string }[]): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 3200, system, messages }),
  })
  if (!resp.ok) throw new Error(`Claude ${resp.status}: ${(await resp.text()).slice(0, 200)}`)
  const data = (await resp.json()) as { content?: { text?: string }[] }
  return data.content?.[0]?.text?.trim() || ''
}

// Merge consecutive same-role messages (Anthropic wants clean alternation).
function toMessages(rows: ChatRow[]): { role: 'user' | 'assistant'; content: string }[] {
  const out: { role: 'user' | 'assistant'; content: string }[] = []
  for (const r of rows) {
    const role: 'user' | 'assistant' = r.sender_type === 'agent' ? 'assistant' : 'user'
    const text = (r.body || '').trim()
    if (!text) continue
    const last = out[out.length - 1]
    if (last && last.role === role) last.content += `\n\n${text}`
    else out.push({ role, content: text })
  }
  return out
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.payloadMemberId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!process.env.ABLY_API_KEY) return Response.json({ error: 'chat not configured' }, { status: 503 })

  const body = (await request.json().catch(() => null)) as { channel?: string } | null
  const channel = body?.channel?.trim()
  const memberId = Number(session.user.payloadMemberId)
  if (!channel || channel !== `dm:beacon:${memberId}`) {
    return Response.json({ error: 'invalid or forbidden channel' }, { status: 403 })
  }

  const payload = await getPayload({ config })
  const member = await payload.findByID({ collection: 'members', id: memberId, overrideAccess: true })
  if (!member) return Response.json({ error: 'member not found' }, { status: 404 })

  // Premium gate: commissioned sessions are gated. Admins always; otherwise block the free tier.
  const isAdmin = session.user.role === 'admin'
  if (!isAdmin && member.membershipTier === 'free') {
    return Response.json({ error: 'Commissioned research sessions are a premium feature.' }, { status: 402 })
  }

  const beaconRes = await payload.find({ collection: 'members', where: { username: { equals: 'beacon' } }, limit: 1, overrideAccess: true })
  const beacon = beaconRes.docs[0]
  if (!beacon) return Response.json({ error: 'Beacon agent not found' }, { status: 500 })

  const pool = getPool()
  const hist = await pool.query<ChatRow>(
    `SELECT sender_username, sender_type, body FROM chat_messages
     WHERE channel = $1 AND message_type = 'text' ORDER BY created_at ASC LIMIT 60`,
    [channel],
  )
  const rows = hist.rows
  if (rows.length === 0 || rows[rows.length - 1].sender_type === 'agent') {
    // Nothing new from the member to respond to.
    return Response.json({ ok: true, skipped: 'no pending member message' })
  }

  // Retrieval from the most recent member turns (richest once intake has sharpened the question).
  const memberText = rows.filter((r) => r.sender_type !== 'agent').slice(-4).map((r) => r.body).join(' ')
  const [papers, wiki] = await Promise.all([searchPapers(payload, memberText), searchWiki(memberText)])

  const system = `${BEACON_COMMISSIONED_PROMPT}\n\nToday is ${new Date().toISOString().slice(0, 10)}. The commissioning member is @${member.username}.\n\n${sourcesBlock(papers, wiki)}`
  const messages = toMessages(rows)
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return Response.json({ ok: true, skipped: 'no user turn' })
  }

  let reply: string
  try {
    reply = await callClaude(system, messages)
  } catch (e) {
    return Response.json({ error: 'beacon failed to respond', detail: String(e).slice(0, 200) }, { status: 502 })
  }
  if (!reply) return Response.json({ error: 'empty reply' }, { status: 502 })

  // Post Beacon's reply: persist as an agent message + publish to Ably (mirrors /api/chat/send).
  const ablyId = randomUUID()
  const ins = await pool.query<{ id: number; created_at: string }>(
    `INSERT INTO chat_messages
       (channel, sender_id, sender_username, sender_type, sender_display_name, message_type, body, metadata, ably_message_id, parent_id)
     VALUES ($1, $2, $3, 'agent', $4, 'text', $5, $6, $7, NULL)
     ON CONFLICT (ably_message_id) WHERE ably_message_id IS NOT NULL DO NOTHING
     RETURNING id, created_at`,
    [channel, beacon.id, beacon.username, beacon.displayName || 'Beacon', reply, { commissioned: true }, ablyId],
  )
  const row = ins.rows[0]
  if (row) {
    const ably = new Rest(process.env.ABLY_API_KEY)
    await ably.channels.get(channel).publish({
      id: ablyId,
      name: 'message',
      data: {
        id: row.id,
        body: reply,
        sender: beacon.username,
        senderType: 'agent',
        senderDisplayName: beacon.displayName || 'Beacon',
        messageType: 'text',
        metadata: { commissioned: true },
        parentId: null,
        timestamp: row.created_at,
      },
    })
  }

  return Response.json({ ok: true, reply, sources: { papers: papers.length, wiki: wiki.length } })
}
