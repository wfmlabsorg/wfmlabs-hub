import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Cross-platform token verification endpoint for ROC/OVIX.
 *
 * ROC Worker calls this to validate a Hub-issued JWT.
 * Accepts token via Authorization header OR POST body.
 * Validates ROC_API_KEY for server-to-server auth.
 *
 * POST /api/auth/verify
 * Headers: X-ROC-API-Key: <shared-secret>
 * Body: { token: "<hub-jwt>" }
 *   OR
 * Headers: Authorization: Bearer <hub-jwt>
 */
export async function POST(req: Request) {
  // Validate ROC API key for server-to-server calls
  const apiKey = req.headers.get('x-roc-api-key')
  const authHeader = req.headers.get('authorization')

  // Must have either API key or direct bearer token
  if (!apiKey && !authHeader) {
    return Response.json({ valid: false, error: 'Missing authentication' }, { status: 401 })
  }

  // If API key provided, validate it
  if (apiKey && process.env.ROC_API_KEY && apiKey !== process.env.ROC_API_KEY) {
    return Response.json({ valid: false, error: 'Invalid API key' }, { status: 403 })
  }

  // Extract token: from body (ROC Worker pattern) or from Authorization header
  let token: string | null = null

  if (req.headers.get('content-type')?.includes('application/json')) {
    try {
      const body = await req.json() as { token?: string }
      if (body.token) token = body.token
    } catch {}
  }

  if (!token && authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  }

  if (!token) {
    return Response.json({ valid: false, error: 'Missing token' }, { status: 401 })
  }

  const payload = await getPayload({ config })

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
        displayName: (user as unknown as Record<string, unknown>).displayName,
        username: (user as unknown as Record<string, unknown>).username,
        role: (user as unknown as Record<string, unknown>).role,
        type: (user as unknown as Record<string, unknown>).type,
        rocUserId: (user as unknown as Record<string, unknown>).rocUserId || null,
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-ROC-API-Key',
      'Access-Control-Max-Age': '86400',
    },
  })
}
