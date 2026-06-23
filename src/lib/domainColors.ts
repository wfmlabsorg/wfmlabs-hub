// Canonical signal/domain color map for WFM Labs (hub-017).
//
// SINGLE SOURCE OF TRUTH for domain dot/badge colors across the whole Hub:
//   - the native Signal Globe (globeShared.signalColor → here)
//   - the Signals page (/signals) filter chips + cards
//   - the landing page (/) Live Incident domain badges
//
// Mission Control palette: dark-theme-bright, visually DISTINCT per domain.
// NO ORANGE (#f97316) anywhere — that hue is reserved out of the Mission
// Control spec. Severity (SEV1–4, extreme/severe) lives elsewhere and is NOT a
// domain color — do not confuse the two systems.

export const DOMAIN_COLORS: Record<string, string> = {
  weather: '#3b82f6', // blue
  seismic: '#f43f5e', // rose
  disaster: '#ef4444', // red
  cyber: '#22c55e', // green
  financial: '#eab308', // yellow / gold
  health: '#ec4899', // pink
  infrastructure: '#8b5cf6', // violet
  environmental: '#14b8a6', // teal
  geopolitical: '#a855f7', // purple
  travel: '#38bdf8', // sky
  labor: '#6366f1', // indigo
  supply_chain: '#2dd4bf', // mint
  general: '#64748b', // slate
  events: '#64748b', // slate (alias of general)
}

// Fallback for any unknown / null category — the Mission Control cyan accent.
export const DOMAIN_COLOR_DEFAULT = '#22d3ee'

// Resolve a domain/category string to its canonical dot color.
export function domainColor(domain: string | null | undefined): string {
  return DOMAIN_COLORS[(domain || '').toLowerCase()] || DOMAIN_COLOR_DEFAULT
}

// Badge styling tokens (subtle bg, bright fg, medium border) derived from the
// canonical color. Used for domain chips on cards. 8-digit hex = #RRGGBBAA.
export function domainBadge(domain: string | null | undefined): {
  bg: string
  fg: string
  border: string
} {
  const c = domainColor(domain)
  return { bg: `${c}14`, fg: c, border: `${c}66` }
}

// Human-readable domain label, e.g. "supply_chain" → "Supply Chain".
export function domainLabel(domain: string | null | undefined): string {
  return (domain || 'general').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
