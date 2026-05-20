import { auth } from '@/lib/auth'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getPool } from '@/lib/db'

// POST /api/chat/poll-response
// Body: { incidentSlug: string, pollType: string, response: string, messageId?: string }

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.payloadMemberId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: {
    incidentSlug?: string
    pollType?: string
    response?: string
    messageId?: string
  }

  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 })
  }

  const { incidentSlug, pollType, response, messageId } = body

  if (!response) {
    return Response.json({ error: 'response is required' }, { status: 400 })
  }

  // Look up member username
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
  const memberId = Number(session.user.payloadMemberId)

  const pool = getPool()

  if (pollType === 'impact_confirmation' && incidentSlug) {
    // Look up incident id by slug
    const incidentRes = await pool.query<{ id: number }>(
      'SELECT id FROM incidents WHERE slug = $1 LIMIT 1',
      [incidentSlug],
    )
    const incident = incidentRes.rows[0]

    if (incident) {
      const isConfirm = response === 'yes'
      const isDeny = response === 'no'
      const action = isConfirm ? 'community_confirm' : isDeny ? 'community_deny' : 'community_response'

      // Insert into incident_timeline
      await pool.query(
        `INSERT INTO incident_timeline (incident_id, action, actor, details)
         VALUES ($1, $2, $3, $4)`,
        [
          incident.id,
          action,
          username,
          `Poll response: ${response}${messageId ? ` (msg ${messageId})` : ''}`,
        ],
      )

      // Increment community counters on incidents table
      if (isConfirm) {
        await pool.query(
          'UPDATE incidents SET community_confirmations = community_confirmations + 1 WHERE id = $1',
          [incident.id],
        )
      } else if (isDeny) {
        await pool.query(
          'UPDATE incidents SET community_denials = community_denials + 1 WHERE id = $1',
          [incident.id],
        )
      }
    }
  }

  // Always record in chat_poll_responses for full audit trail
  await pool.query(
    `INSERT INTO chat_poll_responses
       (incident_slug, poll_type, response_key, responder_username, responder_id, message_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [incidentSlug ?? null, pollType ?? null, response, username, memberId, messageId ?? null],
  )

  return Response.json({ ok: true })
}
