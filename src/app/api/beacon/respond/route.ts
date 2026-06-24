import { auth } from '@/lib/auth'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getPool } from '@/lib/db'
import { Rest } from 'ably'
import { randomUUID } from 'crypto'
import { BEACON_COMMISSIONED_PROMPT } from '@/lib/beacon/commissioned-prompt'
import { callClaude } from '@/lib/beacon/claude'
import { embedQuery } from '@/lib/beacon/embed'
import {
  semanticCandidates,
  keywordCandidates,
  mergeCandidates,
  searchWiki,
  type RetrievedPaper,
} from '@/lib/beacon/retrieval'
import { deepRead, deepSourcesBlock } from '@/lib/beacon/deepread'

/**
 * POST /api/beacon/respond — drive one turn of a commissioned Beacon session (WFM-71, v2 WFM-82).
 *
 * Beacon is a member of type 'agent'. A member runs a commissioned research session in a private DM
 * channel `dm:beacon:<memberId>` (sent via /api/chat/send). After the member posts, the client calls
 * this route; it loads the thread and drives one of two phases:
 *
 *   INTAKE (unchanged behavior) — one Claude call with the commissioned prompt sharpens the question
 *     and asks at most two clarifying questions. When the question is finally sharp, instead of
 *     writing the brief it emits a `<<<READY>>>` control token + the sharpened question.
 *   RESEARCH — semantic kNN over the existing pgvector index (paper_chunks, all-MiniLM-L6-v2 384-dim)
 *     surfaces ~8 candidates; Beacon deep-reads them in ONE structured pass (genuine-fit + specific
 *     finding + A–V grade), selects 3–4 that carry the argument (rest → "considered but not used"),
 *     then drafts the Defensible Position Brief synthesized from those deep reads.
 *
 * Keyword `LIKE` is now only a fallback/recall supplement. Premium gate, auth, the `dm:beacon:` check,
 * Ably publish-back, and the ON CONFLICT (ably_message_id) partial-index insert (hub#31) are unchanged.
 *
 * Body: { channel: string }  — must be `dm:beacon:<sessionMemberId>`.
 * Env:  ANTHROPIC_API_KEY (required), ABLY_API_KEY (required), WFMWIKI_API_URL (optional).
 */

export const runtime = 'nodejs'
// A brief turn runs three sequential Claude calls (planner→READY, deep-read scoring, brief draft);
// the draft alone is ~60s, so the whole turn lands ~75–90s. Needs a Pro-level function ceiling
// (Hobby caps at 60s). Intake turns are a single short call (~5–10s). The "Beacon is researching…"
// UI indicator covers the wait. v1 already made a ~60s single brief-writing call.
export const maxDuration = 300

const READY = '<<<READY>>>'
const CANDIDATE_CAP = 8

