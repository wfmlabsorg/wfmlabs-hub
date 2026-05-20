import { auth } from '@/lib/auth'
import { getPool } from '@/lib/db'

interface Channel {
  name: string
  label: string
  section: 'incidents' | 'dm' | 'community'
}

// GET /api/chat/channels — returns channels the user can access
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const username = (session.user as { username?: string }).username ?? session.user.name ?? ''

  const pool = getPool()
  const channels: Channel[] = []

  // Active incident channels
  try {
    const incidentResult = await pool.query<{ slug: string; title: string }>(
      `SELECT slug, title FROM incidents
       WHERE status IN ('declared', 'monitoring')
       ORDER BY created_at DESC
       LIMIT 20`,
    )
    for (const row of incidentResult.rows) {
      channels.push({
        name: `incident:${row.slug}`,
        label: row.title,
        section: 'incidents',
      })
    }
  } catch {
    // incidents table may not be accessible — skip
  }

  // DM channels for the current user
  if (username) {
    try {
      const dmResult = await pool.query<{ channel: string }>(
        `SELECT DISTINCT channel FROM chat_messages
         WHERE channel LIKE 'dm:%'
           AND (sender_username = $1 OR channel LIKE $2)
         ORDER BY channel
         LIMIT 20`,
        [username, `%:${username}%`],
      )
      for (const row of dmResult.rows) {
        // channel format: dm:{userA}:{userB} — derive a label from the other user
        const parts = row.channel.split(':')
        const other = parts.find((p) => p !== 'dm' && p !== username) ?? parts[parts.length - 1]
        channels.push({
          name: row.channel,
          label: other,
          section: 'dm',
        })
      }
    } catch {
      // chat_messages may not be accessible — skip
    }
  }

  // Community channels (hardcoded for now)
  channels.push(
    { name: 'community:general', label: 'General', section: 'community' },
    { name: 'community:announcements', label: 'Announcements', section: 'community' },
  )

  return Response.json({ channels })
}
