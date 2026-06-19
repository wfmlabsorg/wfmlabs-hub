import { getPool } from '@/lib/db'

/**
 * ROC Signals API — raw read of the `signals` table by category for ROC dashboards.
 *
 * The public /api/signals route runs through Payload and only allows the OVIX
 * collection enum (weather, seismic, ...). Scout-written categories that live
 * in the DB ENUM but not the Payload collection — notably `travel`, `labor`
 * and `supply_chain` — are unreachable there. This route reads them straight
 * from Postgres (same pattern as /api/incidents) so the travel & labor ROC
 * dashboards can render scout signals that the live operational worker feeds
 * (travel-intel, news-intel) currently miss.
 *
 * GET /api/roc-signals?category=travel&hours=48&limit=50  (public, read-only)
 */
const ALLOWED_CATEGORIES = [
  'travel', 'labor', 'supply_chain',
  'weather', 'seismic', 'disaster', 'events', 'cyber',
  'infrastructure', 'health', 'financial', 'environmental',
  'geopolitical', 'general',
]

export async function GET(req: Request) {
  const url = new URL(req.url)
  const category = url.searchParams.get('category') || ''
  const hours = Math.min(Math.max(parseInt(url.searchParams.get('hours') || '48', 10) || 48, 1), 168)
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 1), 200)

  if (!ALLOWED_CATEGORIES.includes(category)) {
    return Response.json({ error: 'Invalid or missing category' }, { status: 400 })
  }

  try {
    const pool = getPool()
    const result = await pool.query(
      `SELECT id, signal_type, title, message, source, severity, severity_label,
              category::text AS category, region_name, regions, entity,
              source_url, metadata, created_at
         FROM signals
        WHERE category::text = $1
          AND created_at > now() - make_interval(hours => $2)
        ORDER BY created_at DESC
        LIMIT $3`,
      [category, hours, limit],
    )
    return Response.json({ signals: result.rows, count: result.rowCount, category, hours })
  } catch (e) {
    console.error('roc-signals query error:', e)
    return Response.json({ error: 'Failed to query signals' }, { status: 500 })
  }
}
