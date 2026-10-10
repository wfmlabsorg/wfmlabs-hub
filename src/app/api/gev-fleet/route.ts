/**
 * GEV fleet feed — the rest of the ROC fleet, folded into World Glass (wg-fleet.js).
 *
 * Same-origin proxy for three reasons: rail-probe sends no CORS headers; ovix-api's CORS is pinned
 * to the production hosts, so previews could not read it; and the region layer is a 43-call fan-out
 * that belongs behind one edge-cached request, not in every viewer's browser.
 *
 *   GET /api/gev-fleet?layer=hazards → { items: Hazard[], meta }
 *        Natural hazards from ovix-api's canonical events table (/api/events), by source:
 *        USGS + EMSC earthquakes (deduplicated, USGS preferred), GDACS alerts (wildfire, flood,
 *        volcano, drought, earthquake, tropical cyclone outside the NHC basins), NOAA tsunami
 *        messages, NASA EONET, NASA FIRMS, Smithsonian volcanoes, and severe weather warnings
 *        (NWS, SPC, MeteoAlarm) that have not expired. Every item carries `approx: true` when the
 *        upstream placed it at a zone, region or country centroid rather than at the event.
 *        Below-floor items are counted in meta.floored, never silently dropped.
 *   GET /api/gev-fleet?layer=rail → { items: RailItem[], meta }
 *        Unplanned disruptions from the rail-probe worker (SNCB/NMBS via iRail: Belgium plus the
 *        cross-border Brussels corridor). Places are geocoded against iRail's own station list;
 *        a notice whose stations cannot be matched sits at the country centroid, `approx: true`.
 *   GET /api/gev-fleet?layer=regions → { nodes: RegionNode[], meta }
 *        The 5 macro + 38 sub-region op-risk nodes from ovix-api (/regions + /op-risk per node),
 *        composite, level, basis (how many of the 12 domains hold a reading) and the domains that do.
 *
 * Honesty rule (hub-051): an upstream failure is reported in `meta.failed`, never returned as an
 * empty "all clear". A domain with `available: false` is "no reading", not "normal". ovix-api's
 * own feed-health verdict for each source used (LIVE / OK / DELAYED / STALE / DEAD) is passed
 * through in `meta.sources`, so a dead source reads as dead, not as a quiet world.
 *
 * Public, read-only, keyless, cached at the edge (hazards and rail 5 min, regions 5 min).
 */
const OVIX = 'https://ovix-api.tedlango.workers.dev'
const RAIL = 'https://rail-probe.tedlango.workers.dev'
const IRAIL_STATIONS = 'https://api.irail.be/v1/stations?format=json&lang='
const UA = { 'User-Agent': 'WFMLabs-GEV/1.0 (community.wfmlabs.com)' }
const CAP = 400

type Row = Record<string, unknown>

async function getJson(url: string, revalidate = 300, timeout = 20000): Promise<any> {
  const r = await fetch(url, { headers: UA, next: { revalidate }, signal: AbortSignal.timeout(timeout) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}
const num = (v: unknown) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v))
const str = (v: unknown) => (v == null ? '' : String(v))
const clip = (v: unknown, n: number) => (v == null ? null : String(v).slice(0, n))
/** Neon timestamps arrive as "2026-10-10 15:58:21.5+00". */
const iso = (v: unknown) => {
  if (v == null) return null
  const t = Date.parse(String(v).replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'))
  return isFinite(t) ? new Date(t).toISOString() : null
}
const httpUrl = (v: unknown) => {
  const s = str(v).replace(/&amp;/g, '&')
  return /^https?:\/\//.test(s) ? s.slice(0, 500) : null
}
function km(aLat: number, aLon: number, bLat: number, bLon: number) {
  const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(h))
}

/* ── hazards ─────────────────────────────────────────────────────────────── */

/** Which sources to read and how far back (ovix-api filters on ingest time). */
const SOURCES: { source: string; hours: number; minSev?: number }[] = [
  { source: 'usgs', hours: 24 }, { source: 'emsc', hours: 24 },
  { source: 'gdacs', hours: 48 }, { source: 'gdacs_24h', hours: 48 },
  { source: 'tsunami', hours: 72 }, { source: 'eonet', hours: 72 },
  { source: 'firms', hours: 48 }, { source: 'smithsonian', hours: 168 },
  { source: 'nws', hours: 72 }, { source: 'spc', hours: 24 },
  // MeteoAlarm publishes >1000 rows a day across Europe; read only Severe/Extreme (orange/red)
  { source: 'meteoalarm', hours: 72, minSev: 7 },
]
const LIMIT = 500

