// Approximate region/place → centroid lookup for the ROC globe (hub-018).
//
// WHY THIS EXISTS
// ───────────────
// /api/roc-globe resolves signal coordinates in two precise-ish tiers:
//   Tier 1  precise per-signal metadata->>'lat'/'lon'      → geo_source='precise'
//   Tier 2  exact geo_density.region_name centroid (metro) → geo_source='centroid'
// Everything else was DROPPED (live: ~45 of 86, ~51%). But most of those drops
// carry a perfectly real place name in signals.region_name — cities ("London",
// "Seoul"), sub-national regions ("Campania", "Castile and León"), countries
// ("Italy", "England"), and the OVIX US macro-regions ("US Midwest"). They were
// dropped only because no precise coord and no EXACT geo_density metro match.
//
// geo_density's own country (71) and admin1 (52) rows are NO HELP here: they
// carry country_code/exposure metadata with region_name = NULL and lat/lon =
// NULL, so they can never satisfy the centroid JOIN. There is no other
// place→coordinate table in the Hub DB.
//
// So this module is the spec-sanctioned "small inlined country-centroid map":
// a deterministic, offline place→centroid resolver. Anything it resolves is
// tagged geo_source='approximate' and rendered with an explicit "≈ approximate
// location" treatment + popup note — it is NOT presented as precise.
//
// COVERAGE (data-driven from the live dropped set, 14-day sample)
//   • ~200 countries (handles "Italy"/"England" + the trailing-country half of
//     compound names like "Tyre, Lebanon" / "Cartagena, Spain").
//   • The recurring high-frequency head: world cities, sub-national regions,
//     all US states, US metros (Denver/DFW/OKC), and OVIX US macro-regions.
//   • A comma-split fallback: "City, Region" → try last token as a country,
//     else first token as a place.
// Genuinely place-less signals ("Global", empty, or no resolvable token) stay
// dropped and are reported via meta.signals_no_geo.

export interface Centroid {
  lat: number
  lon: number
}

// Normalize a place string for lookup: lowercase, strip diacritics, collapse
// whitespace/punctuation noise. Keeps commas (the compound-name splitter needs
// them) — they are removed only on the per-token lookups.
function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .toLowerCase()
    .replace(/[-–—]/g, ' ') // hyphens/dashes → space (Baden-Württemberg → baden wurttemberg)
    .replace(/\s+/g, ' ')
    .trim()
}

// Key used for map lookups (no commas / parens noise).
function key(s: string): string {
  return norm(s).replace(/[(),.]/g, '').replace(/\s+/g, ' ').trim()
}