interface ChatRow {
  sender_username: string
  sender_type: string
  body: string
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

// Concise coverage hint for the intake call: lets Beacon gauge whether the library has material
// without dumping abstracts (intake does not search/cite — §2 of the prompt).
function coverageHint(candidates: RetrievedPaper[]): string {
  if (candidates.length === 0) {
    return '# LIBRARY COVERAGE\n(no obviously-matching papers surfaced yet — keep sharpening; the deep search runs once the question is sharp.)'
  }
  const lines = candidates
    .slice(0, CANDIDATE_CAP)
    .map((p) => `- "${p.title}" (${p.sourceType}${p.category ? '/' + p.category : ''})`)
  return `# LIBRARY COVERAGE (titles only — do NOT cite yet; full deep-read happens after the question is sharp)\n${lines.join('\n')}`
}

// Surface candidates for a query: semantic kNN primary, keyword LIKE as recall supplement / fallback.
async function surface(
  pool: ReturnType<typeof getPool>,
  payload: Awaited<ReturnType<typeof getPayload>>,
  query: string,
): Promise<RetrievedPaper[]> {
  const vec = await embedQuery(query)
  if (vec) {
    const semantic = await semanticCandidates(pool, payload, vec, { paperK: CANDIDATE_CAP })
    const keyword = await keywordCandidates(payload, query, 6)
    return mergeCandidates(semantic, keyword, CANDIDATE_CAP)
  }
  // Embedding unavailable → degrade gracefully to keyword retrieval (v1 behavior).
  return keywordCandidates(payload, query, CANDIDATE_CAP)
}

async function publishReply(
  pool: ReturnType<typeof getPool>,
  channel: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  beacon: any,
  reply: string,
  metadata: Record<string, unknown>,
) {
  const ablyId = randomUUID()
  const ins = await pool.query<{ id: number; created_at: string }>(
    `INSERT INTO chat_messages
       (channel, sender_id, sender_username, sender_type, sender_display_name, message_type, body, metadata, ably_message_id, parent_id)
     VALUES ($1, $2, $3, 'agent', $4, 'text', $5, $6, $7, NULL)
     ON CONFLICT (ably_message_id) WHERE ably_message_id IS NOT NULL DO NOTHING
     RETURNING id, created_at`,
    [channel, beacon.id, beacon.username, beacon.displayName || 'Beacon', reply, metadata, ablyId],
  )
  const row = ins.rows[0]
  if (row) {
    const ably = new Rest(process.env.ABLY_API_KEY!)
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
        metadata,
        parentId: null,
        timestamp: row.created_at,
      },
    })
  }
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
    return Response.json({ ok: true, skipped: 'no pending member message' })
  }

  const messages = toMessages(rows)
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return Response.json({ ok: true, skipped: 'no user turn' })
  }

  const today = new Date().toISOString().slice(0, 10)
  const base = `${BEACON_COMMISSIONED_PROMPT}\n\nToday is ${today}. The commissioning member is @${member.username}.`

  // Retrieval seed from the most recent member turns (richest once intake has sharpened the question).
  const memberText = rows.filter((r) => r.sender_type !== 'agent').slice(-4).map((r) => r.body).join(' ')

  // ── PHASE 1: INTAKE / PLANNER (single call; behaves exactly like v1 intake, plus a READY signal) ──
  const candidates = await surface(pool, payload, memberText)
  const intakeSystem = `${base}\n\n${coverageHint(candidates)}\n\n## Runtime control (commissioned v2)
You operate in two phases:
1. While the question is NOT yet sharp, behave EXACTLY as INTAKE (§Runtime notes): reply with your short clarifying turn (at most two targeted questions) and STOP. Do not produce a brief and do not search.
2. When — and ONLY when — the question is sharp and ready to research, DO NOT write the brief yet. Instead reply with the control token on the FIRST line and nothing before it:
${READY}
<one or two sentences stating the sharpened research question + the skeptic/context>
A deep-research pass will then read the library in depth and you will draft the brief on the next turn. Never emit ${READY} during a genuine clarifying turn.`

  let intakeReply: string
  try {
    intakeReply = await callClaude(intakeSystem, messages, 1200)
  } catch (e) {
    return Response.json({ error: 'beacon failed to respond', detail: String(e).slice(0, 200) }, { status: 502 })
  }
  if (!intakeReply) return Response.json({ error: 'empty reply' }, { status: 502 })

  const firstLine = intakeReply.split('\n', 1)[0].trim()
  if (!firstLine.startsWith(READY)) {
    // Still in intake — publish the clarifying reply as-is (unchanged behavior) and stop.
    await publishReply(pool, channel, beacon, intakeReply, { commissioned: true, phase: 'intake' })
    return Response.json({ ok: true, reply: intakeReply, phase: 'intake' })
  }

  // ── PHASE 2: RESEARCH — semantic surface → deep-read → select 3–4 → draft brief ──
  const sharpened =
    intakeReply.slice(intakeReply.indexOf(READY) + READY.length).trim() || memberText

  // Re-surface against the sharpened question for the best candidate set, then deep-read it.
  const briefCandidates = await surface(pool, payload, sharpened)
  const [deep, wiki] = await Promise.all([
    deepRead(briefCandidates, sharpened, { maxSelect: 4 }),
    searchWiki(sharpened),
  ])

  const draftSystem = `${base}\n\n${deepSourcesBlock(deep, wiki)}\n\n## Runtime control (commissioned v2)
The question is now sharp and the library has been deep-read for you (the deep-read sources above carry the specific extracted finding + evidence grade for each). Produce the DEFENSIBLE POSITION BRIEF now, using the EXACT §4 structure with inline grades. Synthesize from the deep-read findings — do NOT dump or paraphrase whole abstracts. Cite ONLY the deep-read sources listed above (plus the member's own statements); never cite a paper from the "considered but not used" list as support. Keep §5 (where the evidence runs out) honest, especially where the library is thin.
Sharpened question: ${sharpened}`

  let reply: string
  try {
    reply = await callClaude(draftSystem, messages, 3600)
  } catch (e) {
    return Response.json({ error: 'beacon failed to respond', detail: String(e).slice(0, 200) }, { status: 502 })
  }
  if (!reply) return Response.json({ error: 'empty reply' }, { status: 502 })

  await publishReply(pool, channel, beacon, reply, { commissioned: true, phase: 'brief' })

  return Response.json({
    ok: true,
    reply,
    phase: 'brief',
    sources: {
      candidates: briefCandidates.length,
      selected: deep.selected.length,
      notUsed: deep.notUsed.length,
      wiki: wiki.length,
    },
  })
}
