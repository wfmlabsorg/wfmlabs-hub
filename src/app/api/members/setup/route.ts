import { getPayload } from 'payload'
import config from '@payload-config'
import { auth } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const payload = await getPayload({ config })

    // Try Payload JWT from cookie first (same pattern as discussions route)
    let memberId: string | number | null = null
    const cookieHeader = req.headers.get('cookie') || ''
    const tokenMatch = cookieHeader.match(/payload-token=([^;]+)/)

    if (tokenMatch) {
      try {
        const authHeaders = new Headers()
        authHeaders.set('Authorization', `JWT ${tokenMatch[1]}`)
        const { user } = await payload.auth({ headers: authHeaders })
        if (user) memberId = user.id
      } catch {
        // Fall through to NextAuth
      }
    }

    // Try NextAuth session
    if (!memberId) {
      const session = await auth()
      if (session?.user?.payloadMemberId) {
        memberId = session.user.payloadMemberId
      }
    }

    if (!memberId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { displayName, username, title, company, bio, location, linkedinUrl, githubUsername, websiteUrl } = body

    // Validate required fields
    if (!displayName || !username) {
      return Response.json({ error: 'Display name and username are required' }, { status: 400 })
    }

    // Validate username format
    if (!/^[a-z0-9-]{3,30}$/.test(username)) {
      return Response.json(
        { error: 'Username must be 3-30 characters, lowercase letters, numbers, and hyphens only' },
        { status: 400 },
      )
    }

    // Check username uniqueness (exclude current user)
    const existing = await payload.find({
      collection: 'members',
      where: {
        and: [
          { username: { equals: username } },
          { id: { not_equals: Number(memberId) } },
        ],
      },
      limit: 1,
      overrideAccess: true,
    })

    if (existing.docs.length > 0) {
      return Response.json({ error: 'Username is already taken' }, { status: 409 })
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      displayName,
      username,
      bio: bio || undefined,
      profile: {
        title: title || undefined,
        company: company || undefined,
        location: location || undefined,
        linkedinUrl: linkedinUrl || undefined,
        githubUsername: githubUsername || undefined,
        websiteUrl: websiteUrl || undefined,
      },
    }

    const updated = await payload.update({
      collection: 'members',
      id: Number(memberId),
      data: updateData,
      overrideAccess: true,
    })

    return Response.json({ success: true, member: { id: updated.id, username: updated.username } })
  } catch (e) {
    console.error('Member setup error:', e)
    return Response.json({ error: 'Server error', detail: String(e) }, { status: 500 })
  }
}
