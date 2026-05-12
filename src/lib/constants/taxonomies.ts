/**
 * Shared taxonomies for Members collection and frontend components.
 * Used by both Payload collection config (select options) and React UI.
 */

export const INDUSTRIES = [
  { label: 'Finance', value: 'finance' },
  { label: 'Insurance', value: 'insurance' },
  { label: 'Healthcare', value: 'healthcare' },
  { label: 'Telecom', value: 'telecom' },
  { label: 'Retail', value: 'retail' },
  { label: 'Technology', value: 'technology' },
  { label: 'Government', value: 'government' },
  { label: 'Energy / Utilities', value: 'energy-utilities' },
  { label: 'Transportation / Logistics', value: 'transportation-logistics' },
  { label: 'Manufacturing', value: 'manufacturing' },
  { label: 'Education', value: 'education' },
  { label: 'Media / Entertainment', value: 'media-entertainment' },
  { label: 'Hospitality / Travel', value: 'hospitality-travel' },
  { label: 'Other', value: 'other' },
] as const

export const WORKFORCE_TYPES = [
  { label: 'Contact Center', value: 'contact-center' },
  { label: 'Back Office', value: 'back-office' },
  { label: 'Field Service', value: 'field-service' },
  { label: 'Consultant / Advisory', value: 'consultant-advisory' },
  { label: 'Other', value: 'other' },
] as const

export const SOURCING_TYPES = [
  { label: 'In-house', value: 'in-house' },
  { label: 'BPO Vendor', value: 'bpo-vendor' },
] as const

export const FOOTPRINT_WORKFORCE_TYPES = [
  { label: 'Contact Center', value: 'contact-center' },
  { label: 'Back Office', value: 'back-office' },
  { label: 'Other', value: 'other' },
] as const

/** Countries commonly associated with contact center / BPO operations */
export const FOOTPRINT_COUNTRIES = [
  { label: 'United States', value: 'US' },
  { label: 'Canada', value: 'CA' },
  { label: 'Mexico', value: 'MX' },
  { label: 'Costa Rica', value: 'CR' },
  { label: 'Guatemala', value: 'GT' },
  { label: 'Honduras', value: 'HN' },
  { label: 'El Salvador', value: 'SV' },
  { label: 'Panama', value: 'PA' },
  { label: 'Colombia', value: 'CO' },
  { label: 'Brazil', value: 'BR' },
  { label: 'Argentina', value: 'AR' },
  { label: 'Peru', value: 'PE' },
  { label: 'Chile', value: 'CL' },
  { label: 'Uruguay', value: 'UY' },
  { label: 'Jamaica', value: 'JM' },
  { label: 'Dominican Republic', value: 'DO' },
  { label: 'Trinidad & Tobago', value: 'TT' },
  { label: 'United Kingdom', value: 'GB' },
  { label: 'Ireland', value: 'IE' },
  { label: 'France', value: 'FR' },
  { label: 'Germany', value: 'DE' },
  { label: 'Netherlands', value: 'NL' },
  { label: 'Belgium', value: 'BE' },
  { label: 'Spain', value: 'ES' },
  { label: 'Portugal', value: 'PT' },
  { label: 'Italy', value: 'IT' },
  { label: 'Poland', value: 'PL' },
  { label: 'Romania', value: 'RO' },
  { label: 'Bulgaria', value: 'BG' },
  { label: 'Turkey', value: 'TR' },
  { label: 'South Africa', value: 'ZA' },
  { label: 'Egypt', value: 'EG' },
  { label: 'Morocco', value: 'MA' },
  { label: 'India', value: 'IN' },
  { label: 'Philippines', value: 'PH' },
  { label: 'Malaysia', value: 'MY' },
  { label: 'Singapore', value: 'SG' },
  { label: 'Thailand', value: 'TH' },
  { label: 'Japan', value: 'JP' },
  { label: 'South Korea', value: 'KR' },
  { label: 'China', value: 'CN' },
  { label: 'Australia', value: 'AU' },
  { label: 'New Zealand', value: 'NZ' },
  { label: 'Other', value: 'OTHER' },
] as const

