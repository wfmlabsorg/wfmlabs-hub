/**
 * FAA programmes for the misery map (2026-10-17). The misery score says what flights have FELT over the last
 * two hours; a ground stop says the regulator has STOPPED traffic now. On 2026-10-16 the score read EWR, LGA,
 * JFK and BWI "calm" while all four were under FAA programmes, because held flights land in the delay
 * statistics only once they move. The two are shown side by side and never blended: the badge does not
 * change the score.
 *
 * Source: travel-intel `/api/travel/events?source=FAA` (wfmlabsorg/roc). travel-intel already parses the FAA
 * NAS JSON with lifecycle and the recurring-NOTAM guard, so this module only shapes it. Resolved and
 * scheduled (recurring) events are dropped. A failed read returns no badges plus the error, never a guess.
 *
 * WIDE PROGRAMMES (WFM-156, 2026-11-13). The FAA held every US departure from 20:54Z and these maps showed a
 * normal country. travel-intel had the stop, as an ATCSCC event with source `FAA-ATCSCC`, location
 * "United States" and scope `system`; this module asked only for source `FAA` and kept only three-letter
 * airport codes, so it could never arrive. A system-scope ground stop is now read as well and stamped on every
 * US airport as a GS badge (marked `scope: 'system'`), and all wide programmes — system and carrier — are
 * returned for a banner. The score is still untouched.
 */

export type FaaKind = 'closure' | 'ground_stop' | 'ground_delay' | 'delay'
export type FaaScope = 'system' | 'carrier'
export interface FaaProgram {
  kind: FaaKind
  label: 'CLSD' | 'GS' | 'GDP' | 'DLY'
  title: string
  detail: string | null
  starts_at: string | null
  ends_at: string | null
  /** Set only when the programme is NOT this airport's own: a system-wide stop stamped on every US airport. */
  scope?: FaaScope
}
/** A programme with no single airport: the whole National Airspace System, or one carrier's fleet. */
export interface FaaWideProgram {
  scope: FaaScope
  kind: 'ground_stop' | 'ground_delay'
  label: 'GS' | 'GDP'
  title: string
  detail: string | null
  carrier: string | null
  carrier_name: string | null
  starts_at: string | null
  href: string | null
}
export interface FaaRead { byIata: Record<string, FaaProgram[]>; wide: FaaWideProgram[]; checked_at: string; error: string | null }

const TRAVEL_INTEL = process.env.TRAVEL_INTEL_URL || 'https://travel-intel.tedlango.workers.dev'
/** Strongest first: a closure outranks a stop, a stop outranks a delay programme. */
export const FAA_ORDER: Record<FaaKind, number> = { closure: 0, ground_stop: 1, ground_delay: 2, delay: 3 }
const LABEL: Record<FaaKind, FaaProgram['label']> = { closure: 'CLSD', ground_stop: 'GS', ground_delay: 'GDP', delay: 'DLY' }

export function faaKind(title: string): FaaKind | null {
  const t = title.toLowerCase()
  if (/^ground stop\b/.test(t)) return 'ground_stop'
  if (/^ground delay\b/.test(t)) return 'ground_delay'
  if (/clos/.test(t)) return 'closure'
  if (/^(departure|arrival) delays?\b/.test(t)) return 'delay'
  return null
}

type RawEvent = { source?: unknown; title?: unknown; detail?: unknown; location?: unknown; lifecycle?: unknown; startsAt?: unknown; endsAt?: unknown; scope?: unknown; carrier?: unknown; carrierName?: unknown; url?: unknown }
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/** Pure: travel-intel events → live FAA programmes keyed by IATA, strongest first. */
export function shapeFaa(events: RawEvent[]): Record<string, FaaProgram[]> {
  const out: Record<string, FaaProgram[]> = {}
  for (const e of events) {
    if (e.source !== 'FAA') continue
    if (e.lifecycle === 'resolved' || e.lifecycle === 'scheduled') continue
    const title = str(e.title); const iata = str(e.location)?.toUpperCase() ?? null
    if (!title || !iata || !/^[A-Z0-9]{3}$/.test(iata)) continue
    const kind = faaKind(title); if (!kind) continue
    const list = (out[iata] ??= [])
    if (list.some((p) => p.kind === kind)) continue
    list.push({ kind, label: LABEL[kind], title: title.slice(0, 120), detail: str(e.detail)?.slice(0, 240) ?? null, starts_at: str(e.startsAt), ends_at: str(e.endsAt) })
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => FAA_ORDER[a.kind] - FAA_ORDER[b.kind])
  return out
}

