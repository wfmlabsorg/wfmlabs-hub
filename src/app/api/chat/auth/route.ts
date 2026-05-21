import { auth } from '@/lib/auth'
import { getPayload } from 'payload'
import config from '@payload-config'
import { Rest, type capabilityOp } from 'ably'

// ROC worker is same-origin (/roc on Hub domain) — session cookies work automatically.
export async function POST() {
  const session = await auth()
  if (!session?.user?.payloadMemberId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ABLY_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'chat not configured' }, { status: 503 })
  }

  // Look up member username from Payload
  const payload = await getPayload({ config })
  const member = await payload.findByID({
    collection: 'members',
    id: Number(session.user.payloadMemberId),
    overrideAccess: true,
  })

  if (!member) {
    return Response.json({ error: 'member not found' }, { status: 404 })
  }

  const username = member.username as string
  const isAdmin = session.user.role === 'admin'

  const allOps: capabilityOp[] = ['subscribe', 'publish', 'presence']

  // Unified namespace — no roc: prefix
  const capability: Record<string, capabilityOp[]> = {
    'community:*': allOps,
    'incident:*': allOps,
    'debate:*': allOps,
    'dm:*': allOps,
    'ops': isAdmin ? allOps : ['subscribe'],
    'presence': allOps,
    'signals': ['subscribe'],
  }

  const ably = new Rest(apiKey)
  const tokenRequest = await ably.auth.createTokenRequest({
    clientId: username,
    capability,
  })

  return Response.json(tokenRequest)
}
