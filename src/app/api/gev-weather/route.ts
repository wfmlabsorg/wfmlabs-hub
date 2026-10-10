/**
 * GEV weather feed — aviation hazards and tropical cyclones for the God's Eye View board.
 *
 * Same-origin proxy because aviationweather.gov and nhc.noaa.gov send no CORS headers, so the
 * browser cannot read them directly. Both upstreams are keyless US-government sources.
 *
 *   GET /api/gev-weather?layer=hazards   → FeatureCollection of in-force aviation hazards:
 *        international SIGMETs (isigmet, worldwide), US SIGMETs/convective SIGMETs (airsigmet),
 *        and US G-AIRMETs (gairmet, only the snapshot nearest to now; freezing-level lines dropped).
 *        Every feature is normalised to { src, hazard, cls, label, from, to, top, base, raw }.
 *   GET /api/gev-weather?layer=cyclones  → { storms: [...] } from NHC CurrentStorms.json, each with
 *        its forecast cone, forecast track, forecast points and past track as GeoJSON pulled from
 *        NHC's map service (layer ids looked up by storm bin, never hard-coded: they move).
 *
 * Honesty rule (hub-051): an upstream failure is reported in `meta.failed`, never returned as an
 * empty "no hazards" collection. The board shows a gap notice when it sees one.
 *
 * Public, read-only, cached 5 minutes at the edge.
 */
const AWC = 'https://aviationweather.gov/api/data'
const NHC_STORMS = 'https://www.nhc.noaa.gov/CurrentStorms.json'
const NHC_MS = 'https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather/MapServer'
const UA = { 'User-Agent': 'WFMLabs-GEV/1.0 (ted@wfmlabs.com)' }

type Feature = { type: 'Feature'; geometry: any; properties: Record<string, unknown> }

async function getJson(url: string, revalidate = 300): Promise<any> {
  const r = await fetch(url, { headers: UA, next: { revalidate }, signal: AbortSignal.timeout(20000) })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  return r.json()
}

/** Collapse ~30 upstream hazard codes into the eight classes the board colours. */
function hazardClass(h: string): string {
  const x = h.toUpperCase()
  if (/TS|CONVECTIVE|CB/.test(x)) return 'convective'
  if (/TURB|LLWS|MTW/.test(x)) return 'turbulence'
  if (/ICE|FZLVL/.test(x)) return 'icing'
  if (/VA|ASH/.test(x)) return 'volcanic'
  if (x === 'TC') return 'tropical'
  if (/IFR|MT_OBSC|OBSC/.test(x)) return 'visibility'
  if (/SFC_WND|WND|DS|SS/.test(x)) return 'wind'
  return 'other'
}
const LABEL: Record<string, string> = {
  convective: 'Thunderstorms', turbulence: 'Turbulence', icing: 'Icing', volcanic: 'Volcanic ash',
  tropical: 'Tropical cyclone', visibility: 'Low visibility / IFR', wind: 'Strong surface wind', other: 'Hazard',
}
const clip = (s: unknown, n: number) => (s == null ? null : String(s).slice(0, n))
const num = (v: unknown) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v))

