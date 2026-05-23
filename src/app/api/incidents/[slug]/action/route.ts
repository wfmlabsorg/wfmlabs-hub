import { auth } from '@/lib/auth'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getPool } from '@/lib/db'

// POST /api/incidents/[slug]/action
// Admin-only. Body: { action, note?, reason?, toSev? }
//
// Each action updates the incidents row AND writes an incident_timeline audit row
// (actor = member username; old/new severity where relevant). Mirrors the lifecycle
// in INCIDENT-MANAGEMENT-SPEC.md §3 / §6b. Watchkeeper (AGENTS fleet) is the other
// writer of these tables — HUB owns the human entry point only.

type Action = 'validate' | 'escalate' | 'de-escalate' | 'add_note' | 'close' | 'reopen'

// Ascending severity. escalate = toward SEV1, de-escalate = toward SEV4.
const SEV_ORDER = ['SEV4', 'SEV3', 'SEV2', 'SEV1']
const stepSev = (current: string, dir: 1 | -1): string => {
  const i = SEV_ORDER.indexOf(current)
  if (i < 0) return current
  return SEV_ORDER[Math.max(0, Math.min(SEV_ORDER.length - 1, i + dir))]
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth()
  if (!session?.user?.payloadMemberId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  const { slug } = await params
  const body = (await request.json().catch(() => null)) as {
    action?: Action
    note?: string
    reason?: string
    toSev?: string
  } | null

  const action = body?.action
  if (!action) {
    return Response.json({ error: 'action is required' }, { status: 400 })
  }

  // Resolve the acting member's username for the audit trail.
  const payload = await getPayload({ config })
  const member = await payload.findByID({
    collection: 'members',
    id: Number(session.user.payloadMemberId),
    overrideAccess: true,
  })
  const actor = (member?.username as string) || 'admin'

  const pool = getPool()
  const client = await pool.connect()
  try {
    const incRes = await client.query<{
      id: number
      sev_level: string
      status: string
      validation_status: string
      reopened_count: number
    }>(
      `SELECT id, sev_level, status, validation_status, reopened_count
       FROM incidents WHERE slug = $1 LIMIT 1`,
      [slug],
    )
    const inc = incRes.rows[0]
    if (!inc) {
      return Response.json({ error: 'incident not found' }, { status: 404 })
    }

    // Build the per-action update + timeline entry.
    let setClause = ''
    const setParams: unknown[] = []
    let tlAction = ''
    let oldSeverity: string | null = null
    let newSeverity: string | null = null
    let details: string | null = null

    const push = (val: unknown) => {
      setParams.push(val)
      return `$${setParams.length}`
    }

    switch (action) {
      case 'validate': {
        // Confirm severity; advance OPEN/DECLARED/DETECTED into VALIDATED.
        const nextStatus = ['open', 'declared', 'detected'].includes(inc.status)
          ? 'validated'
          : inc.status
        setClause = `validation_status = 'validated', validated_by = ${push(actor)}, validated_at = now(), status = ${push(nextStatus)}`
        tlAction = 'validated'
        break
      }
      case 'escalate': {
        oldSeverity = inc.sev_level
        newSeverity =
          body?.toSev && SEV_ORDER.includes(body.toSev) ? body.toSev : stepSev(inc.sev_level, 1)
        if (newSeverity === oldSeverity) {
          return Response.json({ error: 'already at maximum severity (SEV1)' }, { status: 400 })
        }
        // Escalation is a human severity decision → also mark validated.
        setClause = `sev_level = ${push(newSeverity)}, status = 'escalated', escalated_at = now(), validation_status = 'validated', validated_by = ${push(actor)}, validated_at = now()`
        tlAction = 'escalated'
        break
      }
      case 'de-escalate': {
        oldSeverity = inc.sev_level
        newSeverity =
          body?.toSev && SEV_ORDER.includes(body.toSev) ? body.toSev : stepSev(inc.sev_level, -1)
        if (newSeverity === oldSeverity) {
          return Response.json({ error: 'already at minimum severity (SEV4)' }, { status: 400 })
        }
        setClause = `sev_level = ${push(newSeverity)}, status = 'de-escalated'`
        tlAction = 'de-escalated'
        break
      }
      case 'add_note': {
        const note = body?.note?.trim()
        if (!note) {
          return Response.json({ error: 'note is required' }, { status: 400 })
        }
        details = note
        setClause = '' // timeline-only, just bump updated_at below
        tlAction = 'note_added'
        break
      }
      case 'close': {
        const reason = body?.reason?.trim() || 'resolved'
        details = reason
        setClause = `status = 'closed', closed_at = now(), closed_by = ${push(actor)}, close_reason = ${push(reason)}, resolved_at = now()`
        tlAction = 'closed'
        break
      }
      case 'reopen': {
        if (inc.status !== 'closed') {
          return Response.json({ error: 'only closed incidents can be reopened' }, { status: 400 })
        }
        setClause = `status = 'reopened', reopened_at = now(), reopened_count = ${push(inc.reopened_count + 1)}, closed_at = NULL, closed_by = NULL, close_reason = NULL, resolved_at = NULL`
        tlAction = 'reopened'
        break
      }
      default:
        return Response.json({ error: `unknown action: ${action}` }, { status: 400 })
    }

    await client.query('BEGIN')

    const updateSql = setClause
      ? `UPDATE incidents SET ${setClause}, updated_at = now() WHERE id = ${push(inc.id)}`
      : `UPDATE incidents SET updated_at = now() WHERE id = ${push(inc.id)}`
    await client.query(updateSql, setParams)

    await client.query(
      `INSERT INTO incident_timeline (incident_id, action, actor, details, old_severity, new_severity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [inc.id, tlAction, actor, details, oldSeverity, newSeverity],
    )

    await client.query('COMMIT')

    return Response.json({ ok: true, action: tlAction, sev_level: newSeverity ?? inc.sev_level })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}
