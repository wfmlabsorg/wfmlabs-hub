import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'

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
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })

  if (!user) {
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
      author: user.id,
      body: textToLexical(body),
      isResolved: false,
      reactionCount: 0,
    },
    overrideAccess: true,
  })

  return Response.json({ discussion }, { status: 201 })
}