async function hazards() {
  const failed: string[] = []
  const take = async (name: string) => { try { return (await getJson(`${AWC}/${name}?format=geojson`)).features ?? [] } catch { failed.push(name); return [] } }
  const [intl, us, gair] = await Promise.all([take('isigmet'), take('airsigmet'), take('gairmet')])
  const out: Feature[] = []
  for (const f of intl) {
    const p = f.properties ?? {}, cls = hazardClass(p.hazard ?? '')
    out.push({ type: 'Feature', geometry: f.geometry, properties: {
      src: 'SIGMET', hazard: p.hazard, cls, label: `${LABEL[cls]}${p.qualifier ? ` (${p.qualifier})` : ''} · ${p.firName ?? p.firId ?? ''}`.trim(),
      from: p.validTimeFrom, to: p.validTimeTo, top: num(p.top), base: num(p.base), raw: clip(p.rawSigmet, 700) } })
  }
  for (const f of us) {
    const p = f.properties ?? {}, cls = hazardClass(p.hazard ?? '')
    out.push({ type: 'Feature', geometry: f.geometry, properties: {
      src: p.airSigmetType ?? 'SIGMET', hazard: p.hazard, cls, label: `${LABEL[cls]} · US ${p.airSigmetType ?? 'SIGMET'} ${p.seriesId ?? ''}`.trim(),
      from: p.validTimeFrom, to: p.validTimeTo, top: num(p.altitudeHi2 ?? p.altitudeHi1), base: num(p.altitudeLow1 ?? p.altitudeLow2), raw: clip(p.rawAirSigmet, 700) } })
  }
  // G-AIRMETs are 3-hourly forecast SNAPSHOTS (validTime = the instant described), polygons only.
  // Each snapshot stands for validTime ± 90 min, so `from`/`to` bracket that window. Pick the snapshot
  // whose window contains now; failing that the next future one — never a past one the board would drop.
  const now = Date.now(), HALF = 90 * 60e3
  const polys = gair.filter((f: any) => f.geometry?.type !== 'LineString')
  const times = ([...new Set(polys.map((f: any) => f.properties?.validTime))].filter(Boolean) as string[]).sort()
  const chosen = times.find((t) => Math.abs(Date.parse(t) - now) <= HALF) ?? times.find((t) => Date.parse(t) > now)
  for (const f of polys.filter((f: any) => chosen && f.properties?.validTime === chosen)) {
    const p = f.properties ?? {}, cls = hazardClass(p.hazard ?? '')
    out.push({ type: 'Feature', geometry: f.geometry, properties: {
      src: 'G-AIRMET', hazard: p.hazard, cls, label: `${LABEL[cls]} · US G-AIRMET`,
      from: new Date(Date.parse(p.validTime) - HALF).toISOString(), to: new Date(Date.parse(p.validTime) + HALF).toISOString(),
      top: num(p.top) != null ? num(p.top)! * 100 : null, base: num(p.base) != null ? num(p.base)! * 100 : null, raw: null } })
  }
  return { type: 'FeatureCollection', features: out, meta: { fetched_at: new Date().toISOString(), counts: { sigmet_intl: intl.length, sigmet_us: us.length, gairmet: polys.length }, failed } }
}

let layerIndex: { at: number; ids: Record<string, number> } | null = null
async function nhcLayerIds(): Promise<Record<string, number>> {
  if (layerIndex && Date.now() - layerIndex.at < 3600e3) return layerIndex.ids
  const d = await getJson(`${NHC_MS}?f=json`, 3600)
  const ids: Record<string, number> = {}
  for (const l of d.layers ?? []) ids[l.name] = l.id
  layerIndex = { at: Date.now(), ids }
  return ids
}
async function nhcLayer(id: number | undefined, failed: string[], what: string) {
  if (id == null) { failed.push(`${what} (layer not published)`); return null }
  try { return await getJson(`${NHC_MS}/${id}/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`) }
  catch { failed.push(what); return null }
}

async function cyclones() {
  const failed: string[] = []
  let storms: any[] = []
  try { storms = (await getJson(NHC_STORMS)).activeStorms ?? [] } catch { failed.push('nhc-storms') }
  let ids: Record<string, number> = {}
  if (storms.length) { try { ids = await nhcLayerIds() } catch { failed.push('nhc-layers') } }
  const out = await Promise.all(storms.map(async (s) => {
    const bin = s.binNumber
    // a storm whose cone or track did not load is reported as a gap, not shown as a complete storm
    const [cone, track, points, past] = await Promise.all(['Forecast Cone', 'Forecast Track', 'Forecast Points', 'Past Track'].map((n) => nhcLayer(ids[`${bin} ${n}`], failed, `${s.name} ${n.toLowerCase()}`)))
    return {
      id: s.id, bin, name: s.name, classification: s.classification, intensity_kt: num(s.intensity), pressure_mb: num(s.pressure),
      lat: num(s.latitudeNumeric), lon: num(s.longitudeNumeric), movement_dir: num(s.movementDir),
      // NHC publishes movementSpeed in mph; the board speaks knots
      movement_kt: num(s.movementSpeed) != null ? Math.round(num(s.movementSpeed)! * 0.868976) : null,
      updated: s.lastUpdate, advisory_url: s.publicAdvisory?.url ?? null, cone, track, points, past,
    }
  }))
  return { storms: out, meta: { fetched_at: new Date().toISOString(), coverage: 'NHC/CPHC: Atlantic, East and Central Pacific only', failed } }
}

export async function GET(req: Request) {
  const layer = new URL(req.url).searchParams.get('layer')
  try {
    const body = layer === 'hazards' ? await hazards() : layer === 'cyclones' ? await cyclones() : null
    if (!body) return Response.json({ error: 'layer must be hazards or cyclones' }, { status: 400 })
    return Response.json(body, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })
  } catch (e) {
    return Response.json({ error: String(e), meta: { failed: [layer] } }, { status: 502 })
  }
}
