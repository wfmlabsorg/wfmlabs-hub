import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'

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
  const payload = await getPayload({ config })

  // Try NextAuth session first
  const session = await auth()
  let memberId: string | number | null = null

  if (session?.user?.payloadMemberId) {
    memberId = session.user.payloadMemberId
  } else {
    // Fall back to Payload cookie auth
    const headersList = await headers()
    const { user } = await payload.auth({ headers: headersList })
    if (user) {
      memberId = user.id
    }
  }

  if (!memberId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
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
        value: assetId,
      },
      author: Number(memberId),
      body: textToLexical(body),
      isResolved: false,
      reactionCount: 0,
    },
    overrideAccess: true,
  })

  return Response.json({ discussion }, { status: 201 })
}