/** NWS products that do not move a traveller (same call presentation.ts made for NWS marine). */
const NWS_SKIP = /marine|small_craft|gale|surf|rip_current|beach|lake_wind|frost|freeze|tropical_cyclone_local|hurricane_local|air_quality|statement$/
const SOURCE_LABEL: Record<string, string> = {
  usgs: 'USGS', emsc: 'EMSC', gdacs: 'GDACS', gdacs_24h: 'GDACS', tsunami: 'NOAA tsunami', eonet: 'NASA EONET',
  firms: 'NASA FIRMS', smithsonian: 'Smithsonian GVP', nws: 'NWS', spc: 'NWS/SPC', meteoalarm: 'MeteoAlarm',
}

interface Hazard {
  id: string; kind: string; src: string; title: string; sev: number; label: string | null
  lat: number; lon: number; approx: boolean; precision: string | null; at: string | null; expires: string | null
  url: string | null; detail: string | null; mag?: number | null; gdacs?: string | null; gdacsNote?: string | null; area?: string | null
}

function kindOf(source: string, type: string): string {
  const t = type.toLowerCase()
  if (t.includes('earthquake') || source === 'usgs' || source === 'emsc') return 'quake'
  if (t.includes('volcan') || source === 'smithsonian') return 'volcano'
  if (t.includes('wildfire') || t.includes('fire') || source === 'firms') return 'wildfire'
  if (t.includes('tsunami') || source === 'tsunami') return 'tsunami'
  if (t.includes('tropical') || t.includes('hurricane') || t.includes('typhoon')) return 'cyclone'
  if (t.includes('flood')) return 'flood'
  if (t.includes('drought')) return 'drought'
  if (t.includes('ice')) return 'ice'
  if (t.includes('tornado') || t.includes('severe') || t.includes('storm') || t.includes('thunder') || t.includes('gewitter')) return 'storm'
  return 'weather'
}

/** Floor: what is drawn. Everything below is counted in meta.floored by reason. */
function belowFloor(h: Hazard, source: string, row: Row): string | null {
  const lbl = str(row.severity_label)
  if (h.kind === 'quake' && (h.mag ?? 0) < 4.5) return 'earthquakes below M4.5'
  if ((source === 'gdacs' || source === 'gdacs_24h') && /green/i.test(lbl) && (h.kind === 'wildfire' || h.kind === 'drought')) return 'GDACS green wildfire/drought notices'
  if (source === 'firms' && /^active fire$/i.test(lbl)) return 'FIRMS small fire detections'
  if (source === 'nws' && NWS_SKIP.test(str(row.event_type))) return 'NWS marine, surf, frost and statement products'
  if (source === 'nws' && /^minor$/i.test(lbl)) return 'NWS minor-severity alerts'
  if (h.kind === 'ice') return 'sea and lake ice'
  if (source === 'tsunami' && /information/i.test(lbl)) return 'tsunami information statements (no threat)'
  return null
}

