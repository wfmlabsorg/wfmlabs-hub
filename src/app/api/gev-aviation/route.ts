import { airspace, faa } from '@/lib/gev-aviation'

/**
 * GEV aviation feed — the aviation operations layer of World Glass (roadmap Cycle 3).
 *
 * Same-origin route because nasstatus.faa.gov sends no CORS headers, the airspace states live in the
 * hub database, and the reference geometry (VATSpy FIR boundaries, Natural Earth countries) is trimmed
 * server-side to the few shapes the board needs. Logic and licences: src/lib/gev-aviation.ts.
 *
 *   GET /api/gev-aviation?layer=faa       → { airports: [{ code, name, lat, lon, loc, approx, config, programs[] }],
 *        flows: [airspace flow programs], unlocated: [{ code, kinds }], meta }
 *        Ground stops, ground delay programs, airport closures, arrival/departure delays and deicing at
 *        US airports from FAA NAS Status. Resolved programs are counted in meta, not drawn.
 *   GET /api/gev-aviation?layer=airspace  → { zones: [{ scope, id, geom_kind, polys, at, approx, where, notices[] }],
 *        unlocated: [notices with no place], meta: { axis, licences } }
 *        Country/FIR airspace states written by the roc airspace worker (FAA NOTAM, EASA CZIB, safeairspace).
 *
 * Honesty rule (hub-051): an upstream failure is reported in `meta.failed`, never returned as an empty
 * "all clear"; an item we cannot place is listed in `unlocated`, never dropped; a position or outline
 * from a secondary source is flagged `approx`. On an unexpected exception the error is logged here and
 * the public gets a generic message.
 *
 * Public, read-only. FAA cached 2 minutes at the edge, airspace 10 minutes.
 */
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const layer = new URL(req.url).searchParams.get('layer')
  if (layer !== 'faa' && layer !== 'airspace') return Response.json({ error: 'layer must be faa or airspace' }, { status: 400 })
  try {
    const body = layer === 'faa' ? await faa() : await airspace()
    const maxAge = layer === 'faa' ? 120 : 600
    return Response.json(body, { headers: { 'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge * 2}` } })
  } catch (e) {
    console.error(`[gev-aviation] ${layer} failed`, e)
    return Response.json({ error: 'aviation feed unavailable', meta: { failed: [layer] } }, { status: 502 })
  }
}
