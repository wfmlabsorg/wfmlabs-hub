import { auth } from '@/lib/auth'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getPool } from '@/lib/db'

// POST /api/incidents/[slug]/affected
// Any authenticated member. Body: { affected: boolean, note?: string }
//
// Community validation hook (INCIDENT-MANAGEMENT-SPEC.md §7). Writes a
// community_confirm / community_deny timeline row and increments the matching
// counter on incidents. When a SEV3 reaches 3+ confirmations it writes an
// escalation_flagged timeline row so Watchkeeper (AGENTS fleet) can pick it up
// and auto-escalate to SEV2 for human validation.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth()
  if (!session?.user?.payloadMemberId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { slug } = await params
  const body = (await request.json().catch(() => null)) as {
    affected?: boolean
    note?: string
  } | null

  if (typeof body?.affected !== 'boolean') {
    return Response.json({ error: 'affected (boolean) is required' }, { status: 400 })
  }
  const note = body.note?.trim() || null
  const affected = body.affected

  const payload = await getPayload({ config })
  const member = await payload.findByID({
    collection: 'members',
    id: Number(session.user.payloadMemberId),
    overrideAccess: true,
  })
  const actor = (member?.username as string) || `member-${session.user.payloadMemberId}`

  const pool = getPool()
  const client = await pool.connect()
  try {
    const incRes = await client.query<{ id: number; sev_level: string }>(
      `SELECT id, sev_level FROM incidents WHERE slug = $1 LIMIT 1`,
      [slug],
    )
    const inc = incRes.rows[0]
    if (!inc) {
      return Response.json({ error: 'incident not found' }, { status: 404 })
    }

    // One response per member — keeps the aggregate counts meaningful.
    const priorRes = await client.query(
      `SELECT 1 FROM incident_timeline
       WHERE incident_id = $1 AND actor = $2 AND action IN ('community_confirm', 'community_deny')
       LIMIT 1`,
      [inc.id, actor],
    )
    if (priorRes.rowCount && priorRes.rowCount > 0) {
      return Response.json({ error: 'already responded' }, { status: 409 })
    }

    await client.query('BEGIN')

    const counterCol = affected ? 'community_confirmations' : 'community_denials'
    const updRes = await client.query<{ community_confirmations: number }>(
      `UPDATE incidents
       SET ${counterCol} = ${counterCol} + 1, updated_at = now()
       WHERE id = $1
       RETURNING community_confirmations`,
      [inc.id],
    )

    await client.query(
      `INSERT INTO incident_timeline (incident_id, action, actor, details)
       VALUES ($1, $2, $3, $4)`,
      [inc.id, affected ? 'community_confirm' : 'community_deny', actor, note],
    )

    // §7 threshold: 3+ confirmations on a SEV3 flags for Watchkeeper escalation.
    const confirmations = updRes.rows[0]?.community_confirmations ?? 0
    if (affected && inc.sev_level === 'SEV3' && confirmations === 3) {
      await client.query(
        `INSERT INTO incident_timeline (incident_id, action, actor, details)
         VALUES ($1, 'escalation_flagged', 'system', $2)`,
        [
          inc.id,
          'Reached 3+ community confirmations on a SEV3 — flagged for Watchkeeper escalation review (→ SEV2, human validation).',
        ],
      )
    }

    await client.query('COMMIT')

    return Response.json({ ok: true, affected, confirmations })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}