export const CUSTOMER_GEO_SCOPES = [
  { label: 'Single State', value: 'single-state' },
  { label: 'Regional US', value: 'regional-us' },
  { label: 'National US', value: 'national-us' },
  { label: 'US + Canada / Mexico', value: 'us-plus-neighbors' },
  { label: 'EU', value: 'eu' },
  { label: 'International', value: 'international' },
] as const

export const US_REGIONS = [
  { label: 'Northeast', value: 'northeast' },
  { label: 'Southeast', value: 'southeast' },
  { label: 'Midwest', value: 'midwest' },
  { label: 'Southwest', value: 'southwest' },
  { label: 'West Coast', value: 'west-coast' },
] as const

export const US_STATES = [
  { label: 'Alabama', value: 'AL' },
  { label: 'Alaska', value: 'AK' },
  { label: 'Arizona', value: 'AZ' },
  { label: 'Arkansas', value: 'AR' },
  { label: 'California', value: 'CA' },
  { label: 'Colorado', value: 'CO' },
  { label: 'Connecticut', value: 'CT' },
  { label: 'Delaware', value: 'DE' },
  { label: 'Florida', value: 'FL' },
  { label: 'Georgia', value: 'GA' },
  { label: 'Hawaii', value: 'HI' },
  { label: 'Idaho', value: 'ID' },
  { label: 'Illinois', value: 'IL' },
  { label: 'Indiana', value: 'IN' },
  { label: 'Iowa', value: 'IA' },
  { label: 'Kansas', value: 'KS' },
  { label: 'Kentucky', value: 'KY' },
  { label: 'Louisiana', value: 'LA' },
  { label: 'Maine', value: 'ME' },
  { label: 'Maryland', value: 'MD' },
  { label: 'Massachusetts', value: 'MA' },
  { label: 'Michigan', value: 'MI' },
  { label: 'Minnesota', value: 'MN' },
  { label: 'Mississippi', value: 'MS' },
  { label: 'Missouri', value: 'MO' },
  { label: 'Montana', value: 'MT' },
  { label: 'Nebraska', value: 'NE' },
  { label: 'Nevada', value: 'NV' },
  { label: 'New Hampshire', value: 'NH' },
  { label: 'New Jersey', value: 'NJ' },
  { label: 'New Mexico', value: 'NM' },
  { label: 'New York', value: 'NY' },
  { label: 'North Carolina', value: 'NC' },
  { label: 'North Dakota', value: 'ND' },
  { label: 'Ohio', value: 'OH' },
  { label: 'Oklahoma', value: 'OK' },
  { label: 'Oregon', value: 'OR' },
  { label: 'Pennsylvania', value: 'PA' },
  { label: 'Rhode Island', value: 'RI' },
  { label: 'South Carolina', value: 'SC' },
  { label: 'South Dakota', value: 'SD' },
  { label: 'Tennessee', value: 'TN' },
  { label: 'Texas', value: 'TX' },
  { label: 'Utah', value: 'UT' },
  { label: 'Vermont', value: 'VT' },
  { label: 'Virginia', value: 'VA' },
  { label: 'Washington', value: 'WA' },
  { label: 'West Virginia', value: 'WV' },
  { label: 'Wisconsin', value: 'WI' },
  { label: 'Wyoming', value: 'WY' },
  { label: 'District of Columbia', value: 'DC' },
  { label: 'Puerto Rico', value: 'PR' },
] as const

/** Helper to get valid values for runtime validation */
export const INDUSTRY_VALUES = INDUSTRIES.map((i) => i.value)
export const WORKFORCE_TYPE_VALUES = WORKFORCE_TYPES.map((w) => w.value)
export const CUSTOMER_GEO_SCOPE_VALUES = CUSTOMER_GEO_SCOPES.map((g) => g.value)
