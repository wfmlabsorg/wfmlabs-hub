import { getPool } from '@/lib/db'

/**
 * ROC Pipeline Health — live health snapshot of the signals-derived pipeline
 * that members actually depend on: scouts -> news_events -> IWS -> signals ->
 * op-risk, plus the two always-on workers (web-scout, coverage-auditor).
 *
 * Replaces the legacy 35-feed OVIX health (`/api/ovix/feed-health` +
 * `/api/ovix/feeds`) that `feed-health.html` used to poll — that monitored a
 * pipeline the current architecture no longer runs.
 *
 * Reads the Hub Neon DB directly (same `getPool()` pattern as /api/roc-signals,
 * /api/incidents). No secrets are exposed to the client; the payload is a small
 * cacheable status snapshot.
 *
 * GET /api/roc-pipeline-health  (public, read-only)
 */

export const dynamic = 'force-dynamic'

// The 12 canonical risk domains (signals.category enum). Any domain silent for
// 24h is flagged so a starved lane is visible, not hidden by an empty bucket.
const DOMAINS = [
  'weather', 'seismic', 'disaster', 'cyber', 'infrastructure', 'health',
  'financial', 'environmental', 'geopolitical', 'supply_chain', 'labor', 'travel',
]

// Scouts run on ~4h crons. web-scout runs ~6x/day (~4h). Thresholds in minutes.
const SCOUT_OK_MIN = 300 // <= 5h
const SCOUT_STALE_MIN = 600 // <= 10h, else DOWN
// op-risk cron refreshes frequently; flag if the global score is stale.
const OPRISK_OK_MIN = 20
const OPRISK_STALE_MIN = 60

function ageMinutes(ts: string | null): number | null {
  if (!ts) return null
  return Math.round((Date.now() - new Date(ts).getTime()) / 60000)
}

function scoutStatus(ageMin: number | null, c24: number): 'OK' | 'STALE' | 'DOWN' {
  if (ageMin === null) return 'DOWN'
  if (ageMin <= SCOUT_OK_MIN) return c24 > 0 ? 'OK' : 'STALE'
  if (ageMin <= SCOUT_STALE_MIN) return 'STALE'
  return 'DOWN'
}

function opRiskStatus(ageMin: number | null): 'OK' | 'STALE' | 'DOWN' {
  if (ageMin === null) return 'DOWN'
  if (ageMin <= OPRISK_OK_MIN) return 'OK'
  if (ageMin <= OPRISK_STALE_MIN) return 'STALE'
  return 'DOWN'
}

