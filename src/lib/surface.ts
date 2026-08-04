/**
 * SURFACE RESOLUTION (hub-047)
 * ----------------------------------------------------------------------------
 * One Vercel project, one Next.js app, TWO domains:
 *
 *   community.wfmlabs.com   → surface 'community'  (the platform, unchanged)
 *   travelrisk.wfmlabs.com  → surface 'travelrisk' (travel-first presentation)
 *
 * `travelrisk` is NOT a fork. It is the same application, the same `ovix-api`
 * endpoints and the same components, arranged differently. A fork would mean
 * every fix lands twice and the two drift within weeks (01-Source/
 * TRAVELRISK-SITE-SPEC.md §1). So the ONLY thing the host decides is
 * presentation: ordering, emphasis, nav, and which landing route `/` resolves
 * to. It never decides data, scoring, declare logic, or the canonical
 * 12-domain taxonomy.
 *
 * This module is deliberately PURE (no `next/headers`, no `next/server`) so it
 * can be imported from middleware (edge), server components, and client
 * components alike. The header-reading helper lives in `surface.server.ts`.
 */

export type Surface = 'community' | 'travelrisk'

/** Request header the middleware stamps so server components can read the surface. */
export const SURFACE_HEADER = 'x-wfm-surface'

/** Internal route the travel-first landing lives at. Also directly reachable on
 *  community/preview hosts, which is how a Vercel preview deploy (a *.vercel.app
 *  host that cannot match on domain) gets verified before the domain is added. */
export const TRAVELRISK_LANDING_PATH = '/travelrisk'

/**
 * Hosts that resolve to the travel-first surface. Overridable via env so a
 * preview alias or a future domain needs no code change:
 *   TRAVELRISK_HOSTS="travelrisk.wfmlabs.com,travelrisk-staging.wfmlabs.com"
 */
export function travelriskHosts(env: Record<string, string | undefined> = {}): string[] {
  const raw = env.TRAVELRISK_HOSTS || 'travelrisk.wfmlabs.com'
  return raw
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
}

/** Normalise a Host header: strip port, lowercase. Returns '' when absent. */
export function normalizeHost(host: string | null | undefined): string {
  if (!host) return ''
  return host.split(':')[0].trim().toLowerCase()
}

/**
 * Resolve a Host header to a surface. Anything that is not an explicitly
 * configured travelrisk host is 'community' — the safe default, so a
 * misconfiguration can never take community.wfmlabs.com off its own landing.
 */
export function surfaceForHost(
  host: string | null | undefined,
  env: Record<string, string | undefined> = {},
): Surface {
  const h = normalizeHost(host)
  return h && travelriskHosts(env).includes(h) ? 'travelrisk' : 'community'
}

/** Parse a stamped header value back to a Surface (defaults to community). */
export function parseSurface(value: string | null | undefined): Surface {
  return value === 'travelrisk' ? 'travelrisk' : 'community'
}

// ── Per-surface presentation config ────────────────────────────────────────
// Everything here is chrome. Nothing here changes a number.

export interface SurfaceChrome {
  brand: string
  /** Short mark shown in the nav square. */
  mark: string
  homeHref: string
  title: string
  titleTemplate: string
  description: string
  navLinks: { href: string; label: string }[]
}

const COMMUNITY_NAV = [
  { href: '/roc', label: 'ROC' },
  { href: '/incidents', label: 'Incidents' },
  { href: '/briefs', label: 'Briefs' },
  { href: '/signals', label: 'Signals' },
  { href: '/tools', label: 'Tools' },
  { href: '/research', label: 'Research' },
  { href: '/chat', label: 'Chat' },
  { href: '/data-sources', label: 'APIs' },
  { href: '/members', label: 'Members' },
  { href: '/discussions', label: 'Discussions' },
  { href: '/wiki', label: 'Docs' },
]

// Travel-first nav. Same destinations, different emphasis and order — no page
// on this list is unique to travelrisk. The board anchor is the travel-first
// domain board on the landing itself.
//
// ── hub-051 items 4 + 5 ───────────────────────────────────────────────────
// `/research` is GONE from this list (Ted, 2026-08-01: "Remove displaying
// research, not appropriate here"). Removed from the TRAVELRISK nav ONLY —
// COMMUNITY_NAV above still carries it, the page itself is untouched, and
// community.wfmlabs.com renders exactly what it rendered before. Demotion is
// not deletion.
//
// `/travelrisk/risk` is new: the index of the twelve per-domain risk maps.
//
// RECOMMENDED, NOT CUT — flagged for Ted rather than removed unilaterally:
//   · `/roc` — the OpenMCT operations centre, 13 dashboards about the
//     platform's own monitoring. It is an instrument panel for a different
//     job than "is my traveller's flight at risk". RECOMMEND demoting it to a
//     footer link on this surface.
//   · `/briefs` — Compass briefs are workforce-management framed rather than
//     flight-impact framed. RECOMMEND keeping: they are the only narrative on
//     the surface, and the fix is brief framing (AGENTS fleet), not nav.
//   · `/data-sources` — KEEP. On a surface whose entire argument is
//     traceability, the page naming where the data comes from is load-bearing.
const TRAVELRISK_NAV = [
  { href: '/travelrisk#board', label: 'Risk Board' },
  { href: '/travelrisk/risk', label: 'Risk Maps' },
  { href: '/incidents', label: 'Incidents' },
  { href: '/signals', label: 'Signals' },
  { href: '/briefs', label: 'Briefs' },
  { href: '/roc', label: 'ROC' },
  { href: '/data-sources', label: 'APIs' },
  { href: '/about', label: 'About' },
]

export const SURFACE_CHROME: Record<Surface, SurfaceChrome> = {
  community: {
    brand: 'WFM Labs',
    mark: 'W',
    homeHref: '/',
    title: 'WFM Labs Hub',
    titleTemplate: '%s | WFM Labs Hub',
    description:
      'The practitioner workspace for workforce management professionals. Research, tools, and community.',
    navLinks: COMMUNITY_NAV,
  },
  travelrisk: {
    brand: 'Travel Risk',
    mark: 'T',
    homeHref: '/',
    title: 'Travel Risk — WFM Labs',
    titleTemplate: '%s | Travel Risk',
    description:
      'Operational risk for travel, ranked by flight impact. Live from the same monitored 12-domain plane that powers WFM Labs.',
    navLinks: TRAVELRISK_NAV,
  },
}