/** Pure: travel-intel events → live system- and carrier-scope programmes (ATCSCC channel), system first, stops first. */
export function shapeFaaWide(events: RawEvent[]): FaaWideProgram[] {
  const out: FaaWideProgram[] = []
  for (const e of events) {
    if (e.source !== 'FAA-ATCSCC') continue
    if (e.lifecycle === 'resolved' || e.lifecycle === 'scheduled') continue
    const scope = e.scope === 'system' || e.scope === 'carrier' ? e.scope : null
    const title = str(e.title); if (!scope || !title) continue
    const kind = faaKind(title); if (kind !== 'ground_stop' && kind !== 'ground_delay') continue
    const carrier = str(e.carrier)?.toUpperCase() ?? null
    if (out.some((p) => p.scope === scope && p.kind === kind && p.carrier === carrier)) continue
    out.push({
      scope, kind, label: kind === 'ground_stop' ? 'GS' : 'GDP', title: title.slice(0, 120), detail: str(e.detail)?.slice(0, 240) ?? null,
      carrier, carrier_name: str(e.carrierName), starts_at: str(e.startsAt), href: str(e.url),
    })
  }
  const rank = (p: FaaWideProgram) => (p.scope === 'system' ? 0 : 2) + (p.kind === 'ground_stop' ? 0 : 1)
  return out.sort((a, b) => rank(a) - rank(b))
}

/** The live system-wide ground stop, if there is one. A carrier stop is never this: other carriers still fly. */
export function nationwideStop(wide: FaaWideProgram[]): FaaWideProgram | null {
  return wide.find((p) => p.scope === 'system' && p.kind === 'ground_stop') ?? null
}

/**
 * An airport's badges under a nationwide stop: its own closure first (a closed field is closed whatever the
 * system does), then the system GS, then its other programmes minus its own ground stop (the same fact twice). US airports only, and never a military field — it carries no commercial data.
 */
export function withNationwide(own: FaaProgram[], a: { country?: unknown; military?: unknown }, stop: FaaWideProgram | null): FaaProgram[] {
  if (!stop || a.country !== 'US' || a.military === true) return own
  const badge: FaaProgram = { kind: 'ground_stop', label: 'GS', title: 'Nationwide ground stop', detail: stop.detail, starts_at: stop.starts_at, ends_at: null, scope: 'system' }
  return [...own.filter((p) => p.kind === 'closure'), badge, ...own.filter((p) => p.kind !== 'ground_stop' && p.kind !== 'closure')]
}

async function readEvents(source: string): Promise<RawEvent[]> {
  const r = await fetch(`${TRAVEL_INTEL}/api/travel/events?source=${source}`, { signal: AbortSignal.timeout(6000), next: { revalidate: 60 } })
  if (!r.ok) throw new Error(`travel-intel HTTP ${r.status}`)
  const events = ((await r.json()) as { events?: unknown }).events
  if (events != null && !Array.isArray(events)) throw new Error('travel-intel events is not a list')
  return (events as RawEvent[] | undefined) ?? []
}
const failure = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 120)

/** Two reads, judged apart: a failed ATCSCC read never costs the airport badges, and the error says which failed. */
export async function readFaaPrograms(): Promise<FaaRead> {
  const checked_at = new Date().toISOString()
  // fetch AND shaping sit inside each source's boundary: a malformed body from one never costs the other
  const [airport, atcscc] = await Promise.allSettled([readEvents('FAA').then(shapeFaa), readEvents('FAA-ATCSCC').then(shapeFaaWide)])
  const errors = [
    airport.status === 'rejected' ? `airport programmes: ${failure(airport.reason)}` : null,
    atcscc.status === 'rejected' ? `system/carrier programmes: ${failure(atcscc.reason)}` : null,
  ].filter(Boolean)
  return {
    byIata: airport.status === 'fulfilled' ? airport.value : {},
    wide: atcscc.status === 'fulfilled' ? atcscc.value : [],
    checked_at,
    error: errors.length ? errors.join(' · ') : null,
  }
}
