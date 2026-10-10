/**
 * GEV aviation — the data behind World Glass's aviation operations layer (roadmap Cycle 3).
 * Served by src/app/api/gev-aviation/route.ts; drawn by public/roc/globe/wg-aviation.js.
 *
 * TWO PAYLOADS
 *   faa       FAA NAS Status traffic-management programs at US airports: ground stops, ground delay
 *             programs, airport closures, arrival/departure delays, deicing, and airspace flow programs.
 *   airspace  Country and FIR airspace states written by the roc `airspace` worker (api-056) into the
 *             hub database (`airspace_states`): an OPERATIONAL axis (closed / restricted, from FAA
 *             NOTAMs) and an ADVISORY axis (caution / avoid / do-not-fly, from EASA conflict-zone
 *             bulletins and safeairspace.net). The worker's only HTTP read is /ring?icao= (one airport),
 *             so this reads the table it writes, the same way /api/roc-airports reads its ring view.
 *
 * SOURCES AND LICENCES (all keyless, all usable on a public commercial page)
 *   - FAA NAS Status, https://nasstatus.faa.gov/api/airport-events (JSON, per-airport records with
 *     timestamps and coordinates) and /api/airport-status-information (XML; the only place airspace
 *     flow programs appear, and the fallback if the JSON fails). US Government work, public domain.
 *     Parsing follows the idea of roc travel-intel faaEvents.ts (lifecycle from the feed's own
 *     timestamps; recurring "DLY" NOTAM windows and "CLSD TO <type>" closures are not aerodrome
 *     closures) — re-implemented here, not imported.
 *   - FIR boundaries: VATSIM vatspy-data-project, Boundaries.geojson + VATSpy.dat
 *     (https://github.com/vatsimnetwork/vatspy-data-project). Licence: CC BY-SA 4.0 — attribution
 *     required and given in the board's credits line by the plugin; commercial use allowed. These are
 *     simulation-network boundaries maintained by volunteers: close to the real ICAO FIRs, not
 *     authoritative, and the board says so on every FIR card.
 *   - Country outlines: Natural Earth 1:110m admin-0 countries (public domain, naturalearthdata.com).
 *     A country-scoped advisory is drawn on the country's land territory, which is NOT its FIR: the
 *     card says so.
 *
 * HONESTY RULES (hub-051)
 *   - An upstream failure goes in `meta.failed`; it is never returned as an empty "all clear".
 *   - Nothing is placed where we do not know it is. A program or zone we cannot locate is listed in
 *     `unlocated`, not dropped, and a marker placed from a secondary source carries `approx: true`.
 *   - No state is inferred from absence: an airport with no FAA record is not "fine", it is simply not
 *     in this payload, and the airspace operational axis reports its own unknown reasons verbatim.
 */
import { getPool } from '@/lib/db'

const UA = { 'User-Agent': 'WFMLabs-GEV/1.0 (ted@wfmlabs.com)' }
const FAA_JSON = 'https://nasstatus.faa.gov/api/airport-events'
const FAA_XML = 'https://nasstatus.faa.gov/api/airport-status-information'
const VATSPY = 'https://raw.githubusercontent.com/vatsimnetwork/vatspy-data-project/master'
const NE_110M = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson'
const DAY = 86400e3

type LonLat = [number, number]
type Poly = LonLat[][]                  // outer ring + holes
type Loc = { lat: number; lon: number; name: string | null; src: 'faa' | 'registry' | 'vatspy' }

// ── small parsing helpers ─────────────────────────────────────────────────────────────────
const clip = (s: unknown, n: number) => (s == null || s === '' ? null : String(s).slice(0, n))
const finite = (v: unknown): number | null => { const n = typeof v === 'number' ? v : v == null || v === '' ? NaN : Number(v); return Number.isFinite(n) ? n : null }
const iso = (v: unknown): string | null => { if (!v) return null; const t = Date.parse(String(v)); return Number.isFinite(t) ? new Date(t).toISOString() : null }

/** "1 hour and 42 minutes" → 102; "45" → 45; 45 → 45. Prose with no number → null, never 0. */
export function minutes(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v)
  if (/^\s*\d+(\.\d+)?\s*$/.test(s)) return Number(s)
  const h = /(\d+)\s*hour/i.exec(s), m = /(\d+)\s*min/i.exec(s)
  if (!h && !m) return null
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0)
}

export type Lifecycle = 'live' | 'scheduled' | 'resolved' | 'unknown'
/** Cancellation beats any window, then a past end, then a future start (same precedence as faaEvents.ts). */
export function lifecycle(start: unknown, end: unknown, now: number, cancelledAt?: unknown): Lifecycle {
  if (cancelledAt) return 'resolved'
  const s = start ? Date.parse(String(start)) : NaN, e = end ? Date.parse(String(end)) : NaN
  if (Number.isFinite(e) && e <= now) return 'resolved'
  if (Number.isFinite(s) && s > now) return 'scheduled'
  if (Number.isFinite(s) || Number.isFinite(e)) return 'live'
  return 'unknown'
}
const RECURRING_RE = /\b(?:DLY|DAILY)\b/i
const AERODROME_CLOSED_RE = /\bA[DP]\s+AP\s+CLSD\b|\bAP\s+CLSD\b/i
const QUALIFIED_RE = /\bCLSD\s+TO\b/i
export const isRecurring = (t: string | null | undefined) => !!t && RECURRING_RE.test(t)
export const isQualifiedClosure = (t: string | null | undefined) => !!t && QUALIFIED_RE.test(t)
export const isAerodromeClosure = (t: string | null | undefined) => !!t && !QUALIFIED_RE.test(t) && AERODROME_CLOSED_RE.test(t)