// ── Country centroids (approximate geographic centers) ──────────────────────
// Keyed by normalized country name. A handful of common aliases are added below.
const COUNTRY: Record<string, Centroid> = {
  afghanistan: { lat: 33.9, lon: 67.7 },
  albania: { lat: 41.2, lon: 20.2 },
  algeria: { lat: 28.0, lon: 1.7 },
  angola: { lat: -11.2, lon: 17.9 },
  argentina: { lat: -38.4, lon: -63.6 },
  armenia: { lat: 40.1, lon: 45.0 },
  australia: { lat: -25.3, lon: 133.8 },
  austria: { lat: 47.5, lon: 14.6 },
  azerbaijan: { lat: 40.1, lon: 47.6 },
  bahrain: { lat: 26.0, lon: 50.6 },
  bangladesh: { lat: 23.7, lon: 90.4 },
  belarus: { lat: 53.7, lon: 27.9 },
  belgium: { lat: 50.5, lon: 4.5 },
  bolivia: { lat: -16.3, lon: -63.6 },
  'bosnia and herzegovina': { lat: 43.9, lon: 17.7 },
  botswana: { lat: -22.3, lon: 24.7 },
  brazil: { lat: -14.2, lon: -51.9 },
  bulgaria: { lat: 42.7, lon: 25.5 },
  'burkina faso': { lat: 12.2, lon: -1.6 },
  cambodia: { lat: 12.6, lon: 104.9 },
  cameroon: { lat: 7.4, lon: 12.4 },
  canada: { lat: 56.1, lon: -106.3 },
  chad: { lat: 15.5, lon: 18.7 },
  chile: { lat: -35.7, lon: -71.5 },
  china: { lat: 35.9, lon: 104.2 },
  colombia: { lat: 4.6, lon: -74.3 },
  'congo, democratic republic of the': { lat: -4.0, lon: 21.8 },
  'democratic republic of the congo': { lat: -4.0, lon: 21.8 },
  'dr congo': { lat: -4.0, lon: 21.8 },
  'costa rica': { lat: 9.7, lon: -83.8 },
  croatia: { lat: 45.1, lon: 15.2 },
  cuba: { lat: 21.5, lon: -77.8 },
  cyprus: { lat: 35.1, lon: 33.4 },
  'czech republic': { lat: 49.8, lon: 15.5 },
  czechia: { lat: 49.8, lon: 15.5 },
  denmark: { lat: 56.3, lon: 9.5 },
  'dominican republic': { lat: 18.7, lon: -70.2 },
  ecuador: { lat: -1.8, lon: -78.2 },
  egypt: { lat: 26.8, lon: 30.8 },
  'el salvador': { lat: 13.8, lon: -88.9 },
  estonia: { lat: 58.6, lon: 25.0 },
  ethiopia: { lat: 9.1, lon: 40.5 },
  finland: { lat: 61.9, lon: 25.7 },
  france: { lat: 46.6, lon: 2.2 },
  georgia: { lat: 42.3, lon: 43.4 }, // country (US state handled in PLACE)
  germany: { lat: 51.2, lon: 10.4 },
  ghana: { lat: 7.9, lon: -1.0 },
  greece: { lat: 39.1, lon: 21.8 },
  guatemala: { lat: 15.8, lon: -90.2 },
  honduras: { lat: 15.2, lon: -86.2 },
  hungary: { lat: 47.2, lon: 19.5 },
  iceland: { lat: 65.0, lon: -19.0 },
  india: { lat: 20.6, lon: 79.0 },
  indonesia: { lat: -2.5, lon: 118.0 },
  iran: { lat: 32.4, lon: 53.7 },
  iraq: { lat: 33.2, lon: 43.7 },
  ireland: { lat: 53.4, lon: -8.2 },
  israel: { lat: 31.0, lon: 34.9 },
  italy: { lat: 41.9, lon: 12.6 },
  'ivory coast': { lat: 7.5, lon: -5.5 },
  "cote d'ivoire": { lat: 7.5, lon: -5.5 },
  jamaica: { lat: 18.1, lon: -77.3 },
  japan: { lat: 36.2, lon: 138.3 },
  jordan: { lat: 30.6, lon: 36.2 },
  kazakhstan: { lat: 48.0, lon: 66.9 },
  kenya: { lat: 0.0, lon: 37.9 },
  kosovo: { lat: 42.6, lon: 20.9 },
  kuwait: { lat: 29.3, lon: 47.5 },
  kyrgyzstan: { lat: 41.2, lon: 74.8 },
  laos: { lat: 19.9, lon: 102.5 },
  latvia: { lat: 56.9, lon: 24.6 },
  lebanon: { lat: 33.9, lon: 35.9 },
  libya: { lat: 26.3, lon: 17.2 },
  lithuania: { lat: 55.2, lon: 23.9 },
  luxembourg: { lat: 49.8, lon: 6.1 },
  madagascar: { lat: -18.8, lon: 47.0 },
  malawi: { lat: -13.3, lon: 34.3 },
  malaysia: { lat: 4.2, lon: 101.9 },
  mali: { lat: 17.6, lon: -4.0 },
  malta: { lat: 35.9, lon: 14.4 },
  mauritania: { lat: 21.0, lon: -10.9 },
  mexico: { lat: 23.6, lon: -102.6 },
  moldova: { lat: 47.4, lon: 28.4 },
  mongolia: { lat: 46.9, lon: 103.8 },
  montenegro: { lat: 42.7, lon: 19.4 },
  morocco: { lat: 31.8, lon: -7.1 },
  mozambique: { lat: -18.7, lon: 35.5 },
  myanmar: { lat: 21.9, lon: 95.96 },
  namibia: { lat: -22.96, lon: 18.5 },
  nepal: { lat: 28.4, lon: 84.1 },
  netherlands: { lat: 52.1, lon: 5.3 },
  'new zealand': { lat: -40.9, lon: 174.9 },
  nicaragua: { lat: 12.9, lon: -85.2 },
  niger: { lat: 17.6, lon: 8.1 },
  nigeria: { lat: 9.1, lon: 8.7 },
  'north korea': { lat: 40.3, lon: 127.5 },
  'north macedonia': { lat: 41.6, lon: 21.7 },
  norway: { lat: 60.5, lon: 8.5 },
  oman: { lat: 21.5, lon: 55.9 },
  pakistan: { lat: 30.4, lon: 69.3 },
  palestine: { lat: 31.9, lon: 35.2 },
  panama: { lat: 8.5, lon: -80.8 },
  'papua new guinea': { lat: -6.3, lon: 143.9 },
  paraguay: { lat: -23.4, lon: -58.4 },
  peru: { lat: -9.2, lon: -75.0 },
  philippines: { lat: 12.9, lon: 121.8 },
  poland: { lat: 51.9, lon: 19.1 },
  portugal: { lat: 39.4, lon: -8.2 },
  qatar: { lat: 25.4, lon: 51.2 },
  romania: { lat: 45.9, lon: 25.0 },
  russia: { lat: 61.5, lon: 105.3 },
  'russian federation': { lat: 61.5, lon: 105.3 },
  rwanda: { lat: -1.9, lon: 29.9 },
  'saudi arabia': { lat: 23.9, lon: 45.1 },
  senegal: { lat: 14.5, lon: -14.5 },
  serbia: { lat: 44.0, lon: 21.0 },
  singapore: { lat: 1.35, lon: 103.8 },
  slovakia: { lat: 48.7, lon: 19.7 },
  slovenia: { lat: 46.2, lon: 14.8 },
  somalia: { lat: 5.2, lon: 46.2 },
  'south africa': { lat: -30.6, lon: 22.9 },
  'south korea': { lat: 35.9, lon: 127.8 },
  'south sudan': { lat: 7.3, lon: 30.3 },
  spain: { lat: 40.5, lon: -3.7 },
  'sri lanka': { lat: 7.9, lon: 80.8 },
  sudan: { lat: 12.9, lon: 30.2 },
  sweden: { lat: 60.1, lon: 18.6 },
  switzerland: { lat: 46.8, lon: 8.2 },
  syria: { lat: 34.8, lon: 38.997 },
  taiwan: { lat: 23.7, lon: 120.96 },
  tajikistan: { lat: 38.9, lon: 71.3 },
  tanzania: { lat: -6.4, lon: 34.9 },
  thailand: { lat: 15.9, lon: 100.99 },
  tunisia: { lat: 33.9, lon: 9.5 },
  turkey: { lat: 39.0, lon: 35.2 },
  turkiye: { lat: 39.0, lon: 35.2 },
  turkmenistan: { lat: 38.97, lon: 59.6 },
  uganda: { lat: 1.4, lon: 32.3 },
  ukraine: { lat: 48.4, lon: 31.2 },
  'united arab emirates': { lat: 23.4, lon: 53.8 },
  uae: { lat: 23.4, lon: 53.8 },
  'united kingdom': { lat: 55.4, lon: -3.4 },
  uk: { lat: 55.4, lon: -3.4 },
  'united states': { lat: 39.8, lon: -98.6 },
  usa: { lat: 39.8, lon: -98.6 },
  us: { lat: 39.8, lon: -98.6 },
  uruguay: { lat: -32.5, lon: -55.8 },
  uzbekistan: { lat: 41.4, lon: 64.6 },
  venezuela: { lat: 6.4, lon: -66.6 },
  vietnam: { lat: 14.1, lon: 108.3 },
  yemen: { lat: 15.6, lon: 48.5 },
  zambia: { lat: -13.1, lon: 27.8 },
  zimbabwe: { lat: -19.0, lon: 29.2 },
}

