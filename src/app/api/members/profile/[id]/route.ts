import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Cross-platform member profile read for ROC/OVIX.
 *
 * GET /api/members/profile/:id
 *
 * Auth: X-API-Key (server-to-server) OR Authorization: Bearer (JWT)
 * Lookup: tries Payload ID first, then rocUserId field for ROC compat.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const payload = await getPayload({ config })

  // Authorize via API key or JWT
  const apiKey = req.headers.get('x-api-key')
  const authHeader = req.headers.get('authorization')

  let authorized = false

  // Server-to-server API key
  if (apiKey && process.env.ROC_API_KEY && apiKey === process.env.ROC_API_KEY) {
    authorized = true
  }

  // JWT-based auth
  if (!authorized && authHeader?.startsWith('Bearer ')) {
    try {
      const headers = new Headers()
      headers.set('Authorization', `JWT ${authHeader.slice(7)}`)
      const { user } = await payload.auth({ headers })
      if (user) authorized = true
    } catch {
      // Invalid token — fall through
    }
  }

  if (!authorized) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const numericId = Number(id)
  if (isNaN(numericId)) {
    return Response.json({ error: 'Invalid ID' }, { status: 400 })
  }

  // Try Payload ID first
  let member = null
  try {
    member = await payload.findByID({
      collection: 'members',
      id: numericId,
      depth: 1,
      overrideAccess: true,
    })
  } catch {
    // Not found by Payload ID — try rocUserId
  }

  if (!member) {
    const result = await payload.find({
      collection: 'members',
      where: { rocUserId: { equals: numericId } },
      limit: 1,
      depth: 1,
      overrideAccess: true,
    })
    member = result.docs[0] || null
  }

  if (!member) {
    return Response.json({ error: 'Member not found' }, { status: 404 })
  }

  return Response.json({ member })
}

/** CORS preflight for cross-origin requests from ROC */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': process.env.ROC_ORIGIN || 'https://roc.cloud',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  })
}
