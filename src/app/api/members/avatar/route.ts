import { getPayload } from 'payload'
import config from '@payload-config'
import { auth } from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const payload = await getPayload({ config })

    // Authenticate
    let memberId: string | number | null = null
    const cookieHeader = req.headers.get('cookie') || ''
    const tokenMatch = cookieHeader.match(/payload-token=([^;]+)/)

    if (tokenMatch) {
      try {
        const authHeaders = new Headers()
        authHeaders.set('Authorization', `JWT ${tokenMatch[1]}`)
        const { user } = await payload.auth({ headers: authHeaders })
        if (user) memberId = user.id
      } catch {}
    }

    if (!memberId) {
      const session = await auth()
      if (session?.user?.payloadMemberId) memberId = session.user.payloadMemberId
    }

    if (!memberId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const contentType = req.headers.get('content-type') || ''

    // JSON body — set avatarUrl or remove avatar
    if (contentType.includes('application/json')) {
      const body = await req.json()

      if (body.action === 'use-oauth' && body.avatarUrl) {
        // Set OAuth avatar URL, clear uploaded avatar
        await payload.update({
          collection: 'members',
          id: Number(memberId),
          data: { avatar: null, avatarUrl: body.avatarUrl } as unknown as Record<string, unknown>,
          overrideAccess: true,
        })
        return Response.json({ success: true, avatarUrl: body.avatarUrl })
      }

      if (body.action === 'remove') {
        // Clear both avatar types
        await payload.update({
          collection: 'members',
          id: Number(memberId),
          data: { avatar: null, avatarUrl: null } as unknown as Record<string, unknown>,
          overrideAccess: true,
        })
        return Response.json({ success: true, avatarUrl: null })
      }

      return Response.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Multipart form — upload image file
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('file') as File | null

      if (!file || !file.type.startsWith('image/')) {
        return Response.json({ error: 'Invalid image file' }, { status: 400 })
      }

      // Upload via Payload media collection
      const media = await payload.create({
        collection: 'media',
        data: {
          alt: `Member ${memberId} avatar`,
        },
        file: {
          data: Buffer.from(await file.arrayBuffer()),
          name: file.name,
          mimetype: file.type,
          size: file.size,
        },
        overrideAccess: true,
      })

      // Link to member, clear avatarUrl (uploaded takes priority)
      await payload.update({
        collection: 'members',
        id: Number(memberId),
        data: { avatar: media.id, avatarUrl: null } as unknown as Record<string, unknown>,
        overrideAccess: true,
      })

      return Response.json({
        success: true,
        mediaId: media.id,
        avatarUrl: (media as unknown as Record<string, unknown>).url || null,
      })
    }

    return Response.json({ error: 'Unsupported content type' }, { status: 400 })
  } catch (e) {
    console.error('Avatar upload error:', e)
    return Response.json({ error: 'Failed to update avatar' }, { status: 500 })
  }
}
