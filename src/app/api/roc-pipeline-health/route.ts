import { getPool } from '@/lib/db'
import {
  HIBERNATED_SCOUTS, RENAMED_SCOUTS, hibernatedDomain,
  HIBERNATION_COMMIT, HIBERNATION_DECIDED, HIBERNATION_EFFECTIVE,
} from '@/lib/travelrisk/hibernation'

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
// 24h is flagged so a starved lane is visible, not hidden by an empty bucket —
// unless the lane was switched off on purpose (HIBERNATED_DOMAINS), in which
// case it says so instead of reading as a fault.
const DOMAINS = [
  'weather', 'seismic', 'disaster', 'cyber', 'infrastructure', 'health',
  'financial', 'environmental', 'geopolitical', 'supply_chain', 'labor', 'travel',
]

type Status = 'OK' | 'STALE' | 'DOWN'
type ScoutStatus = Status | 'HIBERNATED'
type DomainStatus = 'OK' | 'QUIET' | 'STALE' | 'HIBERNATED'

/**
 * CADENCE-AWARE SCOUT FRESHNESS
 * ----------------------------------------------------------------------------
 * The old route judged every scout against one ~4h clock (OK <= 5h, STALE <=
 * 10h). Since roc 05bdfff, Cipher and Grid run once a day at 06:00 UTC, so they
 * read STALE by early afternoon every day, and Vector (every 2h) could be
 * silent for 5h and still read OK.
 *
 * Each scout now has an EXPECTED WRITE INTERVAL in minutes — its cron interval
 * from `roc/workers/scout-<name>/wrangler.toml`, except where its filter makes empty
 * runs routine (see Atlas). Then:
 *
 *   OK     age <= expected x GRACE_OK            (one missed run tolerated)
 *   STALE  age <= max(expected x DOWN_FACTOR, DOWN_FLOOR_MIN)
 *   DOWN   beyond that, or never written
 *
 * `news_events` only records NEW (deduplicated) articles, so a healthy run can
 * legitimately write nothing; the DOWN floor means no scout is called down for
 * less than a full day of silence. Keep this map in step with roc's crons.
 */
const GRACE_OK = 2
const DOWN_FACTOR = 4
const DOWN_FLOOR_MIN = 24 * 60
/** Fallback for a scout not listed below (the old fleet-wide ~4h cadence). */
const DEFAULT_EXPECTED_MIN = 240

const SCOUT_EXPECTED_MIN: Readonly<Record<string, number>> = {
  Vector: 120, //    0 */2 * * *
  // Gale, Mayday, Picket every 12 h since 2026-10-18 (NewsAPI.ai narrowed to the travel focus; was 0 */3)
  Gale: 720, //      0 */12 * * *
  Mayday: 720, //    0 */12 * * *
  Picket: 720, //    0 */12 * * *
  // Atlas polls every 3h (0 */3) but its travel-lens filter means most runs
  // write nothing new: measured over 10 days to 2026-10-17, 72 writes, p90 gap
  // 9h, max 27h. Judged on a 12h write interval, not its 3h cron.
  // Atlas and Concierge hibernated 2026-10-18 (roc#205); these intervals only judge them until 24h of
  // silence turns them HIBERNATED.
  Atlas: 720,
  Concierge: 240, // was 0 */4 * * *  (scout-triage, repurposed — see RENAMED_SCOUTS)
  Cipher: 1440, //  0 6 * * *    daily since 05bdfff
  Grid: 1440, //    0 6 * * *    daily since 05bdfff
}
/** web-scout's own /health (status ready | hibernated | blocked | stale | degraded); null when unreachable. */
async function readWebScoutHealth(): Promise<{ status?: string; hibernated?: string | null; reasons?: string[] } | null> {
  try {
    const r = await fetch('https://web-scout.tedlango.workers.dev/health', { signal: AbortSignal.timeout(3000), next: { revalidate: 300 } })
    return r.status === 200 || r.status === 503 ? await r.json() : null
  } catch { return null }
}

/** web-scout: crons "0 3,7,11,15,19,23 * * *" — every 4h. */
const WEB_SCOUT_EXPECTED_MIN = 240

// op-risk cron refreshes frequently; flag if the global score is stale.
const OPRISK_OK_MIN = 20
const OPRISK_STALE_MIN = 60

function ageMinutes(ts: string | null): number | null {
  if (!ts) return null
  return Math.round((Date.now() - new Date(ts).getTime()) / 60000)
}

function scoutStatus(ageMin: number | null, expectedMin: number): Status {
  if (ageMin === null) return 'DOWN'
  if (ageMin <= expectedMin * GRACE_OK) return 'OK'
  if (ageMin <= Math.max(expectedMin * DOWN_FACTOR, DOWN_FLOOR_MIN)) return 'STALE'
  return 'DOWN'
}

