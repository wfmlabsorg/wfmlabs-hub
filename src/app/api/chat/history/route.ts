import { auth } from '@/lib/auth'
import { getPool } from '@/lib/db'

// GET /api/chat/history?channel=community:general&limit=50&before=2026-05-20T00:00:00Z&parent_id=123
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
  const parentId = searchParams.get('parent_id')

  const pool = getPool()

  const params: (string | number)[] = [channel]
  let whereClause = `WHERE channel = $1 AND deleted = FALSE`

  if (before) {
    params.push(before)
    whereClause += ` AND created_at < $${params.length}`
  }

  // Thread replies vs root messages
  if (parentId !== null) {
    params.push(parentId)
    whereClause += ` AND parent_id = $${params.length}`
  } else {
    whereClause += ` AND parent_id IS NULL`
  }

  params.push(limit)
  const query = `
    SELECT
      id,
      channel,
      sender_username,
      sender_type,
      sender_display_name,
      message_type,
      body,
      metadata,
      ably_message_id,
      parent_id,
      edited,
      created_at
    FROM chat_messages
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${params.length}
  `

  const result = await pool.query(query, params)

  return Response.json({ messages: result.rows })
}