async function hazards() {
  const failed: string[] = []
  const floored: Record<string, number> = {}
  const truncated: string[] = []
  const now = Date.now()
  const [health, ...batches] = await Promise.all([
    getJson(`${OVIX}/api/ovix/feed-health`, 300).catch(() => { failed.push('ovix feed-health'); return null }),
    ...SOURCES.map((s) =>
      getJson(`${OVIX}/api/events?source=${s.source}&hours=${s.hours}&limit=${LIMIT}${s.minSev ? `&severity=${s.minSev}` : ''}`)
        .then((d) => { const ev = (d?.events ?? []) as Row[]; if (ev.length >= LIMIT) truncated.push(s.source); return { s, ev } })
        .catch(() => { failed.push(SOURCE_LABEL[s.source] ?? s.source); return { s, ev: [] as Row[] } })),
  ])

  const quakes: Hazard[] = [], gdacsQuakes: Hazard[] = [], others: Hazard[] = []
  const seenGdacs = new Set<string>()
  for (const { s, ev } of batches) {
    for (const row of ev) {
      const lat = num(row.lat), lon = num(row.lon)
      if (lat == null || lon == null || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue
      const exp = iso(row.expires_at)
      if (exp && Date.parse(exp) < now) continue   // an expired warning is history, not a hazard
      const type = str(row.event_type), precision = str(row.precision) || null
      const mag = s.source === 'usgs' || s.source === 'emsc' || /earthquake/i.test(type)
        ? num((str(row.severity_label).match(/M\s?(\d+(?:\.\d+)?)/) ?? str(row.title).match(/Magnitude\s+(\d+(?:\.\d+)?)/i) ?? [])[1]) : null
      const h: Hazard = {
        id: `hz:${str(row.id) || `${s.source}:${lat},${lon}`}`, kind: kindOf(s.source, s.source === 'eonet' ? `${type} ${str(row.title)}` : type), src: SOURCE_LABEL[s.source] ?? s.source,
        title: clip(row.title, 200) ?? type, sev: num(row.severity) ?? 0, label: clip(row.severity_label, 60),
        lat, lon, approx: precision != null && precision !== 'exact', precision, at: iso(row.occurred_at), expires: exp,
        url: httpUrl(row.source_url), detail: clip(row.description, 500), mag, area: clip(row.area_desc, 160),
      }
      const floor = belowFloor(h, s.source, row)
      if (floor) { floored[floor] = (floored[floor] ?? 0) + 1; continue }
      if (s.source === 'gdacs' || s.source === 'gdacs_24h') {
        // the two GDACS feeds overlap; one event per type and place
        const key = `${h.kind}|${lat.toFixed(1)}|${lon.toFixed(1)}`
        if (seenGdacs.has(key)) continue
        seenGdacs.add(key)
        h.gdacs = (str(row.severity_label).match(/green|orange|red/i) ?? [null])[0]
        // NHC already draws the Atlantic and East/Central Pacific; GDACS fills the rest (West Pacific, Indian Ocean)
        if (h.kind === 'cyclone' && lat > 0 && lon < 0) { floored['GDACS cyclones in NHC basins (drawn by the cyclone layer)'] = (floored['GDACS cyclones in NHC basins (drawn by the cyclone layer)'] ?? 0) + 1; continue }
        if (h.kind === 'quake') { gdacsQuakes.push(h); continue }
      }
      if (s.source === 'eonet' && h.kind === 'cyclone') { floored['EONET storms (cyclone layer / GDACS carry these)'] = (floored['EONET storms (cyclone layer / GDACS carry these)'] ?? 0) + 1; continue }
      if (h.kind === 'quake') quakes.push(h)
      else others.push(h)
    }
  }

  // Earthquakes: USGS and EMSC report the same shocks. Keep one, USGS first (it is fetched first).
  const keptQuakes: Hazard[] = []
  for (const q of quakes) {
    const dup = keptQuakes.find((k) => km(k.lat, k.lon, q.lat, q.lon) < 100 && Math.abs(Date.parse(k.at ?? '') - Date.parse(q.at ?? '')) < 180e3 && Math.abs((k.mag ?? 0) - (q.mag ?? 0)) <= 0.5)
    if (dup) { floored['duplicate EMSC/USGS reports'] = (floored['duplicate EMSC/USGS reports'] ?? 0) + 1; continue }
    keptQuakes.push(q)
  }
  // A GDACS earthquake alert adds the population exposure to the shock it describes.
  for (const g of gdacsQuakes) {
    const host = keptQuakes.find((k) => km(k.lat, k.lon, g.lat, g.lon) < 150 && Math.abs(Date.parse(k.at ?? '') - Date.parse(g.at ?? '')) < 3600e3)
    const exposure = (g.title.match(/,\s*([^,]*\bin\s+\d+km)\.?$/i) ?? [])[1] ?? null
    if (host) { host.gdacs = g.gdacs; host.gdacsNote = exposure; continue }
    g.gdacsNote = exposure
    keptQuakes.push(g)
  }

  const all = [...keptQuakes, ...others].sort((a, b) => b.sev - a.sev || (b.mag ?? 0) - (a.mag ?? 0))
  if (all.length > CAP) floored[`over the ${CAP}-item cap (lowest severity)`] = all.length - CAP
  const sources: Record<string, { status: string; minutes: number | null; events_24h: number | null }> = {}
  for (const f of (health?.feeds ?? []) as Row[]) {
    const id = str(f.source)
    if (SOURCES.some((s) => s.source === id)) sources[id] = { status: str(f.status), minutes: num(f.minutes_since_last) != null ? Math.round(num(f.minutes_since_last)!) : null, events_24h: num(f.events_24h) }
  }
  return { items: all.slice(0, CAP), meta: { fetched_at: new Date().toISOString(), cap: CAP, floored, truncated, sources, failed } }
}

/* ── rail ────────────────────────────────────────────────────────────────── */

const COUNTRY: Record<string, [number, number]> = {
  belgium: [50.64, 4.67], belgique: [50.64, 4.67], 'belgië': [50.64, 4.67], netherlands: [52.13, 5.29], france: [46.6, 2.4],
  germany: [51.1, 10.4], luxembourg: [49.8, 6.13],
}
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\bbrux\./g, 'bruxelles').replace(/\bbrus\./g, 'brussel').replace(/\bst\./g, 'saint').replace(/[^a-z0-9]+/g, ' ').trim()

