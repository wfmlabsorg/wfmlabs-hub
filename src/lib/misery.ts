import { getPool } from '@/lib/db'

/**
 * Travel Misery Index — one read for the globe route (/api/roc-misery) and the dashboard page
 * (/travelrisk/misery). The scoring lives in Neon (`airport_misery_latest`, `airport_misery_global`,
 * rule `airport_misery v1`, schema/066 in wfmlabsorg/roc); this module only shapes it.
 *
 * Honesty rules (api-083): every registry airport is returned, unscored ones with `misery: null` and a
 * `misery_reason`; nothing is substituted for a missing value; size (`movements`) is reported for
 * unscored airports too; a military field carries no commercial data by construction; the global gauge
 * is flight-weighted and comes with scored/total so a thin sweep is visible.
 */

export type MiseryBand = 'calm' | 'slow' | 'miserable' | 'severe'

export interface MiseryAirport {
  icao: string; iata: string | null; name: string; city: string | null; country: string | null
  lat: number; lon: number
  category: string; military: boolean; monitor_tier: number | null; business_travel_weight: number | null
  observed_at: string | null; source_at: string | null; window_start_at: string | null; window_end_at: string | null; sweep_id: string | null
  obs_status: string | null; obs_status_reason: string | null; program_type: string | null; lifecycle: string | null
  movements: number | null; cancelled: number | null
  median_delay_min: number | null; delay_index: number | null; cancel_rate: number | null
  departures_total: number | null; departures_cancelled: number | null; departures_median_delay_min: number | null; departures_delay_index: number | null
  arrivals_total: number | null; arrivals_cancelled: number | null; arrivals_median_delay_min: number | null; arrivals_delay_index: number | null
  misery: number | null; misery_band: MiseryBand | null; misery_reason: string | null
  baseline_score: number | null; baseline_granularity: string | null; baseline_maturity: string | null; baseline_samples: number | null
  vs_normal: number | null
  rule_id: string | null; rule_version: string | null
}

export interface MiseryGlobalRow {
  sweep_id: string; observed_at: string
  misery: number | null; misery_unweighted: number | null
  movements: number | null; cancelled: number | null
  airports_scored: number; airports_total: number
  miserable_airports: number; severe_airports: number
}

export interface MiseryPayload {
  airports: MiseryAirport[]
  global: { now: MiseryGlobalRow | null; series: MiseryGlobalRow[] }
  meta: {
    count: number; scored: number
    unscored_by_reason: Record<string, number>
    bands: Record<string, number>
    military: number
    baseline_maturity: Record<string, number>
    newest_observed_at: string | null
    generatedAt: string
    rule: { id: string; version: string }
  }
}

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
const TIMES = ['observed_at', 'source_at', 'window_start_at', 'window_end_at'] as const

/** pg hands timestamptz back as Date; both the JSON route and the RSC page want ISO strings. */
function iso(row: Row): Row {
  const out: Row = { ...row }
  for (const k of TIMES) { const v = out[k]; if (v instanceof Date) out[k] = v.toISOString() }
  return out
}

function tally(rows: Row[], key: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) {
    const v = r[key]
    const k = v === null || v === undefined ? 'null' : String(v)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

/** Throws on a database error — callers decide how loudly to fail (the route 500s, the page shows a gap). */
export async function readMisery(): Promise<MiseryPayload> {
  const pool = getPool()
  const [air, glob] = await Promise.all([pool.query(AIRPORTS_SQL), pool.query(GLOBAL_SQL)])
  const airports = (air.rows as Row[]).map(iso)
  const series = (glob.rows as Row[]).map(iso)

  let newest: string | null = null
  for (const a of airports) {
    const t = a.observed_at as string | null
    if (t && (!newest || t > newest)) newest = t
  }
  const scored = airports.filter((a) => a.misery !== null && a.misery !== undefined)
  const unscored = airports.filter((a) => a.misery === null || a.misery === undefined)

  return {
    airports: airports as unknown as MiseryAirport[],
    global: { now: series.length ? (series[series.length - 1] as unknown as MiseryGlobalRow) : null, series: series as unknown as MiseryGlobalRow[] },
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
  }
}
