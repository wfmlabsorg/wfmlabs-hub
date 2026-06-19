import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Access gating middleware.
 * Uses cookie presence check (not JWT verification) for speed.
 * The actual auth verification happens in the page/API handlers.
 */

const PUBLIC_PATHS = [
  '/',
  '/pricing',
  '/login',
  '/about',
]

const PUBLIC_PREFIXES = [
  '/api/',
  '/roc/',
  '/incidents',
  '/debates',
  '/_next/',
  '/favicon',
  '/admin',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next()

  // Allow public prefixes (API routes handle their own auth)
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next()

  // Public: individual signal detail deep-links (/signals/{id}) — e.g. from the OVIX globe —
  // while the aggregate /signals feed list stays members-only.
  if (/^\/signals\/[^/]+$/.test(pathname)) return NextResponse.next()

  // Allow static assets
  if (pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff2?|map|html|json)$/)) return NextResponse.next()

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

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
