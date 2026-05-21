import { auth } from '@/lib/auth'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getPool } from '@/lib/db'
import { Rest } from 'ably'
import { randomUUID } from 'crypto'

// POST /api/chat/send
// Body: { channel, body, clientMsgId?, parentId?, messageType?, metadata? }
//
// Single source of truth for outbound messages: persists to Neon (chat_messages)
// AND publishes to Ably so all subscribers receive it. Sender identity, type, and
// display name are taken from the authenticated session — never trusted from the client.
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.payloadMemberId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ABLY_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'chat not configured' }, { status: 503 })
  }

  const payloadBody = (await request.json().catch(() => null)) as {
    channel?: string
    body?: string
    clientMsgId?: string
    parentId?: number | null
    messageType?: string
    metadata?: Record<string, unknown>
  } | null

  if (!payloadBody) {
    return Response.json({ error: 'invalid json' }, { status: 400 })
  }

  const channel = payloadBody.channel?.trim()
  const text = payloadBody.body?.trim()

  if (!channel) {
    return Response.json({ error: 'channel is required' }, { status: 400 })
  }
  if (!text) {
    return Response.json({ error: 'body is required' }, { status: 400 })
  }
  if (text.length > 4000) {
    return Response.json({ error: 'message too long' }, { status: 400 })
  }

  // Look up the member — identity comes from the server, not the client.
  const payload = await getPayload({ config })
  const member = await payload.findByID({
    collection: 'members',
    id: Number(session.user.payloadMemberId),
    overrideAccess: true,
  })
  if (!member) {
    return Response.json({ error: 'member not found' }, { status: 404 })
  }

  const username = member.username as string
  const displayName = (member.displayName as string) || username
  const senderType = member.type === 'agent' ? 'agent' : 'human'
  const isAdmin = session.user.role === 'admin'

  // Channel publish gate — mirrors the Ably token capabilities in /api/chat/auth.
  const namespace = channel.includes(':') ? channel.split(':')[0] : channel
  const openNamespaces = ['community', 'incident', 'debate', 'dm']
  const adminOnly = ['ops', 'signals']
  if (adminOnly.includes(namespace) && !isAdmin) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!openNamespaces.includes(namespace) && !adminOnly.includes(namespace)) {
    return Response.json({ error: 'unknown channel' }, { status: 400 })
  }

  // Client-supplied id lets the sender's optimistic render dedupe against the
  // Ably echo. Fall back to a fresh UUID if absent/invalid.
  const clientMsgId =
    typeof payloadBody.clientMsgId === 'string' && payloadBody.clientMsgId.length <= 64
      ? payloadBody.clientMsgId
      : randomUUID()

  const messageType = payloadBody.messageType ?? 'text'
  const metadata = payloadBody.metadata ?? null
  const parentId =
    typeof payloadBody.parentId === 'number' && Number.isFinite(payloadBody.parentId)
      ? payloadBody.parentId
      : null

  const pool = getPool()

  // Idempotent insert keyed on ably_message_id (unique partial index from migration 002).
  const result = await pool.query(
    `INSERT INTO chat_messages
       (channel, sender_id, sender_username, sender_type, sender_display_name,
        message_type, body, metadata, ably_message_id, parent_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (ably_message_id) DO NOTHING
     RETURNING id, created_at`,
    [
      channel,
      Number(session.user.payloadMemberId),
      username,
      senderType,
      displayName,
      messageType,
      text,
      metadata,
      clientMsgId,
      parentId,
    ],
  )

  // Duplicate (retry/replay) — already persisted and published. Treat as success.
  if (result.rowCount === 0) {
    return Response.json({ ok: true, deduped: true })
  }

  const row = result.rows[0] as { id: number; created_at: string }

  // Publish to Ably with the same id so subscribers (and the sender's own echo)
  // dedupe consistently against history.
  const ably = new Rest(apiKey)
  await ably.channels.get(channel).publish({
    id: clientMsgId,
    name: 'message',
    data: {
      id: row.id,
      body: text,
      sender: username,
      senderType,
      senderDisplayName: displayName,
      messageType,
      metadata,
      parentId,
      timestamp: row.created_at,
    },
  })

  return Response.json({
    ok: true,
    message: {
      id: row.id,
      ablyMessageId: clientMsgId,
      created_at: row.created_at,
    },
  })
}