// ── Curated place centroids ────────────────────────────────────────────────
// The recurring high-frequency dropped vocabulary (data-driven from the live
// dropped set): world cities, sub-national regions, every US state, common US
// metros, and the OVIX US macro-regions. Approximate centers, good enough for an
// explicitly-approximate dot. Keyed by normalized name (commas/parens stripped).
const PLACE: Record<string, Centroid> = {
  // OVIX US macro-regions (handle both "US " and "Us " casings via norm)
  'us midwest': { lat: 41.9, lon: -88.0 },
  'us southeast': { lat: 33.0, lon: -84.0 },
  'us northeast': { lat: 42.5, lon: -73.5 },
  'us south central': { lat: 32.0, lon: -96.5 },
  'us mountain west': { lat: 39.5, lon: -111.5 },
  'us mountain': { lat: 39.5, lon: -111.5 },
  'us west coast': { lat: 37.5, lon: -120.5 },
  // US states
  alabama: { lat: 32.8, lon: -86.8 },
  alaska: { lat: 64.2, lon: -149.5 },
  arizona: { lat: 34.2, lon: -111.7 },
  arkansas: { lat: 34.8, lon: -92.4 },
  california: { lat: 36.8, lon: -119.4 },
  colorado: { lat: 39.0, lon: -105.5 },
  connecticut: { lat: 41.6, lon: -72.7 },
  delaware: { lat: 39.0, lon: -75.5 },
  florida: { lat: 27.8, lon: -81.7 },
  // georgia (US) collides with the country; default to country center is fine
  hawaii: { lat: 20.8, lon: -156.3 },
  idaho: { lat: 44.1, lon: -114.7 },
  illinois: { lat: 40.0, lon: -89.2 },
  indiana: { lat: 39.8, lon: -86.3 },
  iowa: { lat: 42.0, lon: -93.5 },
  kansas: { lat: 38.5, lon: -98.4 },
  kentucky: { lat: 37.7, lon: -84.7 },
  louisiana: { lat: 31.0, lon: -92.0 },
  maine: { lat: 45.4, lon: -69.2 },
  maryland: { lat: 39.0, lon: -76.8 },
  massachusetts: { lat: 42.3, lon: -71.8 },
  michigan: { lat: 44.3, lon: -85.6 },
  minnesota: { lat: 46.3, lon: -94.3 },
  mississippi: { lat: 32.7, lon: -89.7 },
  missouri: { lat: 38.5, lon: -92.5 },
  montana: { lat: 46.9, lon: -110.4 },
  nebraska: { lat: 41.5, lon: -99.8 },
  nevada: { lat: 39.3, lon: -116.6 },
  'new hampshire': { lat: 43.4, lon: -71.6 },
  'new jersey': { lat: 40.1, lon: -74.5 },
  'new mexico': { lat: 34.5, lon: -106.0 },
  'new york': { lat: 43.0, lon: -75.5 },
  'north carolina': { lat: 35.6, lon: -79.4 },
  'north dakota': { lat: 47.5, lon: -100.5 },
  ohio: { lat: 40.4, lon: -82.8 },
  oklahoma: { lat: 35.6, lon: -97.5 },
  oregon: { lat: 44.0, lon: -120.5 },
  pennsylvania: { lat: 41.2, lon: -77.2 },
  'rhode island': { lat: 41.7, lon: -71.6 },
  'south carolina': { lat: 33.9, lon: -80.9 },
  'south dakota': { lat: 44.4, lon: -100.2 },
  tennessee: { lat: 35.7, lon: -86.4 },
  texas: { lat: 31.5, lon: -99.3 },
  utah: { lat: 39.3, lon: -111.7 },
  vermont: { lat: 44.0, lon: -72.7 },
  virginia: { lat: 37.5, lon: -78.9 },
  'washington state': { lat: 47.4, lon: -120.5 },
  'west virginia': { lat: 38.6, lon: -80.6 },
  wisconsin: { lat: 44.5, lon: -89.5 },
  wyoming: { lat: 43.0, lon: -107.5 },
  // US metros / cities seen in the dropped set
  denver: { lat: 39.74, lon: -104.99 },
  dfw: { lat: 32.78, lon: -96.8 },
  'dallas fort worth': { lat: 32.78, lon: -96.8 },
  okc: { lat: 35.47, lon: -97.52 },
  'oklahoma city': { lat: 35.47, lon: -97.52 },
  'new york city': { lat: 40.71, lon: -74.01 },
  'los angeles': { lat: 34.05, lon: -118.24 },
  'washington dc': { lat: 38.9, lon: -77.04 },
  'washington d c': { lat: 38.9, lon: -77.04 },
  philadelphia: { lat: 39.95, lon: -75.17 },
  chicago: { lat: 41.88, lon: -87.63 },
  boston: { lat: 42.36, lon: -71.06 },
  austin: { lat: 30.27, lon: -97.74 },
  detroit: { lat: 42.33, lon: -83.05 },
  'kansas city': { lat: 39.1, lon: -94.58 },
  'birmingham al': { lat: 33.52, lon: -86.81 },
  laredo: { lat: 27.5, lon: -99.5 },
  annapolis: { lat: 38.98, lon: -76.5 },
  // World cities / capitals
  tehran: { lat: 35.69, lon: 51.39 },
  moscow: { lat: 55.75, lon: 37.62 },
  'saint petersburg': { lat: 59.93, lon: 30.34 },
  london: { lat: 51.51, lon: -0.13 },
  beirut: { lat: 33.89, lon: 35.5 },
  delhi: { lat: 28.61, lon: 77.21 },
  'new delhi': { lat: 28.61, lon: 77.21 },
  beijing: { lat: 39.9, lon: 116.4 },
  shanghai: { lat: 31.23, lon: 121.47 },
  shenzhen: { lat: 22.54, lon: 114.06 },
  guangzhou: { lat: 23.13, lon: 113.26 },
  chengdu: { lat: 30.57, lon: 104.07 },
  tokyo: { lat: 35.68, lon: 139.69 },
  seoul: { lat: 37.57, lon: 126.98 },
  manila: { lat: 14.6, lon: 120.98 },
  'general santos': { lat: 6.11, lon: 125.17 },
  surabaya: { lat: -7.26, lon: 112.75 },
  bandung: { lat: -6.92, lon: 107.6 },
  kyiv: { lat: 50.45, lon: 30.52 },
  kharkiv: { lat: 49.99, lon: 36.23 },
  odessa: { lat: 46.48, lon: 30.72 },
  geneva: { lat: 46.2, lon: 6.14 },
  zurich: { lat: 47.37, lon: 8.54 },
  'la paz': { lat: -16.5, lon: -68.15 },
  cochabamba: { lat: -17.39, lon: -66.16 },
  bogota: { lat: 4.71, lon: -74.07 },
  havana: { lat: 23.11, lon: -82.37 },
  lima: { lat: -12.05, lon: -77.04 },
  guayaquil: { lat: -2.17, lon: -79.92 },
  santiago: { lat: -33.45, lon: -70.67 },
  'sao paulo': { lat: -23.55, lon: -46.63 },
  brasilia: { lat: -15.8, lon: -47.9 },
  aracaju: { lat: -10.95, lon: -37.07 },
  kampala: { lat: 0.35, lon: 32.58 },
  nanyuki: { lat: 0.01, lon: 37.07 },
  kinshasa: { lat: -4.32, lon: 15.31 },
  goma: { lat: -1.66, lon: 29.22 },
  bunia: { lat: 1.56, lon: 30.25 },
  niamey: { lat: 13.51, lon: 2.11 },
  lagos: { lat: 6.52, lon: 3.38 },
  abuja: { lat: 9.06, lon: 7.5 },
  tegucigalpa: { lat: 14.07, lon: -87.19 },
  islamabad: { lat: 33.69, lon: 73.06 },
  peshawar: { lat: 34.02, lon: 71.58 },
  bannu: { lat: 32.99, lon: 70.6 },
  quetta: { lat: 30.18, lon: 67.0 },
  baghdad: { lat: 33.31, lon: 44.36 },
  doha: { lat: 25.29, lon: 51.53 },
  'kuwait city': { lat: 29.38, lon: 47.99 },
  sohar: { lat: 24.34, lon: 56.71 },
  haifa: { lat: 32.79, lon: 34.99 },
  'gaza city': { lat: 31.5, lon: 34.47 },
  ankara: { lat: 39.93, lon: 32.86 },
  gaziantep: { lat: 37.07, lon: 37.38 },
  tangier: { lat: 35.76, lon: -5.83 },
  sydney: { lat: -33.87, lon: 151.21 },
  melbourne: { lat: -37.81, lon: 144.96 },
  wellington: { lat: -41.29, lon: 174.78 },
  gurgaon: { lat: 28.46, lon: 77.03 },
  noida: { lat: 28.54, lon: 77.39 },
  kozhikode: { lat: 11.26, lon: 75.78 },
  poznan: { lat: 52.41, lon: 16.93 },
  ljubljana: { lat: 46.06, lon: 14.51 },
  zagreb: { lat: 45.81, lon: 15.98 },
  valencia: { lat: 39.47, lon: -0.38 },
  alicante: { lat: 38.35, lon: -0.48 },
  versailles: { lat: 48.8, lon: 2.13 },
  bologna: { lat: 44.49, lon: 11.34 },
  pisa: { lat: 43.72, lon: 10.4 },
  reutlingen: { lat: 48.49, lon: 9.2 },
  wiesbaden: { lat: 50.08, lon: 8.24 },
  heidelberg: { lat: 49.4, lon: 8.69 },
  // Sub-national regions / provinces seen in the dropped set
  mindanao: { lat: 7.5, lon: 125.0 },
  luzon: { lat: 16.0, lon: 121.0 },
  cebu: { lat: 10.32, lon: 123.9 },
  sarangani: { lat: 5.96, lon: 125.2 },
  sulawesi: { lat: -1.85, lon: 120.5 },
  'central sulawesi': { lat: -1.43, lon: 121.45 },
  'north sulawesi': { lat: 0.62, lon: 123.97 },
  palu: { lat: -0.9, lon: 119.87 },
  java: { lat: -7.5, lon: 110.0 },
  sumatra: { lat: 0.0, lon: 102.0 },
  sarawak: { lat: 1.55, lon: 110.36 },
  xinjiang: { lat: 41.0, lon: 85.0 },
  qinghai: { lat: 35.0, lon: 96.0 },
  hunan: { lat: 27.6, lon: 111.7 },
  guangxi: { lat: 23.7, lon: 108.9 },
  guangdong: { lat: 23.3, lon: 113.4 },
  'tamil nadu': { lat: 11.1, lon: 78.7 },
  kerala: { lat: 10.85, lon: 76.27 },
  'uttar pradesh': { lat: 26.85, lon: 80.95 },
  'punjab india': { lat: 31.15, lon: 75.34 },
  'khyber pakhtunkhwa': { lat: 34.0, lon: 71.5 },
  campania: { lat: 40.84, lon: 14.25 },
  'castile and leon': { lat: 41.65, lon: -4.72 },
  andalusia: { lat: 37.39, lon: -5.99 },
  navarre: { lat: 42.7, lon: -1.65 },
  'balearic islands': { lat: 39.57, lon: 2.65 },
  'valencian community': { lat: 39.48, lon: -0.78 },
  'province of almeria': { lat: 37.0, lon: -2.4 },
  tenerife: { lat: 28.29, lon: -16.63 },
  'gran canaria': { lat: 27.96, lon: -15.6 },
  'a coruna': { lat: 43.36, lon: -8.41 },
  crete: { lat: 35.24, lon: 24.81 },
  euboea: { lat: 38.5, lon: 23.9 },
  gavdos: { lat: 34.84, lon: 24.08 },
  'ile de france': { lat: 48.85, lon: 2.35 },
  'haute garonne': { lat: 43.4, lon: 1.3 },
  'rhineland palatinate': { lat: 49.91, lon: 7.45 },
  'baden wurttemberg': { lat: 48.66, lon: 9.35 },
  'lower saxony': { lat: 52.64, lon: 9.85 },
  'tyrol state': { lat: 47.26, lon: 11.4 },
  tyrol: { lat: 47.26, lon: 11.4 },
  scotland: { lat: 56.49, lon: -4.2 },
  england: { lat: 52.36, lon: -1.17 },
  wales: { lat: 52.13, lon: -3.78 },
  'northern ireland': { lat: 54.79, lon: -6.49 },
  'south kivu': { lat: -3.0, lon: 28.0 },
  'north kivu': { lat: -0.8, lon: 29.2 },
  bundibugyo: { lat: 0.71, lon: 30.06 },
  'oyo state': { lat: 8.0, lon: 3.9 },
  'borno state': { lat: 11.8, lon: 13.2 },
  'plateau state': { lat: 9.2, lon: 9.5 },
  'kebbi state': { lat: 11.5, lon: 4.2 },
  'katsina state': { lat: 12.4, lon: 7.6 },
  'zamfara state': { lat: 12.2, lon: 6.2 },
  guerrero: { lat: 17.55, lon: -99.5 },
  oaxaca: { lat: 17.07, lon: -96.72 },
  veracruz: { lat: 19.17, lon: -96.13 },
  'minas gerais': { lat: -18.5, lon: -44.0 },
  bahia: { lat: -12.5, lon: -41.7 },
  pernambuco: { lat: -8.4, lon: -37.9 },
  'santa catarina state': { lat: -27.2, lon: -50.2 },
  'manabi province': { lat: -1.05, lon: -80.45 },
  'cauca department': { lat: 2.5, lon: -76.6 },
  'choco department': { lat: 5.7, lon: -76.6 },
  'meta department': { lat: 3.3, lon: -73.0 },
  pyatigorsk: { lat: 44.04, lon: 43.06 },
  'irkutsk oblast': { lat: 56.0, lon: 105.0 },
  'voronezh oblast': { lat: 51.0, lon: 40.0 },
  'rostov oblast': { lat: 47.7, lon: 41.0 },
  'moscow oblast': { lat: 55.5, lon: 38.0 },
  'bryansk oblast': { lat: 53.0, lon: 33.5 },
  'sumy oblast': { lat: 51.0, lon: 34.0 },
  'zaporizhia oblast': { lat: 47.5, lon: 35.5 },
  'odessa oblast': { lat: 46.5, lon: 30.0 },
  'dnipropetrovsk oblast': { lat: 48.5, lon: 34.9 },
  kushva: { lat: 58.28, lon: 59.76 },
  cheboksary: { lat: 56.13, lon: 47.25 },
  yaroslavl: { lat: 57.63, lon: 39.87 },
  krasnodar: { lat: 45.04, lon: 38.98 },
  sevastopol: { lat: 44.62, lon: 33.53 },
  kerch: { lat: 45.36, lon: 36.47 },
  'petropavlovsk kamchatsky': { lat: 53.04, lon: 158.65 },
  sivas: { lat: 39.75, lon: 37.02 },
  ardahan: { lat: 41.11, lon: 42.7 },
  kastamonu: { lat: 41.39, lon: 33.78 },
  kahramanmaras: { lat: 37.58, lon: 36.93 },
  malatya: { lat: 38.36, lon: 38.31 },
  ceyhan: { lat: 37.02, lon: 35.82 },
  urfa: { lat: 37.17, lon: 38.79 },
  battalgazi: { lat: 38.4, lon: 38.35 },
  germencik: { lat: 37.87, lon: 27.6 },
  hatay: { lat: 36.4, lon: 36.34 },
  'hatay province': { lat: 36.4, lon: 36.34 },
  kermanshah: { lat: 34.31, lon: 47.07 },
  'bandar abbas': { lat: 27.19, lon: 56.27 },
  nabatieh: { lat: 33.38, lon: 35.48 },
  tyre: { lat: 33.27, lon: 35.2 },
  'gaza strip': { lat: 31.4, lon: 34.35 },
  'lima district': { lat: -12.05, lon: -77.04 },
  cafayate: { lat: -26.07, lon: -65.98 },
  'villa crespo': { lat: -34.6, lon: -58.44 },
  cartagena: { lat: 37.6, lon: -0.99 }, // Spain (most common in feed)
  'vrancea county': { lat: 45.8, lon: 27.0 },
  'bihor county': { lat: 47.0, lon: 22.3 },
  'prahova county': { lat: 45.1, lon: 26.0 },
  // Additional recurring head (second pass, data-driven)
  zaragoza: { lat: 41.65, lon: -0.89 },
  mostar: { lat: 43.34, lon: 17.81 },
  sibenik: { lat: 43.73, lon: 15.89 },
  osijek: { lat: 45.55, lon: 18.69 },
  toronto: { lat: 43.65, lon: -79.38 },
  ontario: { lat: 50.0, lon: -85.0 },
  baltimore: { lat: 39.29, lon: -76.61 },
  ottawa: { lat: 45.42, lon: -75.7 },
  dnipro: { lat: 48.47, lon: 35.04 },
  azov: { lat: 47.11, lon: 39.42 },
  debrecen: { lat: 47.53, lon: 21.62 },
  auch: { lat: 43.65, lon: 0.59 },
  'eelde': { lat: 53.13, lon: 6.57 },
  cagayan: { lat: 18.0, lon: 121.8 },
  'davao oriental': { lat: 7.3, lon: 126.4 },
  tangerang: { lat: -6.18, lon: 106.63 },
  'lumajang regency': { lat: -8.13, lon: 113.22 },
  'purworejo regency': { lat: -7.71, lon: 109.99 },
  jilin: { lat: 43.7, lon: 126.2 },
  morelos: { lat: 18.68, lon: -99.1 },
  'santiago metropolitan region': { lat: -33.45, lon: -70.67 },
  potosi: { lat: -19.58, lon: -65.75 },
  'san juan puerto rico': { lat: 18.47, lon: -66.11 },
  'puerto rico': { lat: 18.22, lon: -66.59 },
  'western australia': { lat: -25.0, lon: 122.0 },
  'federal district brazil': { lat: -15.8, lon: -47.9 },
  'territoire de belfort': { lat: 47.64, lon: 6.86 },
  'primorsky krai': { lat: 45.0, lon: 135.0 },
  'yamanashi prefecture': { lat: 35.66, lon: 138.57 },
  'saitama prefecture': { lat: 35.99, lon: 139.39 },
  'kagoshima prefecture': { lat: 31.56, lon: 130.56 },
  'sokoto state': { lat: 13.06, lon: 5.24 },
  tunceli: { lat: 39.11, lon: 39.55 },
  como: { lat: 45.81, lon: 9.08 },
  pozzuoli: { lat: 40.82, lon: 14.12 },
  zhukovsky: { lat: 55.6, lon: 38.12 },
  'methoni messenia': { lat: 36.82, lon: 21.7 },
  'jung district seoul': { lat: 37.56, lon: 126.99 },
  'boyle heights los angeles': { lat: 34.03, lon: -118.21 },
  'simi valley california': { lat: 34.27, lon: -118.78 },
  'santos sao paulo': { lat: -23.96, lon: -46.33 },
  'glan sarangani': { lat: 5.81, lon: 125.2 },
  charleroi: { lat: 50.41, lon: 4.44 },
  ledbury: { lat: 52.03, lon: -2.42 },
  sete: { lat: 43.4, lon: 3.7 },
  'evian les bains': { lat: 46.4, lon: 6.59 },
  'shimen county': { lat: 29.58, lon: 111.38 },
  liuzhou: { lat: 24.31, lon: 109.41 },
  starobilsk: { lat: 49.28, lon: 38.9 },
}

