import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Access gating middleware.
 *
 * Public routes (no auth required):
 *   /, /pricing, /login, /about, /api/auth/*, /api/signals (GET), /api/beacon, /api/sentinel
 *   /roc/openmct/* (static assets), /_next/*, /favicon*
 *
 * Everything else requires authentication.
 * Authenticated users without active subscription see /subscribe prompt.
 */

const PUBLIC_PATHS = [
  '/',
  '/pricing',
  '/login',
  '/about',
]

const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/api/beacon',
  '/api/sentinel',
  '/api/signals',
  '/roc/openmct/',
  '/_next/',
  '/favicon',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next()

  // Allow public prefixes
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next()

  // Allow static assets
  if (pathname.match(/\.(js|css|png|jpg|svg|ico|woff2?|map)$/)) return NextResponse.next()

  // Check auth
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET })

  if (!token) {
    // Not logged in → redirect to login with return URL
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Logged in — all registered users get full access (trial mode)
  // Subscription enforcement comes with Stripe integration

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
