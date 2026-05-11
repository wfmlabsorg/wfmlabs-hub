import { getPayload } from 'payload'
import config from '@payload-config'

function textToLexical(text: string) {
  return {
    root: {
      type: 'root' as const,
      children: text
        .split('\n')
        .filter(Boolean)
        .map((paragraph) => ({
          type: 'paragraph' as const,
          children: [
            {
              type: 'text' as const,
              text: paragraph,
              format: 0,
              detail: 0,
              mode: 'normal' as const,
              style: '',
              version: 1,
            },
          ],
          direction: 'ltr' as const,
          format: '' as const,
          indent: 0,
          version: 1,
        })),
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      version: 1,
    },
  }
}

export async function POST(req: Request) {
  try {
    const payload = await getPayload({ config })

    // Read Payload JWT from cookie in the request
    let memberId: string | number | null = null
    const cookieHeader = req.headers.get('cookie') || ''
    const tokenMatch = cookieHeader.match(/payload-token=([^;]+)/)

    if (tokenMatch) {
      try {
        const authHeaders = new Headers()
        authHeaders.set('Authorization', `JWT ${tokenMatch[1]}`)
        const { user } = await payload.auth({ headers: authHeaders })
        if (user) {
          memberId = user.id
        }
      } catch (e) {
        return Response.json({ error: 'Auth failed', detail: String(e) }, { status: 401 })
      }
    }

    if (!memberId) {
      return Response.json({ error: 'Unauthorized', hasCookie: !!tokenMatch }, { status: 401 })
    }

    const { assetType, assetId, body } = await req.json()

    if (!assetType || !assetId || !body) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const discussion = await payload.create({
      collection: 'discussions',
      data: {
        asset: {
          relationTo: assetType,
          value: Number(assetId),
        },
        author: Number(memberId),
        body: textToLexical(body),
        isResolved: false,
        reactionCount: 0,
      },
      overrideAccess: true,
    })

    return Response.json({ discussion }, { status: 201 })
  } catch (e) {
    return Response.json({ error: 'Server error', detail: String(e) }, { status: 500 })
  }
}
