import {
  gateMember,
  listCases,
  loadCase,
  loadCasePaper,
  createCase,
  updateCase,
  type ArgumentBucket,
  type CaseSections,
  type CaseStatus,
  type Commission,
  type EvidenceCard,
} from '@/lib/beacon/cases'

/**
 * /api/beacon/cases — list / create / save / load Case Canvas cases (WFM-91 / research-017).
 *
 * GET  → { cases: [{id, title, status, pool_count, cased_count, updated_at}] } for the member.
 * POST → create, save, or load a case (all ownership-enforced):
 *   - { action:'load', id }                          → returns the full case.
 *   - { id, ...patch }                               → SAVE: patch title/status/commission/
 *                                                       evidence_pool/arguments/sections (this is how
 *                                                       the canvas persists curate moves — sending the
 *                                                       updated evidence_pool with new card states).
 *   - { title?, commission? }  (no id)               → CREATE a new draft case, returns it.
 *
 * Auth + premium gate on every request; a member can only ever see/mutate their own cases.
 */

export const runtime = 'nodejs'

export async function GET() {
  const gate = await gateMember()
  if (gate instanceof Response) return gate
  const { pool, memberId } = gate
  const cases = await listCases(pool, memberId)
  return Response.json({ cases })
}

interface Body {
  action?: 'load' | 'save' | 'create'
  id?: number
  title?: string
  status?: CaseStatus
  commission?: Commission | null
  evidence_pool?: EvidenceCard[]
  arguments?: ArgumentBucket[]
  sections?: CaseSections | null
}

const STATUSES: CaseStatus[] = ['draft', 'assembled', 'exported']

export async function POST(request: Request) {
  const gate = await gateMember()
  if (gate instanceof Response) return gate
  const { pool, memberId } = gate

  const body = (await request.json().catch(() => null)) as Body | null
  if (!body) return Response.json({ error: 'invalid body' }, { status: 400 })

  // LOAD by id.
  if (body.action === 'load' || (body.id != null && body.action !== 'save' && !hasPatch(body))) {
    if (body.id == null) return Response.json({ error: 'id required to load' }, { status: 400 })
    const c = await loadCase(pool, Number(body.id), memberId)
    if (!c) return Response.json({ error: 'case not found' }, { status: 404 })
    // Rehydrate the Paper Pipeline artifact too (research-028): if a paper was already developed for
    // this case, the canvas renders it on load instead of forcing a re-develop. Null when none exists.
    const paper = await loadCasePaper(pool, Number(body.id), memberId)
    return Response.json({ case: c, paper })
  }

  // SAVE an existing case (patch only the provided keys).
  if (body.id != null) {
    if (body.status !== undefined && !STATUSES.includes(body.status)) {
      return Response.json({ error: 'invalid status' }, { status: 400 })
    }
    const updated = await updateCase(pool, Number(body.id), memberId, {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.commission !== undefined ? { commission: body.commission } : {}),
      ...(body.evidence_pool !== undefined ? { evidence_pool: body.evidence_pool } : {}),
      ...(body.arguments !== undefined ? { arguments: body.arguments } : {}),
      ...(body.sections !== undefined ? { sections: body.sections } : {}),
    })
    if (!updated) return Response.json({ error: 'case not found' }, { status: 404 })
    return Response.json({ case: updated })
  }

  // CREATE a new draft.
  const created = await createCase(pool, memberId, { title: body.title, commission: body.commission ?? null })
  return Response.json({ case: created }, { status: 201 })
}

function hasPatch(b: Body): boolean {
  return (
    b.title !== undefined ||
    b.status !== undefined ||
    b.commission !== undefined ||
    b.evidence_pool !== undefined ||
    b.arguments !== undefined ||
    b.sections !== undefined
  )
}
