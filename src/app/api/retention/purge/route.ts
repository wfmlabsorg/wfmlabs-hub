import { getPayload } from 'payload'
import config from '@payload-config'
import { getPool } from '@/lib/db'

/**
 * Hub retention purge — raw-table retention policy (hub-053, Ted 2026-09-05).
 *
 * The existing /api/signals/purge handles the `signals` Payload collection. This route
 * covers the RAW tables the ROC worker fleet writes into the hub DB, none of which had
 * a retention window. Sizes on 2026-09-05: decision_log 498 MB, airport_observations
 * 461 MB, op_risk_series 183 MB (already pruned by ovix-api at ~30d), news_events 152 MB.
 *
 * Policy (days):
 *   decision_log           30  for artifact_type in ('latency_event','op_risk') — high-volume
 *                              hourly provenance whose derived series already persist
 *                         180  for everything else (declare/severity/coverage decisions)
 *   airport_observations   30  raw 15-minute sweeps; airport_observations_hourly is the rollup
 *   news_events            90  scout intake; signals derived from it are already purged at 48h
 *
 * Deletes run in bounded batches so a single statement never runs long. Each table is
 * capped per invocation; the daily cron converges within a few days on a large backlog.
 *
 * Auth: Vercel cron (CRON_SECRET), ROC_API_KEY, or an admin session — same as signals/purge.
 * Manual: GET /api/retention/purge?dry=1  → counts only, deletes nothing.
 */

export const maxDuration = 300

const POLICY: Array<{ table: string; tsCol: string; days: number; where?: string; label: string }> = [
  { table: 'decision_log', tsCol: 'created_at', days: 30, where: `artifact_type in ('latency_event','op_risk')`, label: 'decision_log (latency/op_risk)' },
  { table: 'decision_log', tsCol: 'created_at', days: 180, label: 'decision_log (other)' },
  { table: 'airport_observations', tsCol: 'observed_at', days: 30, label: 'airport_observations (raw)' },
  { table: 'news_events', tsCol: 'created_at', days: 90, label: 'news_events' },
]
const BATCH = 20000
const MAX_BATCHES_PER_TABLE = 15 // ≤ 300k rows per table per run

export async function GET(req: Request) {
  const cronSecret = req.headers.get('authorization')
  const isVercelCron = cronSecret === `Bearer ${process.env.CRON_SECRET}`
  const rocKey = req.headers.get('x-roc-api-key')
  const isRocKey = rocKey && process.env.ROC_API_KEY && rocKey === process.env.ROC_API_KEY

  if (!isVercelCron && !isRocKey) {
    try {
      const payload = await getPayload({ config })
      const headers = new Headers()
      headers.set('cookie', req.headers.get('cookie') || '')
      const { user } = await payload.auth({ headers })
      if (!user || (user as unknown as Record<string, unknown>).role !== 'admin') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } catch {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const url = new URL(req.url)
  const dry = url.searchParams.get('dry') === '1' || url.searchParams.get('dry') === 'true'
  const pool = getPool()
  const results: Array<{ label: string; matched: number; deleted: number; capped: boolean }> = []

  try {
    for (const p of POLICY) {
      const where = `${p.tsCol} < now() - make_interval(days => ${p.days})${p.where ? ` AND (${p.where})` : ''}`
      const { rows } = await pool.query(`select count(*)::int as n from ${p.table} where ${where}`)
      const matched = rows[0]?.n ?? 0
      let deleted = 0
      let capped = false
      if (!dry && matched > 0) {
        for (let i = 0; i < MAX_BATCHES_PER_TABLE; i++) {
          const r = await pool.query(
            `delete from ${p.table} where id in (select id from ${p.table} where ${where} limit ${BATCH})`,
          )
          deleted += r.rowCount ?? 0
          if ((r.rowCount ?? 0) < BATCH) break
          if (i === MAX_BATCHES_PER_TABLE - 1) capped = true
        }
      }
      results.push({ label: p.label, matched, deleted, capped })
    }

    return Response.json({
      dry,
      policy: POLICY.map(p => ({ table: p.table, days: p.days, where: p.where ?? null })),
      results,
      message: dry
        ? 'Dry run — nothing deleted'
        : `Deleted ${results.reduce((n, r) => n + r.deleted, 0)} rows across ${results.filter(r => r.deleted > 0).length} table(s)`,
    })
  } catch (e) {
    return Response.json({ error: (e as Error).message, results }, { status: 500 })
  }
}
