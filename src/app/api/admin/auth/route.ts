import { getPayload } from 'payload'
import config from '@payload-config'
import { auth } from '@/lib/auth'
import { cookies } from 'next/headers'

/**
 * Admin OAuth bridge — generates a Payload JWT for admin users
 * who authenticated via NextAuth (Google/GitHub).
 *
 * GET /api/admin/auth — checks NextAuth session, generates Payload token, redirects to /admin
 */
export async function GET() {
  const session = await auth()

  if (!session?.user?.payloadMemberId) {
    return Response.redirect(new URL('/login?callbackUrl=/api/admin/auth', process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'))
  }

  // Verify admin role
  if (session.user.role !== 'admin') {
    return new Response('Forbidden — admin access required', { status: 403 })
  }

  const payload = await getPayload({ config })

  // Find the member
  const member = await payload.findByID({
    collection: 'members',
    id: Number(session.user.payloadMemberId),
    overrideAccess: true,
  })

  if (!member || (member as unknown as Record<string, unknown>).role !== 'admin') {
    return new Response('Forbidden', { status: 403 })
  }

  // Generate a Payload JWT by setting a temp password, logging in, then randomizing
  try {
    const tempPass = `OAuthAdmin_${crypto.randomUUID()}`

    // Set temporary password
    await payload.update({
      collection: 'members',
      id: member.id,
      data: { password: tempPass } as any,
      overrideAccess: true,
    })

    // Login to get a Payload JWT
    const result = await payload.login({
      collection: 'members',
      data: {
        email: member.email,
        password: tempPass,
      },
    })

    if (result.token) {
      // Set the Payload JWT cookie
      const cookieStore = await cookies()
      cookieStore.set('payload-token', result.token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      })
    }

    // Randomize password so it can never be used directly
    await payload.update({
      collection: 'members',
      id: member.id,
      data: { password: `__oauth_${crypto.randomUUID()}${crypto.randomUUID()}` } as any,
      overrideAccess: true,
    })
  } catch (e) {
    console.error('Admin auth bridge error:', e)
    return new Response('Auth bridge failed', { status: 500 })
  }

  // Redirect to admin panel
  const adminUrl = new URL('/admin', process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000')
  return Response.redirect(adminUrl.toString())
}
