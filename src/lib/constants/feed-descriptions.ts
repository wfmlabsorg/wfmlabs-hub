/**
 * Static lookup of data source descriptions for the OVIX feed detail pages.
 * Maps feed source IDs (from the ROC Worker API) to structured metadata
 * including summary text, operator, license, registration, and cost details.
 */

export interface FeedDescription {
  /** 2-3 sentence summary of what this API/data source is and does */
  summary: string
  /** Organization that operates the API */
  operator: string
  /** License / openness: 'Open' | 'Free' | 'Freemium' | 'Paid' */
  license: 'Open' | 'Free' | 'Freemium' | 'Paid'
  /** Whether registration or an API key is needed */
  registration: 'None' | 'Required' | 'Optional'
  /** Cost details */
  cost: string
}

export const FEED_DESCRIPTIONS: Record<string, FeedDescription> = {
  'nws': {
    summary:
      'The National Weather Service (NWS) API provides real-time severe weather alerts for the United States and its territories. It publishes watches, warnings, and advisories for hazards including tornadoes, hurricanes, floods, and winter storms. The API follows the Common Alerting Protocol (CAP) standard and is part of the U.S. government open data initiative.',
    operator: 'NOAA / National Weather Service (U.S. Dept. of Commerce)',
    license: 'Open',
    registration: 'None',
    cost: 'Free — U.S. government public data',
  },
  'meteoalarm': {
    summary:
      'MeteoAlarm aggregates severe weather warnings from 38 European national meteorological services into a single feed. It covers the full range of weather hazards — wind, rain, snow, fog, extreme temperatures, and coastal events — with standardized severity levels. The service is coordinated by EUMETNET, an intergovernmental network of European weather agencies.',
    operator: 'EUMETNET (European Meteorological Services Network)',
    license: 'Open',
    registration: 'None',
    cost: 'Free — publicly funded European meteorological collaboration',
  },
  'spc': {
    summary:
      'The Storm Prediction Center (SPC) issues real-time watches and warnings for severe convective weather across the contiguous United States. This feed filters NWS alerts specifically for tornado warnings, severe thunderstorm warnings, and related SPC mesoscale discussions. SPC is a national center within NOAA responsible for severe weather forecasting.',
    operator: 'NOAA / Storm Prediction Center',
    license: 'Open',
    registration: 'None',
    cost: 'Free — U.S. government public data',
  },
  'spc_reports': {
    summary:
      'SPC Confirmed Storm Reports is a historical archive of verified severe weather events including tornadoes, large hail, and damaging winds. Reports are filed by trained spotters, emergency managers, and NWS survey teams and published daily. This data is foundational for severe weather climatology and post-event analysis.',
    operator: 'NOAA / Storm Prediction Center',
    license: 'Open',
    registration: 'None',
    cost: 'Free — U.S. government public data',
  },
  'usgs': {
    summary:
      'The USGS Earthquake Hazards Program provides near-real-time earthquake data worldwide via GeoJSON feeds. It reports magnitude, location, depth, and tsunami potential for seismic events detected by global sensor networks. The USGS is the authoritative source for earthquake information in the United States and a primary contributor to global seismic monitoring.',
    operator: 'U.S. Geological Survey (Dept. of the Interior)',
    license: 'Open',
    registration: 'None',
    cost: 'Free — U.S. government public data',
  },
  'emsc': {
    summary:
      'The Euro-Mediterranean Seismological Centre (EMSC) provides rapid earthquake notifications for the Euro-Mediterranean region and worldwide. Its Seismic Portal API follows the FDSN standard and includes felt reports from citizens alongside instrumental data. EMSC is a non-profit intergovernmental organization supported by 84 seismological institutes across 55 countries.',
    operator: 'EMSC (Euro-Mediterranean Seismological Centre)',
    license: 'Open',
    registration: 'None',
    cost: 'Free — publicly funded scientific infrastructure',
  },
  'gdacs': {
    summary:
      'The Global Disaster Alert and Coordination System (GDACS) provides near-real-time alerts for major natural disasters worldwide — earthquakes, tsunamis, floods, tropical cyclones, and volcanic eruptions. Alerts include estimated humanitarian impact scores to help prioritize international response. GDACS is a joint initiative of the United Nations and the European Commission.',
    operator: 'UN Office for the Coordination of Humanitarian Affairs / EC Joint Research Centre',
    license: 'Open',
    registration: 'None',
    cost: 'Free — UN/EU public service',
  },
  'eonet': {
    summary:
      'NASA Earth Observatory Natural Event Tracker (EONET) catalogs ongoing natural events — wildfires, severe storms, volcanic eruptions, sea ice changes, and floods — with satellite imagery links. Events are curated by NASA analysts and tagged with geographic coordinates and date ranges. EONET bridges satellite observation data with human-readable event tracking.',
    operator: 'NASA Goddard Space Flight Center',
    license: 'Open',
    registration: 'None',
    cost: 'Free — NASA open data policy',
  },
  'reliefweb': {
    summary:
      'ReliefWeb is the leading humanitarian information portal, aggregating disaster declarations, situation reports, and response data from governments, NGOs, and UN agencies. Its API provides structured access to disaster records with metadata on affected countries, hazard types, and response status. It has operated continuously since 1996 as a service of UN OCHA.',
    operator: 'United Nations Office for the Coordination of Humanitarian Affairs (OCHA)',
    license: 'Open',
    registration: 'None',
    cost: 'Free — UN public information service',
  },
  'cisa': {
    summary:
      'The CISA Known Exploited Vulnerabilities (KEV) catalog lists software vulnerabilities that are actively being exploited in the wild. Federal agencies are legally required to remediate KEV entries within specified deadlines under BOD 22-01. The catalog is maintained by CISA (Cybersecurity and Infrastructure Security Agency) within the U.S. Department of Homeland Security.',
    operator: 'CISA (Cybersecurity and Infrastructure Security Agency, DHS)',
    license: 'Open',
    registration: 'None',
    cost: 'Free — U.S. government cybersecurity resource',
  },
  'otx': {
    summary:
      'AlienVault Open Threat Exchange (OTX) is a crowd-sourced threat intelligence platform where security researchers share indicators of compromise (IOCs), malware samples, and threat pulse reports. The API provides access to community-curated threat data including IP reputation, file hashes, and domain intelligence. OTX is one of the largest open threat intelligence communities globally.',
    operator: 'AT&T Cybersecurity (formerly AlienVault)',
    license: 'Free',
    registration: 'Required',
    cost: 'Free tier with API key — premium features via AT&T Cybersecurity products',
  },
  'cisa_advisory': {
    summary:
      'CISA Cybersecurity Advisories publish alerts, analysis reports, and vulnerability bulletins covering critical infrastructure threats. Advisories cover ICS/SCADA vulnerabilities, nation-state activity, ransomware campaigns, and supply chain risks. These are the official U.S. government channel for cybersecurity threat communication to critical infrastructure operators.',
    operator: 'CISA (Cybersecurity and Infrastructure Security Agency, DHS)',
    license: 'Open',
    registration: 'None',
    cost: 'Free — U.S. government cybersecurity resource',
  },
  'ioda': {
    summary:
      'IODA (Internet Outage Detection and Analysis) monitors internet connectivity at country and regional granularity using BGP routing data, active probing, and DNS backscatter. It detects large-scale outages — both government-imposed shutdowns and infrastructure failures — and provides historical time-series data. IODA is an academic research project operated by Georgia Tech.',
    operator: 'Georgia Institute of Technology (Internet Intelligence Lab)',
    license: 'Open',
    registration: 'None',
    cost: 'Free — academic research project',
  },
  'ioda_isp': {
    summary:
      'IODA ISP Health monitors individual autonomous systems (ISPs, cloud providers, enterprises) for connectivity disruptions using the same detection methods as the broader IODA platform. It tracks per-ASN reachability to identify provider-specific outages that may not appear at the country level. This granular view is valuable for supply chain and vendor risk monitoring.',
    operator: 'Georgia Institute of Technology (Internet Intelligence Lab)',
    license: 'Open',
    registration: 'None',
    cost: 'Free — academic research project',
  },
  'power_outage': {
    summary:
      'PowerOutage.us aggregates utility outage data from over 1,000 electric utilities across the United States, providing near-real-time outage counts by state, county, and utility. The data is collected by scraping individual utility outage maps and consolidating them into a single view. It is widely used by emergency managers, media, and researchers during severe weather events.',
    operator: 'PowerOutage.us (independent project)',
    license: 'Free',
    registration: 'None',
    cost: 'Free — community data aggregation project',
  },
  'cloudflare': {
    summary:
      'Cloudflare Radar provides internet traffic insights derived from Cloudflare handling roughly 20% of global web traffic. The disruptions endpoint tracks verified internet outages and anomalies annotated by Cloudflare analysts. Radar data is valuable for detecting cable cuts, government censorship events, and large-scale DDoS attacks in near real-time.',
    operator: 'Cloudflare, Inc.',
    license: 'Free',
    registration: 'Required',
    cost: 'Free — Cloudflare Radar API requires a free Cloudflare account and API token',
  },
  'swpc': {
    summary:
      'NOAA Space Weather Prediction Center (SWPC) monitors solar activity and its effects on Earth including geomagnetic storms, solar flares, and radiation events. The planetary K-index (Kp) measures geomagnetic disturbance intensity on a 0-9 scale. Space weather can disrupt GPS, satellite communications, power grids, and aviation operations.',
    operator: 'NOAA / Space Weather Prediction Center',
    license: 'Open',
    registration: 'None',
    cost: 'Free — U.S. government public data',
  },
  'who': {
    summary:
      'WHO Disease Outbreak News publishes official notifications of infectious disease events with potential international public health significance. Reports cover emerging pathogens, epidemic-prone diseases, and events assessed under the International Health Regulations (IHR). The WHO is the directing authority on international health within the United Nations system.',
    operator: 'World Health Organization (WHO)',
    license: 'Open',
    registration: 'None',
    cost: 'Free — UN public health information',
  },
  'cdc': {
    summary:
      'CDC Respiratory Surveillance tracks influenza-like illness (ILI), COVID-19, and RSV activity across the United States through a network of sentinel providers and public health laboratories. Data is published weekly through the Socrata Open Data API with breakdowns by region, age group, and virus type. This is the primary surveillance system for respiratory disease burden in the U.S.',
    operator: 'Centers for Disease Control and Prevention (CDC)',
    license: 'Open',
    registration: 'Optional',
    cost: 'Free — U.S. government public health data; app token optional but recommended for higher rate limits',
  },
  'fred': {
    summary:
      'FRED (Federal Reserve Economic Data) hosts over 800,000 economic time series from 100+ sources including GDP, unemployment, inflation, interest rates, and trade data. The API provides programmatic access to current and historical observations with flexible date ranges and transformations. FRED is maintained by the Research Division of the Federal Reserve Bank of St. Louis.',
    operator: 'Federal Reserve Bank of St. Louis',
    license: 'Open',
    registration: 'Required',
    cost: 'Free — requires a free API key from the FRED website',
  },
  'gdelt': {
    summary:
      'The GDELT Project monitors print, broadcast, and web news from nearly every country in over 100 languages, translating and processing them into structured event records in near real-time. Its DOC 2.0 API supports full-text search, geographic filtering, and sentiment analysis across billions of articles. GDELT is one of the largest open datasets of human society ever created.',
    operator: 'GDELT Project (supported by Google Jigsaw)',
    license: 'Open',
    registration: 'None',
    cost: 'Free — open research dataset',
  },
  'firms': {
    summary:
      'NASA FIRMS — satellite wildfire detection via VIIRS SNPP. Currently non-operational: MAP_KEY requires annual renewal at firms.modaps.eosdis.nasa.gov. Wildfires tracked via EONET as fallback.',
    operator: 'NASA LANCE / EOSDIS',
    license: 'Open',
    registration: 'Required',
    cost: 'Free — requires a free NASA Earthdata account and MAP key',
  },
  'openaq': {
    summary:
      'OpenAQ v3 API — global air quality from ground monitoring stations. Currently non-operational: v3 API requires authenticated API key; key may need renewal at openaq.org. Being supplemented by Open-Meteo Air Quality.',
    operator: 'OpenAQ (501(c)(3) non-profit)',
    license: 'Open',
    registration: 'Required',
    cost: 'Free — requires a free API key; rate-limited',
  },
  'open_meteo_aq': {
    summary:
      'Open-Meteo Air Quality API — global AQ data from Copernicus CAMS atmospheric model. Provides US AQI, PM2.5, PM10, NO2, Ozone, and UV Index for any coordinate. Free, no API key required. Covers all 38 OVIX sub-regions.',
    operator: 'Open-Meteo',
    license: 'Open',
    registration: 'None',
    cost: 'Free — no API key required; fair-use rate limits',
  },
  'tsunami': {
    summary:
      'The NOAA Tsunami Warning System issues watches, advisories, and warnings for tsunami threats across the Pacific and Atlantic ocean basins. Alerts are generated from seismic data, deep-ocean pressure sensors (DART buoys), and coastal tide gauges. The system is operated by two centers — the National Tsunami Warning Center (Alaska) and the Pacific Tsunami Warning Center (Hawaii).',
    operator: 'NOAA / National Tsunami Warning Center',
    license: 'Open',
    registration: 'None',
    cost: 'Free — U.S. government public safety data',
  },
  'smithsonian': {
    summary:
      'The Smithsonian Global Volcanism Program (GVP) maintains the authoritative database of Earth\'s volcanic activity, tracking eruptions and unrest at over 1,400 Holocene volcanoes. The weekly volcanic activity report RSS feed provides curated updates from volcanological observatories worldwide. GVP has documented volcanic activity since 1968 and its records are the global reference standard.',
    operator: 'Smithsonian Institution / National Museum of Natural History',
    license: 'Open',
    registration: 'None',
    cost: 'Free — Smithsonian public research data',
  },
  'aviation': {
    summary:
      'The Aviation Weather Center API provides METAR (Meteorological Aerodrome Report) observations from thousands of airports and weather stations worldwide. METARs include wind speed/direction, visibility, cloud cover, temperature, dewpoint, and barometric pressure updated at least hourly. This data is critical for flight planning and is the standard format used by aviation authorities globally.',
    operator: 'FAA / NOAA Aviation Weather Center',
    license: 'Open',
    registration: 'None',
    cost: 'Free — U.S. government aviation safety data',
  },
}
