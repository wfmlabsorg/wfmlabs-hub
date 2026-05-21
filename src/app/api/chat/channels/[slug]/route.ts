import { auth } from '@/lib/auth'
import { getPool } from '@/lib/db'

// PATCH /api/chat/channels/[slug] — admin only, archive or unarchive a channel
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  const { slug } = await params
  const body = await request.json()
  const { archived } = body as { archived?: boolean }

  if (typeof archived !== 'boolean') {
    return Response.json({ error: 'archived (boolean) is required' }, { status: 400 })
  }

  const pool = getPool()

  let query: string
  if (archived) {
    query = `UPDATE chat_channels SET is_archived = TRUE, is_active = FALSE, archived_at = NOW() WHERE slug = $1`
  } else {
    query = `UPDATE chat_channels SET is_archived = FALSE, is_active = TRUE, archived_at = NULL WHERE slug = $1`
  }

  const result = await pool.query(query, [slug])

  if (result.rowCount === 0) {
    return Response.json({ error: 'channel not found' }, { status: 404 })
  }

  return Response.json({ ok: true })
}
