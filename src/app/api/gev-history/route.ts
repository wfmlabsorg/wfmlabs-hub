import { getPool } from '@/lib/db'

/**
 * GEV history — what the airport plane looked like over the last N hours, for the God's Eye View
 * board's time scrubber (gev-002).
 *
 *   GET /api/gev-history?hours=24
 *   → { buckets: [{ t, sweep_id, airports: [{ icao, iata, name, lat, lon, status, dep_med, arr_med,
 *        cancelled }] }], meta: { hours, sweeps, generated_at } }
 *
 * One bucket per hour: the LATEST sweep that landed in that hour. Each bucket carries only the
 * airports whose reading in that sweep was a problem (degraded / stopped / closed).
 *
 * Honesty: a replay that shows only problems must never be read as "everything else was fine".
 * Airports absent from a bucket were either fine OR not read in that sweep; the board says so in
 * its replay banner. Nothing here is inferred or defaulted — rows are what the writer stored.
 *
 * Public, read-only, cached 5 minutes.
 */
export const dynamic = 'force-dynamic'

const SQL = `
  WITH sweeps AS (
    SELECT DISTINCT ON (date_trunc('hour', observed_at))
           date_trunc('hour', observed_at) AS hour, sweep_id, observed_at
      FROM airport_observations
     WHERE observed_at > now() - make_interval(hours => $1::int)
       AND sweep_id IS NOT NULL
     ORDER BY date_trunc('hour', observed_at), observed_at DESC
  )
  SELECT s.hour, s.sweep_id, s.observed_at,
         o.icao, r.iata, r.name, r.lat::double precision AS lat, r.lon::double precision AS lon,
         o.status,
         o.departures_median_delay_min::double precision AS dep_med,
         o.arrivals_median_delay_min::double precision   AS arr_med,
         (COALESCE(o.departures_cancelled, 0) + COALESCE(o.arrivals_cancelled, 0))::int AS cancelled
    FROM sweeps s
    JOIN airport_observations o ON o.sweep_id = s.sweep_id
    JOIN airport_airspace_ring r ON r.icao = o.icao
   WHERE o.status IN ('degraded', 'stopped', 'closed')
   ORDER BY s.hour, o.icao
`

export async function GET(req: Request) {
  const hours = Math.min(Math.max(parseInt(new URL(req.url).searchParams.get('hours') || '24', 10) || 24, 1), 48)
  try {
    const { rows } = await getPool().query(SQL, [hours])
    const byHour = new Map<string, { t: string; sweep_id: string; airports: Record<string, unknown>[] }>()
    for (const r of rows) {
      const t = new Date(r.hour).toISOString()
      if (!byHour.has(t)) byHour.set(t, { t, sweep_id: r.sweep_id, airports: [] })
      byHour.get(t)!.airports.push({ icao: r.icao, iata: r.iata, name: r.name, lat: r.lat, lon: r.lon, status: r.status, dep_med: r.dep_med, arr_med: r.arr_med, cancelled: r.cancelled })
    }
    // hours whose sweep had no problem readings still appear, so the scrubber has no silent holes
    const { rows: all } = await getPool().query(
      `SELECT DISTINCT date_trunc('hour', observed_at) AS hour FROM airport_observations WHERE observed_at > now() - make_interval(hours => $1::int) ORDER BY 1`, [hours])
    const buckets = all.map((h) => { const t = new Date(h.hour).toISOString(); return byHour.get(t) ?? { t, sweep_id: null, airports: [] } })
    return Response.json({ buckets, meta: { hours, sweeps: buckets.length, generated_at: new Date().toISOString(), shows: 'problem readings only; absent = fine or not read' } },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })
  } catch (e) {
    return Response.json({ error: String(e), meta: { failed: ['history'] } }, { status: 502 })
  }
}
