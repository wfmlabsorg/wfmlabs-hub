import { getPool } from '@/lib/db'

/**
 * GEV story flights — the flights that carry a story, for World Glass (cycle 3, api-071).
 *
 *   GET /api/gev-story-flights
 *   → { airports: [...], flights: [...], emergencies: [...], meta }
 *
 * airports     the story-flights worker's latest ranked candidates (an airport and WHY it has a story:
 *              operational / sweep / FAA / news / cyclone), joined to its latest paid board if one was
 *              pulled in the last 3 h. An airport with reasons but no board is still published —
 *              "story, not yet boarded" — never dropped.
 * flights      story flights from each airport's latest board (cancelled, diverted, ≥ 60 min late),
 *              capped per airport, cancelled/diverted first then longest delay. Positions come from
 *              free ADS-B where the network has coverage (Russia, for example, has almost none).
 * emergencies  live 7700 / 7600 / 7500 squawks worldwide from adsb.lol (free), cached 60 s.
 * meta         run time, today's AeroDataBox units against the worker's daily cap, and whether the
 *              budget reserve (last RESERVE_PCT, FAA / operational stories only) is in force.
 *
 * Public, read-only.
 */
export const dynamic = 'force-dynamic'
const PER_AIRPORT = 40
const SQUAWK: Record<string, string> = { '7700': 'emergency', '7600': 'radio failure', '7500': 'hijack' }

async function emergencies(): Promise<{ list: Record<string, unknown>[]; failed: string[] }> {
  const out: Record<string, unknown>[] = [], failed: string[] = [], seen = new Set<string>()
  // sequential, not parallel: adsb.lol answers concurrent bursts with HTTP 420 (rate limit)
  for (const sq of Object.keys(SQUAWK)) await (async () => {
    try {
      const r = await fetch(`https://api.adsb.lol/v2/sqk/${sq}`, { headers: { 'User-Agent': 'WFMLabs-GEV/1.0 (ted@wfmlabs.com)' }, next: { revalidate: 60 }, signal: AbortSignal.timeout(10000) })
      if (!r.ok) { failed.push(`squawk ${sq}: HTTP ${r.status}`); return }
      // one aircraft can appear under more than one squawk query; publish it once
      for (const a of (await r.json()).ac ?? []) if (typeof a.lat === 'number' && !seen.has(a.hex) && seen.add(a.hex)) out.push({
        hex: a.hex, flight: a.flight ? String(a.flight).trim() : null, reg: a.r ?? null, type: a.t ?? null, lat: a.lat, lon: a.lon,
        alt_ft: typeof a.alt_baro === 'number' ? a.alt_baro : null, gs_kt: typeof a.gs === 'number' ? Math.round(a.gs) : null, track: a.track ?? null, squawk: sq, emergency: SQUAWK[sq],
      })
    } catch { failed.push(`squawk ${sq}: unreachable`) }
    await new Promise((r) => setTimeout(r, 400))
  })()
  return { list: out, failed }
}

export async function GET() {
  try {
    const pool = getPool()
    const [run, boards, budget, em] = await Promise.all([
      pool.query(`SELECT run_id, completed_at, candidates, summary FROM story_runs WHERE completed_at IS NOT NULL ORDER BY started_at DESC LIMIT 1`),
      pool.query(`SELECT DISTINCT ON (airport_icao) airport_icao, run_id, fetched_at, status_counts, reasons, story_count
                    FROM story_boards WHERE error IS NULL AND fetched_at > now() - interval '3 hours' ORDER BY airport_icao, fetched_at DESC`),
      pool.query(`SELECT COALESCE(SUM(cost_units),0)::int units, COUNT(*)::int boards FROM story_boards WHERE fetched_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`),
      emergencies(),
    ])
    const latest = new Map(boards.rows.map((b) => [b.airport_icao, b]))
    const flights = latest.size ? (await pool.query(
      `SELECT * FROM (
         SELECT f.*, row_number() OVER (PARTITION BY f.airport_icao ORDER BY (f.story_kind = 'delayed'), f.delay_min DESC NULLS LAST) rn
           FROM story_flights f JOIN unnest($1::text[], $2::text[]) AS b(icao, run_id) ON f.airport_icao = b.icao AND f.run_id = b.run_id
       ) x WHERE rn <= $3`,
      [[...latest.keys()], [...latest.values()].map((b) => b.run_id), PER_AIRPORT])).rows : []
    const counts: Record<string, Record<string, number>> = {}
    const all = latest.size ? (await pool.query(
      `SELECT f.airport_icao, f.story_kind, count(*)::int n FROM story_flights f JOIN unnest($1::text[], $2::text[]) AS b(icao, run_id) ON f.airport_icao = b.icao AND f.run_id = b.run_id GROUP BY 1, 2`,
      [[...latest.keys()], [...latest.values()].map((b) => b.run_id)])).rows : []
    for (const r of all) (counts[r.airport_icao] ??= {})[r.story_kind] = r.n
    const cands: any[] = run.rows[0]?.candidates ?? []
    const seen = new Set(cands.map((c) => c.icao))
    const airports = cands.map((c) => {
      const b = latest.get(c.icao)
      return { ...c, boarded_at: b?.fetched_at ?? null, status_counts: b?.status_counts ?? null, story_counts: counts[c.icao] ?? null }
    })
    // an airport boarded within 3 h that dropped out of the newest ranking keeps its board (reasons from that board)
    const stale = [...latest.keys()].filter((icao) => !seen.has(icao))
    if (stale.length) {
      const geo = new Map((await pool.query(`SELECT icao, iata, name, lat::float8 lat, lon::float8 lon FROM airports WHERE icao = ANY($1)`, [stale])).rows.map((r) => [r.icao, r]))
      for (const icao of stale) { const b = latest.get(icao)!, g = geo.get(icao); if (g) airports.push({ ...g, reasons: b.reasons, boarded_at: b.fetched_at, status_counts: b.status_counts, story_counts: counts[icao] ?? null, score: 0, stale_rank: true }) }
    }
    const summary = run.rows[0]?.summary ?? {}
    return Response.json({
      airports, flights, emergencies: em.list,
      meta: { run_id: run.rows[0]?.run_id ?? null, run_at: run.rows[0]?.completed_at ?? null, units_today: budget.rows[0].units, boards_today: budget.rows[0].boards,
        failed: em.failed, daily_cap: summary.cap ?? null, reserve_pct: summary.reserve_pct ?? null, reserve_active: summary.reserve_active ?? null, boards_enabled: summary.enabled ?? null, per_airport_cap: PER_AIRPORT, positions: 'free ADS-B (adsb.lol); no coverage over Russia and parts of Africa/Asia' },
    }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } })
  } catch (e) {
    // public endpoint: log the detail server-side, never hand pg error text to anonymous clients
    console.error('[gev-story-flights]', e)
    return Response.json({ error: 'story flights unavailable', meta: { failed: ['story-flights'] } }, { status: 502 })
  }
}
