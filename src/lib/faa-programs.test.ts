import { describe, expect, it } from 'vitest'
import { nationwideStop, shapeFaa, shapeFaaWide, withNationwide, type FaaProgram } from './faa-programs'

// The 2026-11-13 nationwide ground stop as travel-intel emitted it (WFM-156).
const NAS = {
  source: 'FAA-ATCSCC', title: 'Ground Stop: National Airspace System', location: 'United States', lifecycle: 'live', scope: 'system',
  detail: 'Ground Stop in effect for National Airspace System · ATCSCC advisory 120', startsAt: '2026-11-13T20:54:00Z',
  url: 'https://www.fly.faa.gov/adv/adv_otherdis?adv_date=11132026&advn=120', carrier: null, carrierName: null,
}
const AAL = { ...NAS, title: 'Ground Stop: American Airlines (AAL) — system-wide', scope: 'carrier', carrier: 'AAL', carrierName: 'American Airlines' }
const ORD = { source: 'FAA', title: 'Ground Stop: ORD', location: 'ORD', lifecycle: 'live', detail: 'Cause: equipment outage · Center ZAU' }

describe('shapeFaa (airport programmes)', () => {
  it('still ignores the ATCSCC channel: a nationwide stop is not an airport', () => {
    expect(shapeFaa([NAS, ORD])).toEqual({ ORD: [expect.objectContaining({ kind: 'ground_stop', label: 'GS' })] })
  })
})

describe('shapeFaaWide (system and carrier programmes)', () => {
  it('reads the live nationwide stop', () => {
    expect(shapeFaaWide([NAS, ORD])).toEqual([{
      scope: 'system', kind: 'ground_stop', label: 'GS', title: NAS.title, detail: NAS.detail, carrier: null, carrier_name: null,
      starts_at: '2026-11-13T20:54:00Z', href: NAS.url,
    }])
  })
  it('puts system before carrier and keeps the carrier', () => {
    const w = shapeFaaWide([AAL, NAS])
    expect(w.map((p) => p.scope)).toEqual(['system', 'carrier'])
    expect(w[1]).toMatchObject({ carrier: 'AAL', carrier_name: 'American Airlines' })
  })
  it('drops a lifted or scheduled programme, an airport-feed event, and an event with no scope', () => {
    expect(shapeFaaWide([
      { ...NAS, lifecycle: 'resolved', title: 'Ground Stop: National Airspace System — LIFTED' },
      { ...NAS, lifecycle: 'scheduled' }, ORD, { ...NAS, scope: undefined }, { ...NAS, scope: 'airport' },
    ])).toEqual([])
  })
  it('collapses a repeat of the same programme', () => { expect(shapeFaaWide([NAS, NAS])).toHaveLength(1) })
})

describe('nationwideStop / withNationwide', () => {
  const stop = nationwideStop(shapeFaaWide([NAS]))
  const gdp: FaaProgram = { kind: 'ground_delay', label: 'GDP', title: 'Ground Delay: SFO', detail: null, starts_at: null, ends_at: null }
  const ownStop: FaaProgram = { kind: 'ground_stop', label: 'GS', title: 'Ground Stop: ORD', detail: null, starts_at: null, ends_at: null }

  it('a carrier stop or a system ground delay is not a nationwide stop', () => {
    expect(nationwideStop(shapeFaaWide([AAL]))).toBeNull()
    expect(nationwideStop(shapeFaaWide([{ ...NAS, title: 'Ground Delay Program: National Airspace System' }]))).toBeNull()
    expect(stop).not.toBeNull()
  })
  it('stamps every US airport, strongest first, without repeating its own ground stop', () => {
    expect(withNationwide([], { country: 'US', military: false }, stop)).toEqual([expect.objectContaining({ label: 'GS', scope: 'system', title: 'Nationwide ground stop' })])
    expect(withNationwide([ownStop, gdp], { country: 'US' }, stop).map((p) => [p.label, p.scope])).toEqual([['GS', 'system'], ['GDP', undefined]])
  })
  it('leaves non-US airports, military fields and the no-stop case exactly as they were', () => {
    expect(withNationwide([gdp], { country: 'CA' }, stop)).toEqual([gdp])
    expect(withNationwide([], { country: 'US', military: true }, stop)).toEqual([])
    const clsd: FaaProgram = { ...gdp, kind: 'closure', label: 'CLSD', title: 'Closure: SFO' }
    expect(withNationwide([clsd, gdp], { country: 'US' }, stop).map((p) => p.label)).toEqual(['CLSD', 'GS', 'GDP'])
    expect(withNationwide([ownStop], { country: 'US' }, null)).toEqual([ownStop])
  })
})