async function getText(url: string, revalidate: number | false, timeout = 20000): Promise<string> {
  // files over Next's 2 MB data-cache limit are fetched uncached and kept in module memory instead
  const init: RequestInit & { next?: { revalidate: number } } = revalidate === false ? { headers: UA, cache: 'no-store' } : { headers: UA, next: { revalidate } }
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.text()
}

/** Keep a cached value for `ttl`, share one in-flight load, and never cache a failure. */
function memo<T>(ttl: number, load: () => Promise<T>): () => Promise<T> {
  let at = 0, val: T | null = null, inflight: Promise<T> | null = null
  return () => {
    if (val && Date.now() - at < ttl) return Promise.resolve(val)
    if (!inflight) inflight = load().then((v) => { val = v; at = Date.now(); return v }).finally(() => { inflight = null })
    return inflight
  }
}

// ── reference geometry (VATSpy + Natural Earth), cached per server instance for a day ─────────
/** Drop points closer than `tol` degrees to the last kept one, round to 3 dp. Keeps rings closed. */
function thin(ring: number[][], tol = 0.04): LonLat[] {
  const out: LonLat[] = []
  let prevLon: number | null = null
  for (const c of ring) {
    if (!Array.isArray(c) || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue
    // unwrap across the antimeridian (179 → -179 becomes 179 → 181) so a Pacific FIR is not drawn the long way round
    let lon = c[0]
    if (prevLon != null) { while (lon - prevLon > 180) lon -= 360; while (lon - prevLon < -180) lon += 360 }
    prevLon = lon
    const p: LonLat = [Math.round(lon * 1000) / 1000, Math.round(c[1] * 1000) / 1000]
    const l = out[out.length - 1]
    if (!l || Math.abs(l[0] - p[0]) + Math.abs(l[1] - p[1]) >= tol) out.push(p)
  }
  if (out.length > 2) { const a = out[0], z = out[out.length - 1]; if (a[0] !== z[0] || a[1] !== z[1]) out.push([a[0], a[1]]) }
  return out
}
function polysOf(geom: { type?: string; coordinates?: unknown } | null | undefined): Poly[] {
  if (!geom || !Array.isArray(geom.coordinates)) return []
  const raw = geom.type === 'Polygon' ? [geom.coordinates] : geom.type === 'MultiPolygon' ? geom.coordinates : []
  return (raw as number[][][][]).map((p) => p.map((r) => thin(r))).filter((p) => p[0] && p[0].length >= 4)
}

type FirGeo = { polys: Poly[]; label: LonLat | null }
const vatspyBoundaries = memo(DAY, async () => {
  const fc = JSON.parse(await getText(`${VATSPY}/Boundaries.geojson`, false, 30000))
  const firs = new Map<string, FirGeo>()
  for (const f of fc.features ?? []) {
    const id = String(f.properties?.id ?? '').toUpperCase()
    if (!id) continue
    const lx = finite(f.properties?.label_lon), ly = finite(f.properties?.label_lat)
    const cur = firs.get(id) ?? { polys: [], label: lx != null && ly != null ? [lx, ly] as LonLat : null }
    cur.polys.push(...polysOf(f.geometry))
    firs.set(id, cur)
  }
  return firs
})

type VatAirport = { name: string; lat: number; lon: number; lid: string }
const vatspyDat = memo(DAY, async () => {
  const txt = await getText(`${VATSPY}/VATSpy.dat`, DAY / 1000, 30000)
  const countries = new Map<string, string>()          // ICAO nationality prefix → country name
  const airports = new Map<string, VatAirport>()       // ICAO → airport
  const byLid = new Map<string, string>()              // IATA / FAA LID → ICAO
  let section = ''
  for (const line of txt.split(/\r?\n/)) {
    if (!line || line.startsWith(';')) continue
    const sec = /^\[(\w+)\]/.exec(line); if (sec) { section = sec[1]; continue }
    const f = line.split('|')
    if (section === 'Countries' && f[1]) countries.set(f[1].trim().toUpperCase(), f[0].trim())
    if (section === 'Airports' && f[0] && f[6] !== '1') {
      const lat = finite(f[2]), lon = finite(f[3]); if (lat == null || lon == null) continue
      const icao = f[0].trim().toUpperCase(), lid = (f[4] ?? '').trim().toUpperCase()
      if (!airports.has(icao)) airports.set(icao, { name: f[1].trim(), lat, lon, lid })
      if (lid && !byLid.has(lid)) byLid.set(lid, icao)
    }
  }
  return { countries, airports, byLid }
})

type Country = { iso2: string; name: string; polys: Poly[]; label: LonLat | null }
const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const naturalEarth = memo(DAY, async () => {
  const fc = JSON.parse(await getText(NE_110M, DAY / 1000, 30000))
  const byIso = new Map<string, Country>(), byName = new Map<string, string>()
  for (const f of fc.features ?? []) {
    const p = f.properties ?? {}
    const code = [p.ISO_A2, p.ISO_A2_EH, p.WB_A2].map((x: unknown) => String(x ?? '').toUpperCase()).find((x: string) => /^[A-Z]{2}$/.test(x))
    if (!code) continue
    const lx = finite(p.LABEL_X), ly = finite(p.LABEL_Y)
    const c: Country = { iso2: code, name: String(p.NAME ?? code), polys: polysOf(f.geometry), label: lx != null && ly != null ? [lx, ly] : null }
    if (!byIso.has(code)) byIso.set(code, c)
    for (const n of [p.NAME, p.NAME_LONG, p.ADMIN, p.NAME_EN, p.FORMAL_EN, p.NAME_SORT, p.ISO_A3, p.ABBREV, p.GEOUNIT, p.SOVEREIGNT]) if (norm(n) && !byName.has(norm(n))) byName.set(norm(n), code)
  }
  return { byIso, byName }
})

/** Hub registry coordinates (airport_airspace_ring: the same rows /api/roc-airports serves). */
const registry = memo(10 * 60e3, async () => {
  const { rows } = await getPool().query(`SELECT icao, iata, name, country, lat::float8 AS lat, lon::float8 AS lon FROM airport_airspace_ring`)
  const byCode = new Map<string, { icao: string; name: string | null; country: string | null; lat: number; lon: number }>()
  for (const r of rows) {
    if (r.lat == null || r.lon == null) continue
    const a = { icao: String(r.icao), name: r.name ?? null, country: r.country ?? null, lat: Number(r.lat), lon: Number(r.lon) }
    byCode.set(String(r.icao).toUpperCase(), a)
    if (r.iata) byCode.set(String(r.iata).toUpperCase(), a)
  }
  return byCode
})

// ═════════════════════════════════════════════════════════════════════════════════════════
// FAA AIRPORT PROGRAMS
// ═════════════════════════════════════════════════════════════════════════════════════════
export type ProgramKind = 'ground_stop' | 'ground_delay' | 'closure' | 'arrival_delay' | 'departure_delay' | 'deicing'
export interface Program {
  kind: ProgramKind; lifecycle: Lifecycle; source: 'faa-json' | 'faa-xml'
  cause: string | null; avg_delay_min: number | null; max_delay_min: number | null; delay_min_min: number | null
  trend: string | null; start: string | null; end: string | null; updated: string | null
  center: string | null; scope: string | null; advisory_url: string | null
  notam: string | null; text: string | null; recurring: boolean; partial: boolean
}
export interface FaaAirport {
  code: string; name: string | null; lat: number | null; lon: number | null; loc: Loc['src'] | null; approx: boolean
  config: { arrival_runways: string | null; departure_runways: string | null; arrival_rate: number | null; at: string | null } | null
  programs: Program[]
}
export interface FlowProgram { element: string; cause: string | null; avg_delay_min: number | null; start: string | null; end: string | null; floor: string | null; ceiling: string | null; line: LonLat[] | null; raw: string | null }

const blank = (kind: ProgramKind, source: Program['source']): Program => ({
  kind, lifecycle: 'unknown', source, cause: null, avg_delay_min: null, max_delay_min: null, delay_min_min: null, trend: null, start: null, end: null,
  updated: null, center: null, scope: null, advisory_url: null, notam: null, text: null, recurring: false, partial: false,
})
const httpsOnly = (u: unknown) => (typeof u === 'string' && /^https:\/\//i.test(u) ? u.slice(0, 400) : null)

type Rec = Record<string, unknown> & { [k: string]: any }   // the feed's own loose shape
interface Tally { resolved: number; notices_not_drawn: number }

/** One /api/airport-events record → the programs in force or scheduled. Resolved ones are counted, not drawn. */
export function programsFromJson(rec: Rec, now: number, t: Tally): Program[] {
  const out: Program[] = []
  for (const [key, kind] of [['groundStop', 'ground_stop'], ['groundDelay', 'ground_delay']] as const) {
    const g = rec[key]; if (!g || typeof g !== 'object') continue
    const end = g.endTime ?? g.programExpirationTime ?? null
    const lc = lifecycle(g.startTime, end, now, g.gsCancelReceivedTs ?? g.gsCancelSourceTs)
    if (lc === 'resolved') { t.resolved++; continue }
    out.push({ ...blank(kind, 'faa-json'), lifecycle: lc, cause: clip(g.impactingCondition, 200), avg_delay_min: minutes(g.avgDelay), max_delay_min: minutes(g.maxDelay),
      start: iso(g.startTime), end: iso(end), updated: iso(g.updatedAt), center: clip(g.center, 40), scope: clip(String(g.includedFlights ?? '').replace(/^[\s:]+/, ''), 300), advisory_url: httpsOnly(g.advisoryUrl) })
  }
  for (const key of ['airportClosure', 'freeForm'] as const) {
    const c = rec[key]; if (!c || typeof c !== 'object') continue
    const text = String(c.simpleText || c.text || '')
    // a free-form NOTAM is drawn only when it is an unqualified aerodrome closure; the rest are narrow notices
    if (key === 'freeForm' && !isAerodromeClosure(text)) { t.notices_not_drawn++; continue }
    const recurring = isRecurring(text)
    const lc = recurring ? 'scheduled' : lifecycle(c.startTime, c.endTime, now)
    if (lc === 'resolved') { t.resolved++; continue }
    out.push({ ...blank('closure', 'faa-json'), lifecycle: lc, start: iso(c.startTime), end: iso(c.endTime), updated: iso(c.updatedAt ?? c.issuedDate),
      notam: c.notamNumber != null ? String(c.notamNumber).slice(0, 20) : null, text: clip(text.replace(/\s+/g, ' '), 600), recurring, partial: isQualifiedClosure(text) })
  }
  for (const [key, kind] of [['arrivalDelay', 'arrival_delay'], ['departureDelay', 'departure_delay']] as const) {
    const d = rec[key]; if (!d || typeof d !== 'object') continue
    const ad = d.arrivalDeparture ?? {}
    // these carry an updateTime and no window: honestly `unknown` lifecycle, shown as "reported at"
    out.push({ ...blank(kind, 'faa-json'), cause: clip(d.reason, 200), avg_delay_min: minutes(d.averageDelay), delay_min_min: minutes(ad.min), max_delay_min: minutes(ad.max),
      trend: clip(ad.trend || d.trend, 30), updated: iso(d.updateTime) })
  }
  if (rec.deicing && typeof rec.deicing === 'object') {
    const dc = rec.deicing, lc = lifecycle(dc.startTime, dc.endTime, now)
    if (lc === 'resolved') t.resolved++
    else out.push({ ...blank('deicing', 'faa-json'), lifecycle: lc, start: iso(dc.startTime), end: iso(dc.endTime), text: clip(dc.text || dc.simpleText, 300) })
  }
  return out
}

const tag = (x: string, name: string) => { const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(x); return m ? m[1].replace(/&#x?[0-9a-f]+;/gi, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim() : null }

/** The legacy XML: per-airport items (no timestamps, no coordinates) and airspace flow programs. */
export function parseXml(xml: string): { items: { code: string; p: Program }[]; flows: FlowProgram[]; updated: string | null } {
  const items: { code: string; p: Program }[] = [], flows: FlowProgram[] = []
  for (const block of xml.match(/<Delay_type>[\s\S]*?<\/Delay_type>/g) ?? []) {
    const name = tag(block, 'Name') ?? ''
    if (/airspace flow/i.test(name)) {
      for (const m of block.matchAll(/<([A-Za-z_]+)>\s*<CTL_Element>[\s\S]*?<\/\1>/g)) {
        const x = m[0], pts: LonLat[] = []
        for (const pm of x.matchAll(/<Point\b[^>]*?\bLat="(-?[\d.]+)"[^>]*?\bLong="(-?[\d.]+)"/gi)) pts.push([Number(pm[2]), Number(pm[1])])
        for (const pm of x.matchAll(/<Lat>(-?[\d.]+)<\/Lat>\s*<Long>(-?[\d.]+)<\/Long>/gi)) pts.push([Number(pm[2]), Number(pm[1])])
        // AFPs are US-only: a point with positive longitude is a west longitude written unsigned, so it is negated
        const line = pts.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])).map((p): LonLat => (p[0] > 0 ? [-p[0], p[1]] : p))
        flows.push({ element: tag(x, 'CTL_Element') ?? 'AFP', cause: tag(x, 'Reason'), avg_delay_min: minutes(tag(x, 'Avg')), start: tag(x, 'FCA_StartDateTime') ?? tag(x, 'AFP_StartTime'),
          end: tag(x, 'FCA_EndDateTime') ?? tag(x, 'AFP_EndTime'), floor: tag(x, 'Floor'), ceiling: tag(x, 'Ceiling'), line: line.length >= 2 ? line : null, raw: clip(x.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), 500) })
      }
      continue
    }
    const kind: ProgramKind | 'delay' | null = /ground stop/i.test(name) ? 'ground_stop' : /ground delay/i.test(name) ? 'ground_delay' : /closure/i.test(name) ? 'closure' : /arrival|departure/i.test(name) ? 'delay' : null
    if (!kind) continue
    for (const m of block.matchAll(/<([A-Za-z_]+)>\s*<ARPT>[\s\S]*?<\/\1>/g)) {
      const x = m[0], code = (tag(x, 'ARPT') ?? '').toUpperCase(); if (!/^[A-Z0-9]{3,4}$/.test(code)) continue
      const reason = tag(x, 'Reason')
      if (kind === 'closure') {
        // "CLSD TO <aircraft type>" is a narrow restriction, not an aerodrome closure (same rule as the JSON path)
        if (isQualifiedClosure(reason)) continue
        items.push({ code, p: { ...blank('closure', 'faa-xml'), text: clip(reason, 600), recurring: isRecurring(reason), partial: isQualifiedClosure(reason) } })
      } else if (kind === 'delay') {
        const ad = /<Arrival_Departure Type="(\w+)">([\s\S]*?)<\/Arrival_Departure>/.exec(x)
        const k: ProgramKind = ad && /arr/i.test(ad[1]) ? 'arrival_delay' : 'departure_delay'
        items.push({ code, p: { ...blank(k, 'faa-xml'), cause: clip(reason, 200), delay_min_min: minutes(ad && tag(ad[2], 'Min')), max_delay_min: minutes(ad && tag(ad[2], 'Max')), trend: ad && tag(ad[2], 'Trend') } })
      } else {
        items.push({ code, p: { ...blank(kind, 'faa-xml'), cause: clip(reason, 200), avg_delay_min: minutes(tag(x, 'Avg')), max_delay_min: minutes(tag(x, 'Max')), text: tag(x, 'End_Time') ? `ends ${tag(x, 'End_Time')}` : null } })
      }
    }
  }
  const u = tag(xml, 'Update_Time')
  return { items, flows, updated: u ? iso(u.replace(/ GMT$/, 'Z')) ?? iso(u) : null }
}

