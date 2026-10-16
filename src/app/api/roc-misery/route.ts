import { readMisery } from '@/lib/misery'

/**
 * ROC Misery — the Travel Misery Index for the travel globe (api-083).
 *
 * Reads the Hub Neon DB through `readMisery()` (src/lib/misery.ts) — the same read the
 * /travelrisk/misery dashboard page uses, so both show one number. The scoring lives in the database
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

export async function GET() {
  try {
    const payload = await readMisery()
    return Response.json(payload, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } })
  } catch (e) {
    console.error('roc-misery query error:', e)
    // Fail loudly. An empty `airports` array would read on the globe as "nobody is
    // miserable", which is the exact confusion this endpoint exists to prevent.
    return Response.json({ error: 'Failed to query airport misery' }, { status: 500 })
  }
}
