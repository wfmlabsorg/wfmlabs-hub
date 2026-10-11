import { auth } from '@/lib/auth'
import { getPayload } from 'payload'
import config from '@payload-config'
import { decideDeskProposal, deskConfigured } from '@/lib/desk'

// POST /api/desk-proposals/[id]/confirm | dismiss     body: { reason? }  (dismiss requires a reason)
// ADMIN ONLY. The hub is the human entry point; desk-api is the writer (status transition, decided_by,
// incident_timeline row). `by` is the admin's username, resolved here like /api/incidents/[slug]/action.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  const session = await auth()
  if (!session?.user?.payloadMemberId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'admin') {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }
  const { id, action } = await params
  if (!/^\d+$/.test(id) || (action !== 'confirm' && action !== 'dismiss')) {
    return Response.json({ error: 'bad request' }, { status: 400 })
  }
  const body = (await request.json().catch(() => null)) as { reason?: string } | null
  const reason = body?.reason?.trim() || ''
  if (action === 'dismiss' && !reason) {
    return Response.json({ error: 'a reason is required to dismiss' }, { status: 400 })
  }
  if (!deskConfigured()) {
    return Response.json({ error: 'desk-api token not configured (DESK_ADMIN_TOKEN)' }, { status: 503 })
  }

  const payload = await getPayload({ config })
  const member = await payload.findByID({ collection: 'members', id: Number(session.user.payloadMemberId), overrideAccess: true })
  const actor = (member?.username as string) || 'admin'

  try {
    const r = await decideDeskProposal(Number(id), action, actor, reason || undefined)
    return Response.json(r.body, { status: r.ok ? 200 : r.status })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'desk-api unreachable' }, { status: 502 })
  }
}
