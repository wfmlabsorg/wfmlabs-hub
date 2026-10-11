import { auth } from '@/lib/auth'
import { deskConfigured, listDeskProposals } from '@/lib/desk'

// GET /api/desk-proposals[?status=proposed|open|dismissed]
// MEMBERS ONLY (Ted, 2026-10-11): machine proposals are not public until a person confirms them.
// Proxies desk-api GET /desk/proposals with the server-side token. Returns `admin` so the board
// plugin knows whether to draw Confirm / Dismiss.
export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.payloadMemberId) {
    return Response.json({ error: 'members only' }, { status: 401 })
  }
  if (!deskConfigured()) {
    return Response.json({ error: 'desk-api token not configured (DESK_ADMIN_TOKEN)' }, { status: 503 })
  }
  const url = new URL(req.url)
  const s = url.searchParams.get('status')
  const status = s === 'open' || s === 'dismissed' ? s : 'proposed'
  try {
    const proposals = await listDeskProposals(status)
    return Response.json(
      { generated_at: new Date().toISOString(), status, admin: session.user.role === 'admin', count: proposals.length, proposals },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (e) {
    // A failed read must say so — never an empty "nothing proposed" payload.
    return Response.json({ error: e instanceof Error ? e.message : 'desk-api unreachable' }, { status: 502 })
  }
}
