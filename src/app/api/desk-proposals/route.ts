import { auth } from '@/lib/auth'
import { deskConfigured, listDeskProposals } from '@/lib/desk'

// GET /api/desk-proposals[?status=proposed|open|dismissed]
// PUBLIC (Ted, 2026-10-11 — his later call): anyone sees what the desk proposed, marked PROPOSED.
// Proxies desk-api GET /desk/proposals (the token lets the same proxy read dismissed records for admins).
// Returns `admin` so the board plugin knows whether to draw Confirm / Dismiss.
export async function GET(req: Request) {
  // Public read (Ted, 2026-10-11): anyone sees what the desk proposed; only admins get the buttons.
  const session = await auth()
  if (!deskConfigured()) {
    return Response.json({ error: 'desk-api token not configured (DESK_ADMIN_TOKEN)' }, { status: 503 })
  }
  const url = new URL(req.url)
  const s = url.searchParams.get('status')
  const isAdmin = session?.user?.role === 'admin'
  const status = s === 'open' || (s === 'dismissed' && isAdmin) ? s : 'proposed'
  try {
    const proposals = await listDeskProposals(status)
    return Response.json(
      { generated_at: new Date().toISOString(), status, admin: isAdmin, count: proposals.length, proposals },
      { headers: { 'Cache-Control': isAdmin ? 'private, no-store' : 'public, max-age=15' } },
    )
  } catch (e) {
    // A failed read must say so — never an empty "nothing proposed" payload.
    return Response.json({ error: e instanceof Error ? e.message : 'desk-api unreachable' }, { status: 502 })
  }
}
