import { auth } from '@/lib/auth'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getPool } from '@/lib/db'

interface Channel {
  name: string
  label: string
  section: string
  channelType?: string
  description?: string
}

// GET /api/chat/channels — returns channels the user can access
// Optional: ?type=community,operational,regional (comma-separated filter)
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.payloadMemberId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Look up username from Payload
  const payload = await getPayload({ config })
  const member = await payload.findByID({
    collection: 'members',
    id: Number(session.user.payloadMemberId),
    overrideAccess: true,
  })
  const username = (member?.username as string) ?? ''

  const { searchParams } = new URL(request.url)
  const typeFilter = searchParams.get('type')
  const allowedTypes = typeFilter ? typeFilter.split(',').map((t) => t.trim()) : null

  const pool = getPool()
  const channels: Channel[] = []

  // Registered chat channels from chat_channels table
  try {
    let query = `SELECT slug, channel_type, name, description FROM chat_channels WHERE is_active = TRUE AND is_archived = FALSE`
    const params: string[] = []
    if (allowedTypes && allowedTypes.length > 0) {
      const placeholders = allowedTypes.map((_, i) => `$${i + 1}`).join(', ')
      query += ` AND channel_type IN (${placeholders})`
      params.push(...allowedTypes)
    }
    const result = await pool.query<{
      slug: string
      channel_type: string
      name: string
      description: string | null
    }>(query, params)
    for (const row of result.rows) {
      channels.push({
        name: `${row.channel_type}:${row.slug}`,
        label: row.name,
        section: row.channel_type,
        channelType: row.channel_type,
        description: row.description ?? undefined,
      })
    }
  } catch {
    // chat_channels not accessible — skip
  }

  // Active incident channels
  try {
    const incidentResult = await pool.query<{ slug: string; title: string }>(
      `SELECT slug, title FROM incidents WHERE status IN ('declared', 'monitoring') ORDER BY created_at DESC LIMIT 20`,
    )
    for (const row of incidentResult.rows) {
      channels.push({
        name: `incident:${row.slug}`,
        label: row.title,
        section: 'incident',
        channelType: 'incident',
      })
    }
  } catch {
    // incidents table not accessible — skip
  }

  // DM channels for the current user
  if (username) {
    try {
      const dmResult = await pool.query<{ channel: string }>(
        `SELECT DISTINCT channel FROM chat_messages WHERE channel LIKE 'dm:%' AND sender_username = $1 ORDER BY channel LIMIT 50`,
        [username],
      )
      for (const row of dmResult.rows) {
        const parts = row.channel.split(':')
        const other = parts.find((p) => p !== 'dm' && p !== username) ?? parts[parts.length - 1]
        channels.push({
          name: row.channel,
          label: other,
          section: 'dm',
          channelType: 'dm',
        })
      }
    } catch {
      // chat_messages not accessible — skip
    }
  }

  return Response.json({ channels })
}

// POST /api/chat/channels — admin only, create a new channel
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { slug, channelType, name, description } = body as {
    slug?: string
    channelType?: string
    name?: string
    description?: string
  }

  if (!slug || !name) {
    return Response.json({ error: 'slug and name are required' }, { status: 400 })
  }

  const pool = getPool()
  try {
    const result = await pool.query(
      `INSERT INTO chat_channels (slug, channel_type, name, description, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING slug, channel_type, name, description, created_at`,
      [slug, channelType ?? 'community', name, description ?? null, session.user.payloadMemberId],
    )
    return Response.json(result.rows[0], { status: 201 })
  } catch (err: unknown) {
    const pg = err as { code?: string }
    if (pg.code === '23505') {
      return Response.json({ error: 'slug already exists' }, { status: 409 })
    }
    throw err
  }
}
