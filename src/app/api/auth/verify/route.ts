import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Cross-platform token verification endpoint for ROC/OVIX.
 *
 * ROC Worker calls this to validate a Hub-issued Payload JWT.
 * Returns minimal member identity for session mapping.
 *
 * POST /api/auth/verify
 * Headers: Authorization: Bearer <payload-jwt>
 */
export async function POST(req: Request) {
  const payload = await getPayload({ config })

  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ valid: false, error: 'Missing bearer token' }, { status: 401 })
  }

  const token = authHeader.slice(7)

  try {
    const headers = new Headers()
    headers.set('Authorization', `JWT ${token}`)
    const { user } = await payload.auth({ headers })

    if (!user) {
      return Response.json({ valid: false }, { status: 401 })
    }

    return Response.json({
      valid: true,
      member: {
        id: user.id,
        email: user.email,
        displayName: (user as Record<string, unknown>).displayName,
        username: (user as Record<string, unknown>).username,
        role: (user as Record<string, unknown>).role,
        type: (user as Record<string, unknown>).type,
        rocUserId: (user as Record<string, unknown>).rocUserId || null,
      },
    })
  } catch {
    return Response.json({ valid: false, error: 'Invalid token' }, { status: 401 })
  }
}

/** CORS preflight for cross-origin requests from ROC */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': process.env.ROC_ORIGIN || 'https://roc.cloud',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  })
}
