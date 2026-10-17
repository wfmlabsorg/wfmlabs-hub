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
 */

export type FaaKind = 'closure' | 'ground_stop' | 'ground_delay' | 'delay'
export interface FaaProgram {
  kind: FaaKind
  label: 'CLSD' | 'GS' | 'GDP' | 'DLY'
  title: string
  detail: string | null
  starts_at: string | null
  ends_at: string | null
}
export interface FaaRead { byIata: Record<string, FaaProgram[]>; checked_at: string; error: string | null }

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

type RawEvent = { source?: unknown; title?: unknown; detail?: unknown; location?: unknown; lifecycle?: unknown; startsAt?: unknown; endsAt?: unknown }
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

export async function readFaaPrograms(): Promise<FaaRead> {
  const checked_at = new Date().toISOString()
  try {
    const r = await fetch(`${TRAVEL_INTEL}/api/travel/events?source=FAA`, { signal: AbortSignal.timeout(6000), next: { revalidate: 60 } })
    if (!r.ok) return { byIata: {}, checked_at, error: `travel-intel HTTP ${r.status}` }
    const j = (await r.json()) as { events?: RawEvent[] }
    return { byIata: shapeFaa(j.events ?? []), checked_at, error: null }
  } catch (e) {
    return { byIata: {}, checked_at, error: `travel-intel unreachable: ${String((e as Error)?.message ?? e).slice(0, 120)}` }
  }
}
