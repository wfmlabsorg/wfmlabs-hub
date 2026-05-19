import { getPool } from '@/lib/db'

const VALID_SEV_LEVELS = ['SEV1', 'SEV2', 'SEV3', 'SEV4']
const VALID_DOMAINS = [
  'weather', 'seismic', 'disaster', 'events', 'cyber',
  'infrastructure', 'health', 'financial', 'environmental',
  'geopolitical', 'general',
]
const VALID_STATUSES = [
  'detected', 'declared', 'open', 'validated', 'escalated',
  'de-escalated', 'resolving', 'closed', 'reopened',
]

export async function GET(req: Request) {
  const pool = getPool()
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
  const offset = parseInt(url.searchParams.get('offset') || '0')
  const sevLevel = url.searchParams.get('sev_level')
  const domain = url.searchParams.get('domain')
  const status = url.searchParams.get('status')
  const persistent = url.searchParams.get('persistent')
  const section = url.searchParams.get('section') // 'active', 'closed', 'persistent'

  const conditions: string[] = []
  const params: (string | number | boolean)[] = []
  let paramIdx = 1

  if (sevLevel && VALID_SEV_LEVELS.includes(sevLevel)) {
    conditions.push(`sev_level = $${paramIdx++}`)
    params.push(sevLevel)
  }
  if (domain && VALID_DOMAINS.includes(domain)) {
    conditions.push(`domain = $${paramIdx++}`)
    params.push(domain)
  }
  if (status && VALID_STATUSES.includes(status)) {
    conditions.push(`status = $${paramIdx++}`)
    params.push(status)
  }
  if (persistent === 'true') {
    conditions.push('is_persistent = true')
  }
  if (section === 'active') {
    conditions.push("status NOT IN ('closed')")
  } else if (section === 'closed') {
    conditions.push("status = 'closed'")
  } else if (section === 'persistent') {
    conditions.push('is_persistent = true')
    conditions.push("status NOT IN ('closed')")
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const sort = section === 'closed' ? 'closed_at DESC NULLS LAST' : "CASE sev_level WHEN 'SEV1' THEN 1 WHEN 'SEV2' THEN 2 WHEN 'SEV3' THEN 3 WHEN 'SEV4' THEN 4 ELSE 5 END, declared_at DESC"

  try {
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM incidents ${where}`, params)
    const total = parseInt(countResult.rows[0].total)

    const result = await pool.query(
      `SELECT * FROM incidents ${where} ORDER BY ${sort} LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, limit, offset],
    )

    // Severity counts for the top bar
    const sevCounts = await pool.query(
      "SELECT sev_level, COUNT(*) as cnt FROM incidents WHERE status NOT IN ('closed') GROUP BY sev_level",
    )
    const severityCounts: Record<string, number> = {}
    for (const row of sevCounts.rows) {
      severityCounts[row.sev_level] = parseInt(row.cnt)
    }

    return Response.json({
      docs: result.rows,
      total,
      limit,
      offset,
      severityCounts,
    })
  } catch (e) {
    console.error('Incidents query error:', e)
    return Response.json({ error: 'Failed to query incidents' }, { status: 500 })
  }
}
