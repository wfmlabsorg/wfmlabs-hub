import { auth } from '@/lib/auth'
import { getPool } from '@/lib/db'
import { getPayload } from 'payload'
import config from '@payload-config'

// GET /api/chat/dm — list the user's DM conversations
export async function GET() {
  const session = await auth()
  if (!session?.user?.payloadMemberId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const payload = await getPayload({ config })
  const me = await payload.findByID({
    collection: 'members',
    id: Number(session.user.payloadMemberId),
    overrideAccess: true,
  })
  if (!me) {
    return Response.json({ error: 'member not found' }, { status: 404 })
  }

  const myUsername = me.username as string
  const pool = getPool()

  const result = await pool.query(
    `SELECT DISTINCT channel,
      (SELECT body FROM chat_messages cm2 WHERE cm2.channel = cm.channel ORDER BY created_at DESC LIMIT 1) AS last_message,
      (SELECT created_at FROM chat_messages cm2 WHERE cm2.channel = cm.channel ORDER BY created_at DESC LIMIT 1) AS last_message_at
    FROM chat_messages cm
    WHERE channel LIKE 'dm:%'
      AND (
        sender_username = $1
        OR channel LIKE '%:' || $1 || ':%'
        OR channel LIKE '%:' || $1
      )
    ORDER BY last_message_at DESC
    LIMIT 50`,
    [myUsername],
  )

  // For each channel, extract the other username and look up their display name
  const conversations = await Promise.all(
    result.rows.map(async (row: { channel: string; last_message: string; last_message_at: string }) => {
      // Channel format: dm:{user1}:{user2} (sorted alphabetically)
      const parts = row.channel.split(':')
      const otherUsername = parts[1] === myUsername ? parts[2] : parts[1]

      const targetResult = await payload.find({
        collection: 'members',
        where: { username: { equals: otherUsername } },
        limit: 1,
        overrideAccess: true,
      })

      const target = targetResult.docs[0]

      return {
        channel: row.channel,
        otherUser: otherUsername,
        otherDisplayName: (target?.displayName as string) || otherUsername,
        otherType: (target?.type as string) || 'member',
        lastMessage: row.last_message ?? null,
        lastMessageAt: row.last_message_at ?? null,
      }
    }),
  )

  return Response.json({ conversations })
}

// POST /api/chat/dm — start or resolve a DM conversation channel name
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.payloadMemberId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const targetUsername = body?.targetUsername as string | undefined
  if (!targetUsername) {
    return Response.json({ error: 'targetUsername is required' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  // Look up current user's username
  const me = await payload.findByID({
    collection: 'members',
    id: Number(session.user.payloadMemberId),
    overrideAccess: true,
  })
  if (!me) {
    return Response.json({ error: 'member not found' }, { status: 404 })
  }

  const myUsername = me.username as string

  // Verify target exists
  const targetResult = await payload.find({
    collection: 'members',
    where: { username: { equals: targetUsername } },
    limit: 1,
    overrideAccess: true,
  })
  if (!targetResult.docs[0]) {
    return Response.json({ error: 'target user not found' }, { status: 404 })
  }

  const sorted = [myUsername, targetUsername].sort()
  const channel = `dm:${sorted[0]}:${sorted[1]}`

  return Response.json({ channel })
}