let stationIndex: { at: number; map: Map<string, { name: string; lat: number; lon: number }> } | null = null
async function stations(failed: string[]) {
  if (stationIndex && Date.now() - stationIndex.at < 86400e3) return stationIndex.map
  const map = new Map<string, { name: string; lat: number; lon: number }>()
  const before = failed.length
  for (const lang of ['en', 'fr', 'nl']) {
    try {
      const d = await getJson(IRAIL_STATIONS + lang, 86400)
      for (const s of (d?.station ?? []) as Row[]) {
        const lat = num(s.locationY), lon = num(s.locationX)
        if (lat == null || lon == null) continue
        const v = { name: str(s.standardname || s.name), lat, lon }
        for (const n of [str(s.name), str(s.standardname), ...str(s.standardname).split('/'), ...str(s.name).split('/')]) {
          const k = norm(n)
          if (k && !map.has(k)) map.set(k, v)
        }
      }
    } catch { failed.push(`iRail stations (${lang})`) }
  }
  // a partial index (one language failed) is used for this request but never cached
  if (map.size && failed.length === before) stationIndex = { at: Date.now(), map }
  return map
}
/** "Brux./Brus.-Schuman" → candidates "Brux.-Schuman", "Brus.-Schuman"; "Anvers-Sud / Antwerpen-Zuid" → both halves. */
function candidates(end: string): string[] {
  const parts = end.split('/').map((p) => p.trim()).filter(Boolean)
  const out = [end, ...parts]
  const last = parts[parts.length - 1] ?? ''
  const dash = last.indexOf('-')
  if (parts.length > 1 && dash > 0) { const suffix = last.slice(dash); for (const p of parts.slice(0, -1)) if (!p.includes('-')) out.push(p + suffix) }
  return out
}

async function rail() {
  const failed: string[] = []
  let probe: any = null
  try { probe = await getJson(`${RAIL}/probe`, 300, 25000) } catch { failed.push('rail-probe') }
  if (probe?.error) { failed.push(`rail-probe upstream (${clip(probe.feed, 40) ?? 'iRail'})`); probe = null }
  const signals = (probe?.signals ?? []) as Row[]
  const map = signals.length ? await stations(failed) : new Map()
  const items = signals.slice(0, 80).map((s, i) => {
    const title = str(s.title), scope = str(s.regionName) || title.split(':')[0]
    const meta = (s.metadata ?? {}) as Row
    const ends = scope.split(/\s+-\s+/).map((e) => e.trim()).filter(Boolean)
    const points: { name: string; lat: number; lon: number }[] = []
    for (const e of ends) {
      const hit = candidates(e).map((c) => map.get(norm(c))).find(Boolean)
      if (hit && !points.some((p) => p.name === hit.name)) points.push(hit)
    }
    const country = COUNTRY[norm(scope)] ?? null
    const approx = points.length === 0
    const at = approx ? (country ?? COUNTRY.belgium) : null
    return {
      id: `rl:${i}:${norm(title).slice(0, 60).replace(/ /g, '-')}`, title: clip(title, 200), message: clip(s.message, 700), scope: clip(scope, 120),
      operator: clip(meta.operator, 80), kind: clip(meta.disruption_kind, 20), severity: num(s.severity), url: httpUrl(s.sourceUrl),
      points, approx, matched: `${points.length} of ${ends.length}`, centroid: at ? { lat: at[0], lon: at[1], what: country ? `${scope} (country centroid)` : 'Belgium (country centroid: stations not matched)' } : null,
    }
  })
  return {
    items,
    meta: {
      fetched_at: new Date().toISOString(), operator: probe?.operator ?? null, fetched: num(probe?.fetched), planned_dropped: num(probe?.droppedAsPlannedWorks),
      below_floor: num(probe?.droppedBelowSeverityFloor), coverage: 'SNCB/NMBS via iRail: Belgium and the cross-border Brussels corridor only; other European operators need keys and are not wired', failed,
    },
  }
}

