import { getPayload } from 'payload'
import config from '@payload-config'
import { headers } from 'next/headers'

export async function POST(req: Request) {
  const payload = await getPayload({ config })
  const headersList = await headers()
  const { user } = await payload.auth({ headers: headersList })

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { targetType, targetId, reactionType } = await req.json()

  if (!targetType || !targetId || !reactionType) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Check if reaction already exists
  const existing = await payload.find({
    collection: 'reactions',
    where: {
      'target.relationTo': { equals: targetType },
      'target.value': { equals: targetId },
      member: { equals: user.id },
      type: { equals: reactionType },
    },
    limit: 1,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    // Un-react: delete existing
    await payload.delete({
      collection: 'reactions',
      id: existing.docs[0].id,
      overrideAccess: true,
    })
  } else {
    // Create new reaction
    await payload.create({
      collection: 'reactions',
      data: {
        target: {
          relationTo: targetType,
          value: targetId,
        },
        member: user.id,
        type: reactionType,
      },
      overrideAccess: true,
    })
  }

  // Fetch updated counts
  const reactionTypes = ['like', 'insightful', 'practical', 'question'] as const
  const counts: Record<string, number> = { like: 0, insightful: 0, practical: 0, question: 0 }

  for (const rType of reactionTypes) {
    const r = await payload.find({
      collection: 'reactions',
      where: {
        'target.relationTo': { equals: targetType },
        'target.value': { equals: targetId },
        type: { equals: rType },
      },
      limit: 0,
      overrideAccess: true,
    })
    counts[rType] = r.totalDocs
  }

  return Response.json({ counts })
}
