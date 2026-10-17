import { getPool } from '@/lib/db'
import { readFaaPrograms, type FaaProgram } from '@/lib/faa-programs'

/**
 * Travel Misery Index — one read for the globe route (/api/roc-misery) and the dashboard page
 * (/travelrisk/misery). The scoring lives in Neon (`airport_misery_latest`, `airport_misery_global`,
 * rule `airport_misery v2`, schema/066 + 070 in wfmlabsorg/roc); this module only shapes it.
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
  /** 'aerodatabox_delays' (15-min sweep) or 'aerodatabox_fids' (hourly board), schema 069. */
  obs_source: string | null
  /** v2: min(1, usable flights / 20) — the share of the full score this much traffic earns (schema 070). */
  traffic_weight: number | null
  /** Live FAA programmes at this airport, strongest first; [] when none. Shown beside the score, never in it. */
  faa: FaaProgram[]
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
    /** FAA read: when checked, how many airports carry a programme, and the error if the read failed. */
    faa: { checked_at: string; airports: number; error: string | null }
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
    rule_id, rule_version, obs_source,
    traffic_weight::double precision AS traffic_weight
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
  const [air, glob, faa] = await Promise.all([pool.query(AIRPORTS_SQL), pool.query(GLOBAL_SQL), readFaaPrograms()])
  const airports = (air.rows as Row[]).map(iso)
  let faaAirports = 0
  for (const a of airports) {
    const list = (typeof a.iata === 'string' && faa.byIata[a.iata]) || []
    a.faa = list as unknown as Row[string]
    if (list.length) faaAirports++
  }
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
      faa: { checked_at: faa.checked_at, airports: faaAirports, error: faa.error },
      generatedAt: new Date().toISOString(),
      rule: { id: 'airport_misery', version: 'v2' },
    },
  }
}

// ── 24 h replay frames ──────────────────────────────────────────────────────

/** One hourly frame: every registry airport's score at that sweep, compact. [misery|null, cancelled, movements, cancel_rate|null] */
export type FrameCell = [number | null, number, number, number | null]
export interface MiseryFrame { sweep_id: string; observed_at: string; airports: Record<string, FrameCell> }
export interface MiseryHistory { frames: MiseryFrame[]; meta: { hours: number; step_min: number; generatedAt: string; rule: { id: string; version: string } } }

/**
 * Hourly frames for the dashboard's replay (the :00 sweep of each hour, oldest first). Scores come from the
 * same SQL rule the live view uses (`airport_misery_score`, schema/066), applied to the stored observation
 * rows — nothing is re-derived in TypeScript. An airport absent from a sweep is simply missing from that frame.
 */
const HISTORY_SQL = `
  WITH hourly AS (
    SELECT DISTINCT ON (date_trunc('hour', observed_at)) sweep_id, observed_at
      FROM airport_observations
     WHERE observed_at > now() - ($1::int || ' hours')::interval
     ORDER BY date_trunc('hour', observed_at), observed_at ASC
  )
  SELECT h.sweep_id, h.observed_at, o.icao,
         (s).score::double precision AS misery, (s).cancelled::int AS cancelled, (s).movements::int AS movements,
         (s).cancel_rate::double precision AS cancel_rate
    FROM hourly h
    JOIN airport_observations o ON o.sweep_id = h.sweep_id
    CROSS JOIN LATERAL airport_misery_score(o.departures_total, o.departures_qualified, o.departures_cancelled, o.departures_median_delay_min, o.departures_delay_index,
                                            o.arrivals_total, o.arrivals_qualified, o.arrivals_cancelled, o.arrivals_median_delay_min, o.arrivals_delay_index) AS s
   ORDER BY h.observed_at ASC, o.icao
`

export async function readMiseryHistory(hours = 24): Promise<MiseryHistory> {
  const pool = getPool()
  const r = await pool.query(HISTORY_SQL, [hours])
  const frames: MiseryFrame[] = []
  let cur: MiseryFrame | null = null
  for (const row of r.rows as Row[]) {
    const t = row.observed_at instanceof Date ? row.observed_at.toISOString() : String(row.observed_at)
    if (!cur || cur.sweep_id !== row.sweep_id) { cur = { sweep_id: String(row.sweep_id), observed_at: t, airports: {} }; frames.push(cur) }
    cur.airports[String(row.icao)] = [row.misery as number | null, (row.cancelled as number) ?? 0, (row.movements as number) ?? 0, row.cancel_rate as number | null]
  }
  return { frames, meta: { hours, step_min: 60, generatedAt: new Date().toISOString(), rule: { id: 'airport_misery', version: 'v2' } } }
}