/* ── regions ─────────────────────────────────────────────────────────────── */

async function regions() {
  const failed: string[] = []
  const reg = await getJson(`${OVIX}/api/ovix/regions`, 3600).catch(() => null)
  if (!reg) return { nodes: [], meta: { fetched_at: new Date().toISOString(), asked: 0, unreachable: 0, failed: ['ovix regions'] } }
  const list = [
    ...((reg.macroRegions ?? []) as Row[]).map((n) => ({ n, tier: 'macro' })),
    ...((reg.subRegions ?? []) as Row[]).map((n) => ({ n, tier: 'sub' })),
  ].filter((x) => num(x.n.lat) != null && num(x.n.lon) != null)
  const payloads = await Promise.all(list.map((x) => getJson(`${OVIX}/api/ovix/op-risk?scope=region&region=${encodeURIComponent(str(x.n.id))}`, 300, 15000).catch(() => null)))
  let unreachable = 0
  let updated: string | null = null
  const nodes = list.map((x, i) => {
    const p = payloads[i]
    const base = { id: clip(x.n.id, 60), name: clip(x.n.name, 80), tier: x.tier, parent: clip(x.n.parent, 60), lat: num(x.n.lat), lon: num(x.n.lon) }
    if (!p || !Array.isArray(p.domains)) { unreachable++; return { ...base, reachable: false } }
    if (p.lastUpdated && (!updated || p.lastUpdated > updated)) updated = str(p.lastUpdated)
    const doms = (p.domains as Row[])
    const read = doms.filter((d) => d.available !== false && num(d.score) != null)
    return {
      ...base, reachable: true,
      composite: read.length ? num(p.composite) : null, level: read.length ? clip(p.compositeLevel, 20) : null, state: clip(p.compositeState, 20),
      basis: { settled: num(p.compositeBasis?.settled), provisional: num(p.compositeBasis?.provisional), unavailable: num(p.compositeBasis?.unavailable) },
      domains: read.map((d) => ({ domain: clip(d.domain, 30), score: num(d.score), level: clip(d.level, 20), state: clip(d.state, 20), events: num(d.eventCount), top: clip(d.topEvent, 160), topSource: clip(d.topSource, 60) }))
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
      noReading: doms.filter((d) => !read.includes(d)).map((d) => clip(d.domain, 30)),
      updated: clip(p.lastUpdated, 40),
    }
  })
  if (unreachable) failed.push(`op-risk for ${unreachable} of ${list.length} regions`)
  return { nodes, meta: { fetched_at: new Date().toISOString(), updated, asked: list.length, unreachable, metros: 'not drawn (133 metro nodes are too dense at world scale)', failed } }
}

export async function GET(req: Request) {
  const layer = new URL(req.url).searchParams.get('layer')
  try {
    const body = layer === 'hazards' ? await hazards() : layer === 'rail' ? await rail() : layer === 'regions' ? await regions() : null
    if (!body) return Response.json({ error: 'layer must be hazards, rail or regions' }, { status: 400 })
    return Response.json(body, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })
  } catch (e) {
    console.error('[gev-fleet]', layer, e)
    return Response.json({ error: 'upstream read failed', meta: { failed: [layer] } }, { status: 502 })
  }
}
