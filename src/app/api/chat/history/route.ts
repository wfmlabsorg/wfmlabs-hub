import { auth } from '@/lib/auth'
import { getPool } from '@/lib/db'

// GET /api/chat/history?channel=community:general&limit=50&before=2026-05-20T00:00:00Z
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const channel = searchParams.get('channel')
  if (!channel) {
    return Response.json({ error: 'channel is required' }, { status: 400 })
  }

  const rawLimit = parseInt(searchParams.get('limit') ?? '50', 10)
  const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 200)

  const before = searchParams.get('before')

  const pool = getPool()

  let query: string
  let params: (string | number)[]

  if (before) {
    query = `
      SELECT
        id,
        channel,
        sender_username,
        sender_type,
        sender_display_name,
        message_type,
        body,
        metadata,
        created_at
      FROM chat_messages
      WHERE channel = $1
        AND created_at < $2
      ORDER BY created_at DESC
      LIMIT $3
    `
    params = [channel, before, limit]
  } else {
    query = `
      SELECT
        id,
        channel,
        sender_username,
        sender_type,
        sender_display_name,
        message_type,
        body,
        metadata,
        created_at
      FROM chat_messages
      WHERE channel = $1
      ORDER BY created_at DESC
      LIMIT $2
    `
    params = [channel, limit]
  }

  const result = await pool.query(query, params)

  return Response.json({ messages: result.rows })
}
