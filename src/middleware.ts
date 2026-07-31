import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  SURFACE_HEADER,
  TRAVELRISK_LANDING_PATH,
  surfaceForHost,
} from '@/lib/surface'

/**
 * Access gating + surface resolution middleware.
 *
 * 1. SURFACE (hub-047). One Vercel project, one Next.js app, two domains.
 *    `travelrisk.wfmlabs.com` resolves here: we stamp `x-wfm-surface` on the
 *    request so every Server Component can select presentation, and we rewrite
 *    that host's `/` onto the travel-first landing route. It is a REWRITE, not
 *    a redirect — the URL stays `travelrisk.wfmlabs.com/`, and every other path
 *    (/incidents, /signals, /roc …) is the same page it always was, wearing
 *    travel chrome. community.wfmlabs.com never enters this branch: any host
 *    that is not explicitly configured resolves to 'community'.
 *
 * 2. ACCESS. Cookie presence check (not JWT verification) for speed. The actual
 *    auth verification happens in the page/API handlers.
 */

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/about',
  // Travel-first landing — public like `/`, and directly reachable on every
  // host so a Vercel PREVIEW deploy (a *.vercel.app host that cannot match on
  // domain) can be verified before the custom domain is added.
  TRAVELRISK_LANDING_PATH,
]

const PUBLIC_PREFIXES = [
  '/api/',
  '/roc/',
  '/incidents',
  '/_next/',
  '/favicon',
  '/admin',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 1. Resolve the surface from the Host header ──
  const surface = surfaceForHost(
    request.headers.get('host'),
    process.env as Record<string, string | undefined>,
  )
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(SURFACE_HEADER, surface)
  const pass = () => NextResponse.next({ request: { headers: requestHeaders } })

  // Travel domain root → the travel-first landing, rewritten in place.
  if (surface === 'travelrisk' && pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = TRAVELRISK_LANDING_PATH
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } })
  }

  // ── 2. Access gating (unchanged) ──

  // Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) return pass()

  // Allow public prefixes (API routes handle their own auth)
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return pass()

  // Public: individual signal detail deep-links (/signals/{id}) — e.g. from the OVIX globe —
  // while the aggregate /signals feed list stays members-only.
  if (/^\/signals\/[^/]+$/.test(pathname)) return pass()

  // Allow static assets
  if (pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|map|html|json)$/)) return pass()

  // Check for auth cookie presence
  // NextAuth v5 uses __Secure-authjs.session-token (production) or authjs.session-token (dev)
  const hasSession =
    request.cookies.has('__Secure-authjs.session-token') ||
    request.cookies.has('authjs.session-token') ||
    request.cookies.has('next-auth.session-token') ||
    request.cookies.has('__Secure-next-auth.session-token')

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return pass()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
