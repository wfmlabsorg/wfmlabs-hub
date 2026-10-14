import { describe, expect, test } from 'vitest'
import { isNwsAlertUrl, nwsDashboardHref, nwsHrefFor, nwsNodeForRegion, nwsNodeForStates, statesOfArea } from './nwsHref'

describe('nwsHref', () => {
  test('recognizes an alert JSON link and nothing else', () => {
    expect(isNwsAlertUrl('https://api.weather.gov/alerts/urn:oid:2.49.0.1.840.0.abc.001.1')).toBe(true)
    expect(isNwsAlertUrl('https://alerts.weather.gov/cap/wwacapget.php?x=FL')).toBe(true)
    expect(isNwsAlertUrl('https://www.weather.gov/tbw/')).toBe(false)
    expect(isNwsAlertUrl('not a url')).toBe(false)
    expect(isNwsAlertUrl(null)).toBe(false)
  })
  test('states come out of an NWS area string; marine zones give none', () => {
    expect(statesOfArea('Sarasota, FL; Manatee, FL; Cottle, TX')).toEqual(['FL', 'TX'])
    expect(statesOfArea('Coastal waters from Bonita Beach to Englewood FL out 20 NM')).toEqual([])
  })
  test('a state or a region id resolves to its US sub-region dashboard', () => {
    expect(nwsNodeForStates(['FL'])).toBe('us-southeast')
    expect(nwsNodeForStates(['TX', 'OK'])).toBe('us-south-central')
    expect(nwsNodeForStates(['PR'])).toBeNull()
    expect(nwsNodeForRegion('us-midwest')).toBe('us-midwest')
    expect(nwsNodeForRegion('emea')).toBeNull()
  })
  test('a warning links to its sub-region dashboard, else the general one, never back to the page it is on', () => {
    expect(nwsHrefFor({ states: ['FL'] })).toBe('/travelrisk/region/us-southeast/nws')
    expect(nwsHrefFor({ area: 'Cottle, TX; King, TX' })).toBe('/travelrisk/region/us-south-central/nws')
    expect(nwsHrefFor({ regionId: 'us-mountain' })).toBe('/travelrisk/region/us-mountain/nws')
    expect(nwsHrefFor({ area: 'Coastal waters out 20 NM' })).toBe('/travelrisk/region/global/nws')
    expect(nwsHrefFor({ states: ['FL'] }, 'us-southeast')).toBeNull()
    expect(nwsHrefFor({ states: ['FL'] }, 'global')).toBe('/travelrisk/region/us-southeast/nws')
    expect(nwsDashboardHref()).toBe('/travelrisk/region/global/nws')
  })
})
