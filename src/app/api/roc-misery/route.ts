import { getPool } from '@/lib/db'

/**
 * ROC Misery — the Travel Misery Index for the travel globe (api-083).
 *
 * Reads the Hub Neon DB directly via `getPool()` raw SQL, the same same-origin
 * pattern as /api/roc-airports. The scoring lives in the database
 * (`airport_misery_latest`, `airport_misery_global`, rule `airport_misery v1`,
 * schema/066 in wfmlabsorg/roc) so the hub, the desk and a SQL console all read
 * one number; this route only shapes it.
 *
 * GET /api/roc-misery  (public, read-only)
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * The 15-minute AeroDataBox sweep has carried cancellations, median delay and
 * the feed's delay index for every registry airport since 2026-09-15, and the
 * globe only ever showed an airport once it tipped into DEGRADED. Ted
 * (2026-10-15): a MiseryMap-style read-out from the data we already pull — one
 * dot per airport, size = how much flies, colour = how miserable, a distinct
 * marker for military airbases, and a global gauge.
 *
 * ── THE HONESTY RULES THIS ROUTE ENFORCES ──────────────────────────────────
 * 1. EVERY registry airport appears in EVERY response — all rows of
 *    `airport_misery_latest`, never filtered. An airport with no score is
 *    returned with `misery: null` and a `misery_reason`; it is never dropped and
 *    never rendered calm.
 * 2. NO VALUE IS SUBSTITUTED FOR A MISSING ONE. `misery`, `vs_normal`,
 *    `baseline_*` and the observation fields pass through as NULL. No COALESCE,
 *    no default.
 * 3. SIZE IS NOT SCORE. `movements` (scheduled departures + arrivals in the
 *    feed's 2-hour window) is reported for unscored airports too, so a hub the
 *    feed withheld statistics for still draws at its real size — in grey.
 * 4. A MILITARY FIELD (`military: true`, category government) carries no
 *    commercial data by construction; its reason is `no_commercial_data`.
 * 5. The global gauge is FLIGHT-WEIGHTED (a 4-flight field cannot move it) and
 *    comes with `airports_scored` / `airports_total` so a thin sweep is visible.
 *
 * ── TRACEABILITY ───────────────────────────────────────────────────────────
 * Every airport row carries `rule_id` / `rule_version` (`airport_misery` /
 * `v1`) and the `sweep_id` + `observed_at` + `source_at` of the reading it was
 * scored from. `vs_normal` carries `baseline_granularity` + `baseline_maturity`
 * so a comparison against a warming baseline is never mistaken for a warm one.
 *
 * ── SHAPE ──────────────────────────────────────────────────────────────────
 * { airports: [ { icao, iata, name, city, country, lat, lon, category, military,
 *                 monitor_tier, business_travel_weight,
 *                 observed_at, source_at, window_start_at, window_end_at, sweep_id,
 *                 obs_status, obs_status_reason, program_type, lifecycle,
 *                 movements, cancelled, median_delay_min, delay_index, cancel_rate,
 *                 departures_total, departures_cancelled, departures_median_delay_min, departures_delay_index,
 *                 arrivals_total, arrivals_cancelled, arrivals_median_delay_min, arrivals_delay_index,
 *                 misery, misery_band, misery_reason,
 *                 baseline_score, baseline_granularity, baseline_maturity, baseline_samples, vs_normal,
 *                 rule_id, rule_version } ],
 *   global: { now: <newest series row> | null,
 *             series: [ { sweep_id, observed_at, misery, misery_unweighted, movements, cancelled,
 *                         airports_scored, airports_total, miserable_airports, severe_airports } ] (oldest first) },
 *   meta: { count, scored, unscored_by_reason, bands, military, newest_observed_at, generatedAt, rule } }
 */

export const dynamic = 'force-dynamic'

const AIRPORTS_SQL = `
  SELECT
    icao, iata, name, city, country,
    lat::double precision AS lat, lon::double precision AS lon,
    category, military, monitor_tier, business_travel_weight,
    observed_at, source_at, window_start_at, window_end_at, sweep_id,
    obs_status, obs_status_reason, program_type, lifecycle,
    movements, cancelled,
    median_delay_min::double precision AS median_delay_min,
    delay_index::double precision      AS delay_index,
    cancel_rate::double precision      AS cancel_rate,
    departures_total, departures_cancelled,
    departures_median_delay_min::double precision AS departures_median_delay_min,
    departures_delay_index::double precision      AS departures_delay_index,
    arrivals_total, arrivals_cancelled,
    arrivals_median_delay_min::double precision   AS arrivals_median_delay_min,
    arrivals_delay_index::double precision        AS arrivals_delay_index,
    misery::double precision AS misery, misery_band, misery_reason,
    baseline_score::double precision AS baseline_score, baseline_granularity, baseline_maturity, baseline_samples,
    vs_normal::double precision AS vs_normal,
    rule_id, rule_version
  FROM airport_misery_latest
  ORDER BY misery DESC NULLS LAST, movements DESC NULLS LAST, icao
`

const GLOBAL_SQL = `
  SELECT sweep_id, observed_at,
         misery::double precision AS misery, misery_unweighted::double precision AS misery_unweighted,
         movements::int AS movements, cancelled::int AS cancelled,
         airports_scored::int AS airports_scored, airports_total::int AS airports_total,
         miserable_airports::int AS miserable_airports, severe_airports::int AS severe_airports
  FROM airport_misery_global
  ORDER BY observed_at ASC
`

type Row = Record<string, unknown>

function tally(rows: Row[], key: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    const v = r[key]
    const k = v === null || v === undefined ? 'null' : String(v)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

export async function GET() {
  try {
    const pool = getPool()
    const [air, glob] = await Promise.all([pool.query(AIRPORTS_SQL), pool.query(GLOBAL_SQL)])
    const airports = air.rows as Row[]
    const series = glob.rows as Row[]

    let newest: string | null = null
    for (const a of airports) {
      const t = a.observed_at instanceof Date ? a.observed_at.toISOString() : (a.observed_at as string | null)
      if (t && (!newest || t > newest)) newest = t
    }
    const scored = airports.filter((a) => a.misery !== null && a.misery !== undefined)
    const unscored = airports.filter((a) => a.misery === null || a.misery === undefined)

    return Response.json(
      {
        airports,
        global: { now: series.length ? series[series.length - 1] : null, series },
        meta: {
          count: airports.length,
          scored: scored.length,
          unscored_by_reason: tally(unscored, 'misery_reason'),
          bands: tally(scored, 'misery_band'),
          military: airports.filter((a) => a.military === true).length,
          baseline_maturity: tally(airports, 'baseline_maturity'),
          newest_observed_at: newest,
          generatedAt: new Date().toISOString(),
          rule: { id: 'airport_misery', version: 'v1' },
        },
      },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
    )
  } catch (e) {
    console.error('roc-misery query error:', e)
    // Fail loudly. An empty `airports` array would read on the globe as "nobody is
    // miserable", which is the exact confusion this endpoint exists to prevent.
    return Response.json({ error: 'Failed to query airport misery' }, { status: 500 })
  }
}