export async function faa() {
  const now = Date.now(), failed: string[] = [], warnings: string[] = []
  const tally: Tally = { resolved: 0, notices_not_drawn: 0 }
  const [jsonRes, xmlRes] = await Promise.allSettled([
    getText(FAA_JSON, 60).then((t) => JSON.parse(t)),
    getText(FAA_XML, 60),
  ])
  const byCode = new Map<string, FaaAirport>()
  const ensure = (code: string): FaaAirport => {
    let a = byCode.get(code)
    if (!a) { a = { code, name: null, lat: null, lon: null, loc: null, approx: false, config: null, programs: [] }; byCode.set(code, a) }
    return a
  }
  const jsonOk = jsonRes.status === 'fulfilled' && Array.isArray(jsonRes.value)
  const jsonSeen = new Set<string>()       // airport:kind the JSON carried at all, resolved ones included
  if (!jsonOk) failed.push('faa-airport-events')
  else {
    for (const rec of jsonRes.value as Rec[]) {
      const code = String(rec?.airportId ?? '').trim().toUpperCase(); if (!code) continue
      if (rec.groundStop) jsonSeen.add(`${code}:ground_stop`)
      if (rec.groundDelay) jsonSeen.add(`${code}:ground_delay`)
      const progs = programsFromJson(rec, now, tally); if (!progs.length) continue
      const a = ensure(code); a.programs.push(...progs)
      a.name = clip(rec.airportLongName, 120)
      const lat = finite(rec.latitude), lon = finite(rec.longitude)
      if (lat != null && lon != null && (lat !== 0 || lon !== 0)) { a.lat = lat; a.lon = lon; a.loc = 'faa' }
      const cf = rec.airportConfig
      if (cf && typeof cf === 'object') a.config = { arrival_runways: clip(cf.arrivalRunwayConfig, 60), departure_runways: clip(cf.departureRunwayConfig, 60), arrival_rate: finite(cf.arrivalRate), at: iso(cf.sourceTimeStamp) }
    }
  }
  let flows: FlowProgram[] = [], xmlUpdated: string | null = null
  if (xmlRes.status !== 'fulfilled') failed.push('faa-status-xml (airspace flow programs)')
  else {
    const x = parseXml(xmlRes.value); flows = x.flows; xmlUpdated = x.updated
    for (const it of x.items) {
      // with the JSON in hand the XML only fills a stop / delay program the JSON does not carry yet;
      // without it, the XML is the whole (thinner, untimed) picture
      if (jsonOk && it.p.kind !== 'ground_stop' && it.p.kind !== 'ground_delay') continue
      // ...and never re-adds a program the JSON already reported, e.g. one it marks cancelled
      if (jsonSeen.has(`${it.code}:${it.p.kind}`)) continue
      const have = byCode.get(it.code)
      if (have && have.programs.some((p) => p.kind === it.p.kind)) continue
      ensure(it.code).programs.push(it.p)
    }
  }

  // locate anything the FAA payload did not place: hub registry first, then VATSpy (approximate)
  const missing = [...byCode.values()].filter((a) => a.lat == null)
  if (missing.length) {
    let reg: Awaited<ReturnType<typeof registry>> | null = null, vat: Awaited<ReturnType<typeof vatspyDat>> | null = null
    try { reg = await registry() } catch (e) { console.error('[gev-aviation] registry lookup failed', e); warnings.push('registry lookup unavailable') }
    for (const a of missing) {
      const r = reg?.get(a.code) ?? reg?.get(`K${a.code}`)
      if (r) { a.lat = r.lat; a.lon = r.lon; a.loc = 'registry'; a.name = a.name ?? r.name }
    }
    if (missing.some((a) => a.lat == null)) {
      try { vat = await vatspyDat() } catch (e) { console.error('[gev-aviation] VATSpy lookup failed', e); warnings.push('VATSpy airport lookup unavailable') }
      for (const a of missing) {
        if (a.lat != null || !vat) continue
        const icao = vat.byLid.get(a.code) ?? ['K', 'P', ''].map((p) => p + a.code).find((c) => vat!.airports.has(c))
        const v = icao ? vat.airports.get(icao) : undefined
        if (v) { a.lat = v.lat; a.lon = v.lon; a.loc = 'vatspy'; a.approx = true; a.name = a.name ?? v.name }
      }
    }
  }
  const all = [...byCode.values()]
  const airports = all.filter((a) => a.lat != null)
  const unlocated = all.filter((a) => a.lat == null).map((a) => ({ code: a.code, kinds: a.programs.map((p) => p.kind) }))
  const counts: Record<string, number> = {}
  for (const a of all) for (const p of a.programs) counts[p.kind] = (counts[p.kind] ?? 0) + 1
  counts.airspace_flow = flows.length
  return {
    airports, flows, unlocated,
    meta: { fetched_at: new Date().toISOString(), source_updated: xmlUpdated, counts, resolved_not_drawn: tally.resolved, notices_not_drawn: tally.notices_not_drawn,
      flows_without_geometry: flows.filter((f) => !f.line).map((f) => f.element), failed, warnings,
      source: 'FAA NAS Status (nasstatus.faa.gov), US airports only' },
  }
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// AIRSPACE RESTRICTIONS
// ═════════════════════════════════════════════════════════════════════════════════════════
const ADV_RANK: Record<string, number> = { unknown: 0, none: 0, caution: 1, avoid: 2, do_not_fly: 3 }
const OP_RANK: Record<string, number> = { unknown: 0, open: 0, restricted: 2, closed: 3 }

export interface StateRow {
  scope: string; scope_id: string
  operational_state: string; operational_reason: string | null; operational_source: string | null; operational_source_ref: string | null
  operational_checked_at: string | Date | null; operational_unknown_reason: string | null; effective_from: string | Date | null; effective_to: string | Date | null
  advisory_level: string; advisory_reason: string | null; advisory_source: string | null; advisory_source_ref: string | null
  advisory_checked_at: string | Date | null; advisory_valid_until: string | Date | null; advisory_unknown_reason: string | null
  gps_interference: boolean; severity: number | null; severity_band: string | null; updated_at: string | Date | null
}
export interface Zone {
  key: string; scope: 'country' | 'fir' | 'airport'; id: string; name: string
  geom_kind: 'country' | 'fir' | 'marker'; polys: Poly[]; at: LonLat | null; approx: boolean; where: string
  operational_state: string; advisory_level: string; gps_interference: boolean; severity: number | null; severity_band: string | null
  notices: Notice[]
}
export interface Notice {
  scope: string; id: string; operational_state: string; operational_reason: string | null; operational_source: string | null; operational_source_ref: string | null
  operational_checked_at: string | null; operational_unknown_reason: string | null; effective_from: string | null; effective_to: string | null
  advisory_level: string; advisory_reason: string | null; advisory_source: string | null; advisory_source_ref: string | null
  advisory_checked_at: string | null; advisory_valid_until: string | null; gps_interference: boolean
}
const notice = (r: StateRow): Notice => ({
  scope: r.scope, id: r.scope_id, operational_state: r.operational_state, operational_reason: clip(r.operational_reason, 600), operational_source: r.operational_source,
  operational_source_ref: clip(r.operational_source_ref, 300), operational_checked_at: iso(r.operational_checked_at), operational_unknown_reason: r.operational_unknown_reason,
  effective_from: iso(r.effective_from), effective_to: iso(r.effective_to), advisory_level: r.advisory_level, advisory_reason: clip(r.advisory_reason, 600),
  advisory_source: r.advisory_source, advisory_source_ref: clip(r.advisory_source_ref, 300), advisory_checked_at: iso(r.advisory_checked_at),
  advisory_valid_until: iso(r.advisory_valid_until), gps_interference: !!r.gps_interference,
})

export interface Geo {
  firs: Map<string, FirGeo> | null
  countries: { byIso: Map<string, Country>; byName: Map<string, string> } | null
  prefixes: Map<string, string> | null                 // ICAO nationality prefix → country name (VATSpy)
  airports: (code: string) => { lat: number; lon: number; name: string | null; src: Loc['src'] } | null
  countryAirports: (iso2: string) => LonLat[]
}

/** safeairspace's pseudo designators: two-letter prefix + ZZ (HLZZ = Libya), or one letter + ZZZ (KZZZ). */
function pseudoPrefix(id: string, prefixes: Map<string, string> | null): string | null {
  if (!prefixes || id === 'ZZZZ' || !/^[A-Z]{2}ZZ$/.test(id)) return null
  if (prefixes.has(id.slice(0, 2))) return id.slice(0, 2)
  if (/^[A-Z]ZZZ$/.test(id) && prefixes.has(id.slice(0, 1))) return id.slice(0, 1)
  return null
}

/** Pure: the rows the worker wrote + reference geometry → drawable zones and an honest unlocated list. */
export function buildZones(rows: StateRow[], geo: Geo): { zones: Zone[]; unlocated: Notice[] } {
  const zones = new Map<string, Zone>(), unlocated: Notice[] = []
  const countryZone = (iso2: string): Zone | null => {
    const hit = zones.get(`country:${iso2}`); if (hit) return hit
    const c = geo.countries?.byIso.get(iso2)
    let z: Zone | null = null
    if (c && c.polys.length) z = { key: `country:${iso2}`, scope: 'country', id: iso2, name: c.name, geom_kind: 'country', polys: c.polys, at: c.label, approx: true,
      where: 'Country land territory (Natural Earth 1:110m). National airspace and FIR limits over water are not drawn.', operational_state: 'unknown', advisory_level: 'unknown', gps_interference: false, severity: null, severity_band: null, notices: [] }
    else {
      const pts = geo.countryAirports(iso2)
      if (pts.length) z = { key: `country:${iso2}`, scope: 'country', id: iso2, name: c?.name ?? iso2, geom_kind: 'marker', polys: [], approx: true,
        at: [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length],
        where: '≈ boundary not drawn: no outline at this scale; marker at the mean of the hub registry airports in this country.', operational_state: 'unknown', advisory_level: 'unknown', gps_interference: false, severity: null, severity_band: null, notices: [] }
    }
    if (z) zones.set(z.key, z)
    return z
  }
  for (const r of rows) {
    const id = String(r.scope_id || '').toUpperCase(), n = notice(r)
    let z: Zone | null = null
    if (r.scope === 'country') z = countryZone(id)
    else if (r.scope === 'fir') {
      const fir = geo.firs?.get(id)
      const pre = pseudoPrefix(id, geo.prefixes)
      if (fir && fir.polys.length) {
        z = zones.get(`fir:${id}`) ?? { key: `fir:${id}`, scope: 'fir', id, name: `${id} FIR`, geom_kind: 'fir', polys: fir.polys, at: fir.label, approx: true,
          where: 'FIR boundary from the VATSIM VATSpy data project (CC BY-SA 4.0): close to, but not, the official ICAO boundary.', operational_state: 'unknown', advisory_level: 'unknown', gps_interference: false, severity: null, severity_band: null, notices: [] }
        zones.set(z.key, z)
      } else if (pre) {
        const iso2 = geo.countries?.byName.get(norm(geo.prefixes!.get(pre)))
        z = iso2 ? countryZone(iso2) : null
        if (z && z.scope === 'country') z.where += ` Includes country-wide notice ${id} (safeairspace pseudo-designator for ${geo.prefixes!.get(pre)}).`
      } else {
        const ap = /^[A-Z]{4}$/.test(id) ? geo.airports(id) : null
        if (ap) {
          z = zones.get(`fir:${id}`) ?? { key: `fir:${id}`, scope: 'airport', id, name: ap.name ? `${ap.name} (${id})` : id, geom_kind: 'marker', polys: [], at: [ap.lon, ap.lat], approx: ap.src !== 'registry',
            where: `Airport-specific notice; marker at the aerodrome (${ap.src === 'registry' ? 'hub registry' : 'VATSpy, approximate'}).`, operational_state: 'unknown', advisory_level: 'unknown', gps_interference: false, severity: null, severity_band: null, notices: [] }
          zones.set(z.key, z)
        } else if (fir?.label) {
          z = zones.get(`fir:${id}`) ?? { key: `fir:${id}`, scope: 'fir', id, name: `${id} FIR`, geom_kind: 'marker', polys: [], at: fir.label, approx: true,
            where: '≈ boundary not drawn: VATSpy has no polygon for this FIR; marker at its label point.', operational_state: 'unknown', advisory_level: 'unknown', gps_interference: false, severity: null, severity_band: null, notices: [] }
          zones.set(z.key, z)
        }
      }
    }
    if (!z) { unlocated.push(n); continue }
    z.notices.push(n)
    if ((ADV_RANK[n.advisory_level] ?? 0) > (ADV_RANK[z.advisory_level] ?? 0) || z.advisory_level === 'unknown') z.advisory_level = n.advisory_level
    if ((OP_RANK[n.operational_state] ?? 0) > (OP_RANK[z.operational_state] ?? 0) || (z.operational_state === 'unknown' && n.operational_state !== 'unknown')) z.operational_state = n.operational_state
    z.gps_interference = z.gps_interference || n.gps_interference
    if (r.severity != null && (z.severity == null || Number(r.severity) > z.severity)) { z.severity = Number(r.severity); z.severity_band = r.severity_band }
  }
  return { zones: [...zones.values()], unlocated }
}

const ZONES_SQL = `
  SELECT scope, scope_id, operational_state, operational_reason, operational_source, operational_source_ref, operational_checked_at,
         operational_unknown_reason, effective_from, effective_to, advisory_level, advisory_reason, advisory_source, advisory_source_ref,
         advisory_checked_at, advisory_valid_until, advisory_unknown_reason, gps_interference, severity::float8 AS severity, severity_band, updated_at
    FROM airspace_states
   WHERE scope IN ('country', 'fir')
     AND (operational_state IN ('restricted', 'closed') OR advisory_level IN ('caution', 'avoid', 'do_not_fly') OR gps_interference)
   ORDER BY scope, scope_id`
const AXIS_SQL = `
  SELECT scope, operational_state, COALESCE(operational_unknown_reason, '') AS op_reason, advisory_level, COUNT(*)::int AS n,
         MAX(advisory_checked_at) AS adv_checked, MAX(operational_checked_at) AS op_checked
    FROM airspace_states GROUP BY 1, 2, 3, 4`

export async function airspace() {
  const failed: string[] = []
  const pool = getPool()
  let rows: StateRow[] = [], axis: Record<string, unknown>[] = []
  try {
    const [z, a] = await Promise.all([pool.query(ZONES_SQL), pool.query(AXIS_SQL)])
    rows = z.rows as StateRow[]; axis = a.rows
  } catch (e) {
    console.error('[gev-aviation] airspace_states query failed', e)
    failed.push('airspace-states')
    return { zones: [], unlocated: [], meta: { fetched_at: new Date().toISOString(), failed, axis: null } }
  }
  return airspaceFrom(rows, axis, await registry().catch((e) => { console.error('[gev-aviation] registry lookup failed', e); return null }))
}

/** Rows + per-axis tallies (+ registry coordinates, if they loaded) → the airspace payload. Exported for fixtures. */
export async function airspaceFrom(rows: StateRow[], axis: Record<string, unknown>[], regMap: Awaited<ReturnType<typeof registry>> | null) {
  const failed: string[] = []
  const [firs, dat, ne] = await Promise.allSettled([vatspyBoundaries(), vatspyDat(), naturalEarth()])
  if (firs.status !== 'fulfilled') { console.error('[gev-aviation] VATSpy boundaries', firs.reason); failed.push('fir-boundaries (VATSpy)') }
  if (dat.status !== 'fulfilled') { console.error('[gev-aviation] VATSpy.dat', dat.reason); failed.push('fir-index (VATSpy)') }
  if (ne.status !== 'fulfilled') { console.error('[gev-aviation] Natural Earth', ne.reason); failed.push('country-outlines (Natural Earth)') }
  const vat = dat.status === 'fulfilled' ? dat.value : null
  const geo: Geo = {
    firs: firs.status === 'fulfilled' ? firs.value : null,
    countries: ne.status === 'fulfilled' ? ne.value : null,
    prefixes: vat ? vat.countries : null,
    airports: (code) => {
      const r = regMap?.get(code); if (r && r.icao === code) return { lat: r.lat, lon: r.lon, name: r.name, src: 'registry' }
      const v = vat?.airports.get(code); return v ? { lat: v.lat, lon: v.lon, name: v.name, src: 'vatspy' } : null
    },
    countryAirports: (iso2) => {
      if (!regMap) return []
      const seen = new Set<string>(), out: LonLat[] = []
      for (const a of regMap.values()) if (a.country === iso2 && !seen.has(a.icao)) { seen.add(a.icao); out.push([a.lon, a.lat]) }
      return out
    },
  }
  const { zones, unlocated } = buildZones(rows, geo)
  // the operational (NOTAM) axis and the advisory axis, as the worker left them: counts by state + newest check
  const tally = (k: string) => { const o: Record<string, number> = {}; for (const r of axis) { const key = String(r[k] || 'null'); o[key] = (o[key] ?? 0) + Number(r.n) } return o }
  const newest = (k: string) => axis.reduce<string | null>((m, r) => { const v = iso(r[k]); return v && (!m || v > m) ? v : m }, null)
  const advChecked = newest('adv_checked')
  // the worker runs 6-hourly and its own freshness rule expires an answer at 24 h: past 30 h the layer is stale
  if (!advChecked || Date.now() - Date.parse(advChecked) > 30 * 3600e3) failed.push(`airspace worker stale (last advisory check ${advChecked ?? 'never'})`)
  return {
    zones, unlocated,
    meta: {
      fetched_at: new Date().toISOString(), failed,
      axis: { operational: tally('operational_state'), operational_unknown_reason: tally('op_reason'), advisory: tally('advisory_level'), advisory_checked_at: advChecked, operational_checked_at: newest('op_checked') },
      rows: rows.length,
      licences: { fir: 'VATSIM vatspy-data-project, CC BY-SA 4.0', countries: 'Natural Earth, public domain', states: 'roc airspace worker: FAA NOTAM, EASA CZIB, safeairspace.net (OPSGROUP)' },
    },
  }
}
