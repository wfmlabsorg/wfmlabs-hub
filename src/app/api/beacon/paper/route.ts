import { gateMember, loadCase, saveCasePaper } from '@/lib/beacon/cases'
import { developPaper } from '@/lib/beacon/paper'

/**
 * POST /api/beacon/paper — Deep Engagement + publishable draft from an ASSEMBLED case
 * (research-027 / WFM-101). THE CENTERPIECE of the Paper Pipeline.
 *
 * Where /api/beacon/assemble writes a digest-level brief from the curated cards, this route goes
 * DEEPER: it reads the cased papers' FULL TEXT for detailed supporting evidence, runs ONE
 * counter-search pass (library kNN + Exa/Crossref academic) for DISCONFIRMING evidence — the rigorous
 * steelman — and synthesizes a balanced, honestly-cited publishable paper. The artifact is persisted
 * as the `paper` JSONB on beacon_cases (schema/004) and returned:
 *   { status:'draft', engagement:{supporting[],challenging[],tensions[]}, draft:{...sections...}, generated_at }
 *
 * Body: { caseId }. Auth + premium gate + member ownership enforced (gateMember + ownership in every
 * beacon_cases query). Cost is bounded: full text of ≤8 cased papers + ONE counter-search pass +
 * THREE Claude calls total. No-fabrication: only sources actually read are citable; the reference
 * list is built server-side. Env: ANTHROPIC_API_KEY, CLOUDFLARE_*, EXA_API_KEY, CROSSREF_MAILTO.
 */

export const runtime = 'nodejs'
// Deep read + counter-search (1 library deep-read call + acquire's appraiser) + synthesis — heavy.
export const maxDuration = 300

interface Body {
  caseId?: number
}

export async function POST(request: Request) {
  const gate = await gateMember()
  if (gate instanceof Response) return gate
  const { pool, payload, memberId, member } = gate

  const body = (await request.json().catch(() => null)) as Body | null
  if (body?.caseId == null) return Response.json({ error: 'caseId required' }, { status: 400 })

  // Ownership is enforced here — loadCase returns null for a case the member doesn't own.
  const theCase = await loadCase(pool, Number(body.caseId), memberId)
  if (!theCase) return Response.json({ error: 'case not found' }, { status: 404 })

  // The paper is developed FROM an assembled case (it builds on the synthesized position).
  if (!theCase.sections?.position) {
    return Response.json(
      { error: 'Assemble the case (POST /api/beacon/assemble) before developing it into a paper.' },
      { status: 400 },
    )
  }
  const cased = theCase.evidence_pool.filter((c) => c.state === 'cased')
  if (cased.length === 0) {
    return Response.json({ error: 'No cased evidence — curate cards into The Case first.' }, { status: 400 })
  }

  const origin = (() => {
    try {
      return new URL(request.url).origin
    } catch {
      return undefined
    }
  })()

  let paper
  try {
    paper = await developPaper(pool, payload, theCase, { username: member.username, origin })
  } catch (e) {
    return Response.json(
      { error: 'beacon failed to develop the paper', detail: String(e).slice(0, 200) },
      { status: 502 },
    )
  }

  const saved = await saveCasePaper(pool, theCase.id, memberId, paper)
  if (!saved) return Response.json({ error: 'failed to persist paper' }, { status: 500 })

  return Response.json({ caseId: theCase.id, status: paper.status, paper })
}
