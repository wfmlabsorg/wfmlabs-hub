/**
 * GEV flights — live aircraft around a point, for the God's Eye View board (gev-002).
 *
 *   GET /api/gev-flights?lat=51.5&lon=-0.4&nm=150
 *   → { aircraft: [{ hex, flight, reg, type, lat, lon, alt_ft, gs_kt, track, squawk, emergency, ground }],
 *       meta: { center, nm, total, fetched_at, source } }
 *
 * Source: adsb.lol (community ADS-B network, data under ODbL 1.0 — attribution shown on the board).
 * It sends no CORS headers, so this same-origin proxy fetches it. The board only asks when the
 * camera is zoomed into a region (regional on zoom, per Ted 2026-10-09), never for the whole globe.
 *
 * Fair use: the centre is snapped to a 1° grid and the radius to 50 nm steps, and responses are
 * cached 20 s at the edge, so many viewers over one region share one upstream call.
 * Emergency squawks (7500 / 7600 / 7700) are flagged so the board can ring them.
 */
export const dynamic = 'force-dynamic'

const EMERG: Record<string, string> = { '7500': 'hijack', '7600': 'radio failure', '7700': 'emergency' }

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  const lat = Number(q.get('lat')), lon = Number(q.get('lon'))
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) return Response.json({ error: 'lat and lon required' }, { status: 400 })
  const nm = Math.min(250, Math.max(50, Math.round((Number(q.get('nm')) || 150) / 50) * 50))
  const cLat = Math.round(lat), cLon = Math.round(lon)
  try {
    const r = await fetch(`https://api.adsb.lol/v2/point/${cLat}/${cLon}/${nm}`, {
      headers: { 'User-Agent': 'WFMLabs-GEV/1.0 (ted@wfmlabs.com)' }, next: { revalidate: 20 }, signal: AbortSignal.timeout(15000),
    })
    if (!r.ok) throw new Error(`adsb.lol ${r.status}`)
    const d = await r.json()
    const aircraft = (d.ac ?? []).filter((a: any) => typeof a.lat === 'number' && typeof a.lon === 'number').slice(0, 600).map((a: any) => {
      const sq = a.squawk ? String(a.squawk) : null
      const em = (a.emergency && a.emergency !== 'none') ? String(a.emergency) : (sq && EMERG[sq]) || null
      return {
        hex: a.hex, flight: a.flight ? String(a.flight).trim() : null, reg: a.r ?? null, type: a.t ?? null,
        lat: a.lat, lon: a.lon, alt_ft: typeof a.alt_baro === 'number' ? a.alt_baro : null, ground: a.alt_baro === 'ground',
        gs_kt: typeof a.gs === 'number' ? Math.round(a.gs) : null, track: typeof a.track === 'number' ? a.track : null,
        squawk: sq, emergency: em,
      }
    })
    return Response.json({ aircraft, meta: { center: [cLat, cLon], nm, total: d.total ?? aircraft.length, fetched_at: new Date().toISOString(), source: 'adsb.lol (ODbL)' } },
      { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=40' } })
  } catch (e) {
    return Response.json({ error: String(e), meta: { failed: ['flights'] } }, { status: 502 })
  }
}