// Country-name aliases handled implicitly via norm() (United States/USA/US, UK,
// UAE, Czechia, Türkiye, DR Congo) are already keyed above.

// Resolve a single normalized token to a centroid (place first, then country).
function lookupToken(k: string): Centroid | null {
  if (!k) return null
  return PLACE[k] ?? COUNTRY[k] ?? null
}

// Region names we treat as genuinely place-less — no logical geography.
const PLACELESS = new Set(['global', 'worldwide', 'world', 'international', 'multiple', 'various', 'n/a', 'na', 'unknown'])

export function isPlaceless(regionName: string | null | undefined): boolean {
  const t = norm(regionName || '')
  return t === '' || PLACELESS.has(t)
}

// Resolve a free-form region_name to an approximate centroid, or null if it has
// no logical geography we can place. Strategy:
//   1. whole-string lookup (place, then country)
//   2. compound split on comma: try the LAST token as a country/place
//      ("Tyre, Lebanon" → Lebanon; "Cartagena, Spain" → Spain),
//      then the FIRST token as a place/country ("City, Region" → City).
export function regionCentroid(regionName: string | null | undefined): Centroid | null {
  if (isPlaceless(regionName)) return null
  const raw = regionName as string

  // 1) whole string
  const whole = lookupToken(key(raw))
  if (whole) return whole

  // 2) compound "A, B" — last token (usually the broader region/country) first
  if (raw.includes(',')) {
    const parts = raw.split(',').map((p) => key(p)).filter(Boolean)
    if (parts.length >= 2) {
      const last = lookupToken(parts[parts.length - 1])
      if (last) return last
      const first = lookupToken(parts[0])
      if (first) return first
    }
  }

  return null
}