export async function GET() {
  try {
    const pool = getPool()

    const [scoutRes, domainRes, opRiskRes, webScoutRes, coverageRes] = await Promise.all([
      // Scout freshness — per scout_agent (excludes web-scout; surfaced separately)
      pool.query(
        `SELECT scout_agent AS source,
                max(created_at) AS last_at,
                count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS c24,
                count(*) AS total
           FROM news_events
          WHERE scout_agent IS NOT NULL
            AND scout_agent <> 'web-scout'
          GROUP BY scout_agent
          ORDER BY scout_agent`,
      ),
      // Signals throughput — 24h count per domain + last write
      pool.query(
        `SELECT category::text AS domain,
                count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS c24,
                max(created_at) AS last_at
           FROM signals
          WHERE category IS NOT NULL
          GROUP BY category`,
      ),
      // op-risk cron recency + region node count (latest batch)
      pool.query(
        `WITH r AS (SELECT max(scored_at) AS ts FROM op_risk_scores WHERE scope = 'region')
         SELECT
           (SELECT max(scored_at) FROM op_risk_scores WHERE scope = 'global') AS global_scored_at,
           (SELECT ts FROM r) AS region_scored_at,
           (SELECT count(DISTINCT region_key) FROM op_risk_scores
              WHERE scope = 'region' AND scored_at >= (SELECT ts FROM r) - interval '10 minutes') AS region_nodes`,
      ),
      // web-scout liveness — last signals row + 24h count
      pool.query(
        `SELECT max(created_at) AS last_at,
                count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS c24
           FROM signals
          WHERE source ILIKE 'web-scout%'`,
      ),
      // coverage-auditor — latest audit + its findings (the G6 monitor)
      pool.query(
        `SELECT run_at, window_hours, verdict, summary_prose, gap_count, gaps,
                drift_direction, drift_detail, stuck_count, stuck_incident_ids,
                signal_count, high_sev_signal_count, incident_count,
                open_count, oldest_open_days, close_auto_pct
           FROM coverage_audit
          ORDER BY run_at DESC
          LIMIT 1`,
      ),
    ])

    // --- Scouts ---
    const scouts = scoutRes.rows.map((r) => {
      const c24 = parseInt(r.c24, 10) || 0
      const ageMin = ageMinutes(r.last_at)
      return {
        source: r.source,
        last_at: r.last_at,
        age_minutes: ageMin,
        events_24h: c24,
        total_events: parseInt(r.total, 10) || 0,
        status: scoutStatus(ageMin, c24),
      }
    })

    // --- Signals by domain (fill zeros for silent lanes) ---
    const domainMap: Record<string, { c24: number; last_at: string | null }> = {}
    domainRes.rows.forEach((r) => {
      domainMap[r.domain] = { c24: parseInt(r.c24, 10) || 0, last_at: r.last_at }
    })
    const signalsByDomain = DOMAINS.map((d) => {
      const row = domainMap[d] || { c24: 0, last_at: null }
      return {
        domain: d,
        signals_24h: row.c24,
        last_at: row.last_at,
        status: row.c24 > 0 ? 'OK' : 'STALE', // 0/24h = starved lane
      }
    })

    // --- op-risk ---
    const or = opRiskRes.rows[0] || {}
    const globalAge = ageMinutes(or.global_scored_at)
    const opRisk = {
      global_scored_at: or.global_scored_at || null,
      global_age_minutes: globalAge,
      region_scored_at: or.region_scored_at || null,
      region_nodes: parseInt(or.region_nodes, 10) || 0,
      status: opRiskStatus(globalAge),
    }

    // --- web-scout ---
    const ws = webScoutRes.rows[0] || {}
    const wsC24 = parseInt(ws.c24, 10) || 0
    const wsAge = ageMinutes(ws.last_at)
    const webScout = {
      last_at: ws.last_at || null,
      age_minutes: wsAge,
      signals_24h: wsC24,
      status: scoutStatus(wsAge, wsC24),
    }

    // --- coverage-auditor ---
    const ca = coverageRes.rows[0] || null
    const coverageAuditor = ca
      ? {
          run_at: ca.run_at,
          age_minutes: ageMinutes(ca.run_at),
          window_hours: ca.window_hours,
          verdict: ca.verdict,
          summary_prose: ca.summary_prose,
          gap_count: ca.gap_count,
          gaps: ca.gaps || [],
          drift_direction: ca.drift_direction,
          drift_detail: ca.drift_detail || null,
          stuck_count: ca.stuck_count,
          stuck_incident_ids: ca.stuck_incident_ids || [],
          signal_count: ca.signal_count,
          high_sev_signal_count: ca.high_sev_signal_count,
          incident_count: ca.incident_count,
          open_count: ca.open_count,
          oldest_open_days: ca.oldest_open_days,
          close_auto_pct: ca.close_auto_pct,
        }
      : null

    // --- rollup ---
    const scoutIssues = scouts.filter((s) => s.status !== 'OK').length
    const domainIssues = signalsByDomain.filter((d) => d.status !== 'OK').length
    const pipelineIssues =
      (opRisk.status !== 'OK' ? 1 : 0) + (webScout.status !== 'OK' ? 1 : 0)

    return Response.json(
      {
        generated_at: new Date().toISOString(),
        summary: {
          scouts_total: scouts.length,
          scouts_healthy: scouts.filter((s) => s.status === 'OK').length,
          scout_issues: scoutIssues,
          domains_total: signalsByDomain.length,
          domain_issues: domainIssues,
          pipeline_issues: pipelineIssues,
          signals_24h: signalsByDomain.reduce((s, d) => s + d.signals_24h, 0),
        },
        scouts,
        signals_by_domain: signalsByDomain,
        op_risk: opRisk,
        web_scout: webScout,
        coverage_auditor: coverageAuditor,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } },
    )
  } catch (e) {
    console.error('roc-pipeline-health query error:', e)
    return Response.json({ error: 'Failed to query pipeline health' }, { status: 500 })
  }
}