function opRiskStatus(ageMin: number | null): Status {
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
    // Renamed scouts (Triage -> Concierge) are dropped: their historical rows
    // are the same worker under its old name, not a second scout that died.
    // Hibernated scouts read HIBERNATED unless they have written in the last
    // 24h (i.e. someone restored the schedule), in which case they are judged
    // like any other scout.
    const scouts = scoutRes.rows
      .filter((r) => !RENAMED_SCOUTS[r.source])
      .map((r) => {
        const c24 = parseInt(r.c24, 10) || 0
        const ageMin = ageMinutes(r.last_at)
        const hib = HIBERNATED_SCOUTS[r.source]
        const expectedMin = SCOUT_EXPECTED_MIN[r.source] ?? DEFAULT_EXPECTED_MIN
        const status: ScoutStatus = hib && c24 === 0 ? 'HIBERNATED' : scoutStatus(ageMin, expectedMin)
        return {
          source: r.source,
          last_at: r.last_at,
          age_minutes: ageMin,
          events_24h: c24,
          total_events: parseInt(r.total, 10) || 0,
          expected_interval_minutes: status === 'HIBERNATED' ? null : expectedMin,
          status,
          hibernation:
            status === 'HIBERNATED' && hib
              ? {
                  domain: hib.domain,
                  reason: hib.reason,
                  decided: hib.decided ?? HIBERNATION_DECIDED,
                  effective: hib.effective ?? HIBERNATION_EFFECTIVE,
                  roc_commit: hib.roc_commit ?? HIBERNATION_COMMIT,
                }
              : null,
        }
      })

    // --- Signals by domain (fill zeros for silent lanes) ---
    const domainMap: Record<string, { c24: number; last_at: string | null }> = {}
    domainRes.rows.forEach((r) => {
      domainMap[r.domain] = { c24: parseInt(r.c24, 10) || 0, last_at: r.last_at }
    })
    // Intake per domain (2026-10-17): a lane with no signals is QUIET when its scouts are still ingesting but the
    // relevance filter (iws_pass) rejected everything — e.g. cyber and disaster on 2026-10-17: 119 and 177 events in
    // 4 days, 1 and 2 relevant (a ransomware report, an earthquake-drill explainer). STALE now means intake stopped.
    const intake: Record<string, { n24: number; pass24: number }> = {}
    try {
      const r = await pool.query(
        // "promotable" = both gates sentinel pass 2 applies (roc workers/sentinel/src/passes.ts): relevant AND
        // severity >= SCOUT_INTEL_MIN_UPSTREAM_SEVERITY (5.0). Keep the 5.0 in sync with that constant.
        `SELECT domain, count(*)::int AS n24, count(*) FILTER (WHERE iws_pass AND severity >= 5.0)::int AS pass24
           FROM news_events WHERE created_at > now() - interval '24 hours' AND domain IS NOT NULL GROUP BY domain`)
      for (const x of r.rows) intake[x.domain] = { n24: Number(x.n24) || 0, pass24: Number(x.pass24) || 0 }
    } catch { /* intake unknown → fall back to signals-only status */ }
    const signalsByDomain = DOMAINS.map((d) => {
      const row = domainMap[d] || { c24: 0, last_at: null }
      const hib = hibernatedDomain(d)
      const inflow = intake[d] ?? null
      // 0/24h = starved lane — unless its only dedicated feed was switched off, or its intake is flowing and the
      // relevance filter passed nothing (quiet by design, not broken).
      const status: DomainStatus = row.c24 > 0 ? 'OK' : hib ? 'HIBERNATED' : inflow && inflow.n24 > 0 && inflow.pass24 === 0 ? 'QUIET' : 'STALE'
      return {
        domain: d,
        signals_24h: row.c24,
        last_at: row.last_at,
        intake_24h: inflow?.n24 ?? null,
        promotable_24h: inflow?.pass24 ?? null,   // relevant AND severity >= 5 — what sentinel would promote
        status,
        hibernation: status === 'HIBERNATED' && hib ? { scouts: hib.scouts, reason: hib.reason } : null,
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
    // web-scout says itself when it is paused by decision (roc #195, 2026-10-17: BrowserUse trial key expired).
    // Its own /health is the source of truth; if it can't be read, fall back to freshness as before.
    const wsHealth = await readWebScoutHealth()
    const webScout = {
      last_at: ws.last_at || null,
      age_minutes: wsAge,
      signals_24h: wsC24,
      expected_interval_minutes: WEB_SCOUT_EXPECTED_MIN,
      status: wsHealth?.status === 'hibernated' ? 'HIBERNATED' : scoutStatus(wsAge, WEB_SCOUT_EXPECTED_MIN),
      hibernated_reason: wsHealth?.status === 'hibernated' ? (wsHealth.hibernated ?? wsHealth.reasons?.[0] ?? 'paused by decision') : null,
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
    // HIBERNATED is a decision, not a fault: it is reported in its own count
    // and never added to an issue total.
    const activeScouts = scouts.filter((s) => s.status !== 'HIBERNATED')
    const scoutIssues = activeScouts.filter((s) => s.status !== 'OK').length
    const domainIssues = signalsByDomain.filter((d) => d.status === 'STALE').length
    const pipelineIssues =
      (opRisk.status !== 'OK' ? 1 : 0) + (webScout.status !== 'OK' && webScout.status !== 'HIBERNATED' ? 1 : 0)

    return Response.json(
      {
        generated_at: new Date().toISOString(),
        summary: {
          // scouts_total counts ACTIVE scouts only, so healthy/total reads true.
          scouts_total: activeScouts.length,
          scouts_healthy: activeScouts.filter((s) => s.status === 'OK').length,
          scouts_hibernated: scouts.length - activeScouts.length,
          scout_issues: scoutIssues,
          domains_total: signalsByDomain.length,
          domains_hibernated: signalsByDomain.filter((d) => d.status === 'HIBERNATED').length,
          domain_issues: domainIssues,
          pipeline_issues: pipelineIssues,
          signals_24h: signalsByDomain.reduce((s, d) => s + d.signals_24h, 0),
        },
        scouts,
        renamed_scouts: Object.values(RENAMED_SCOUTS),
        thresholds: {
          scout_ok: `age <= expected_interval x ${GRACE_OK}`,
          scout_stale: `age <= max(expected_interval x ${DOWN_FACTOR}, ${DOWN_FLOOR_MIN} min)`,
          domain_stale: 'no signals in 24h and not hibernated',
        },
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
