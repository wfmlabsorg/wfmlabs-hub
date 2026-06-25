import {
  gateMember,
  loadCase,
  createCase,
  updateCase,
  type ArgumentBucket,
  type Commission,
  type EvidenceCard,
} from '@/lib/beacon/cases'
import { buildInitialEvidence, buildExpandEvidence } from '@/lib/beacon/evidence'

/**
 * POST /api/beacon/evidence — fill / expand the Case Canvas evidence pool (WFM-91 / research-017).
 *
 * Runs the research-014 retrieval stack (card-first bge-m3 kNN + deep-read grading + Exa when thin)
 * over the sharpened question and returns GRADED cards GROUPED under proposed argument buckets, then
 * PERSISTS them to beacon_cases. This is the structured replacement for the chat brief's single text
 * blob — every card is a discrete {id, claim, grade, source, supports_argument, state} object.
 *
 * Body:
 *   { caseId?, commission?, mode?: 'initial'|'expand'|'web', bucketKey? }
 *   - caseId      — operate on an existing owned case (its commission is used unless overridden).
 *   - commission  — required when no caseId (a new draft case is created and returned).
 *   - mode        — 'initial' (default) rebuilds the whole pool; 'expand' adds N more to one bucket;
 *                   'web' rebuilds with a forced Exa pass.
 *   - bucketKey   — required for mode 'expand': which argument bucket to deepen.
 *
 * Returns { caseId, arguments:[{key,label,card_ids}], evidence_pool:[cards], added? }.
 * Auth + premium gate + member ownership enforced. Env: ANTHROPIC_API_KEY, CLOUDFLARE_* , EXA_API_KEY.
 */

export const runtime = 'nodejs'
// Initial build runs surface (embed + kNN) → deep-read (1 Claude call) → bucket (1 Claude call),
// occasionally + an Exa pass. Mirrors respond's ceiling.
export const maxDuration = 300

interface Body {
  caseId?: number
  commission?: Commission
  mode?: 'initial' | 'expand' | 'web'
  bucketKey?: string
}

function questionFor(commission: Commission | null): string {
  if (!commission) return ''
  return (commission.sharpened_question || commission.decision || '').trim()
}

export async function POST(request: Request) {
  const gate = await gateMember()
  if (gate instanceof Response) return gate
  const { pool, payload, memberId } = gate

  const body = (await request.json().catch(() => null)) as Body | null
  const mode = body?.mode === 'expand' || body?.mode === 'web' ? body.mode : 'initial'

  // Resolve (or create) the case this evidence belongs to.
  let theCase = null as Awaited<ReturnType<typeof loadCase>>
  if (body?.caseId != null) {
    theCase = await loadCase(pool, Number(body.caseId), memberId)
    if (!theCase) return Response.json({ error: 'case not found' }, { status: 404 })
    if (body.commission) {
      theCase = await updateCase(pool, theCase.id, memberId, { commission: body.commission })
    }
  } else if (body?.commission) {
    theCase = await createCase(pool, memberId, {
      title: body.commission.decision?.slice(0, 80) || 'Untitled case',
      commission: body.commission,
    })
  } else {
    return Response.json({ error: 'provide caseId or commission' }, { status: 400 })
  }
  if (!theCase) return Response.json({ error: 'case not found' }, { status: 404 })

  const question = questionFor(theCase.commission)
  if (!question) {
    return Response.json({ error: 'case has no commission/question yet — run /commission first' }, { status: 400 })
  }

  // Papers already in the pool — excluded so expand/web return fresh evidence.
  const existingPaperIds = new Set<number>(
    theCase.evidence_pool.map((c) => c.source.paper_id).filter((id): id is number => typeof id === 'number'),
  )

  // ── EXPAND: add N more cards to one existing bucket (no re-bucketing) ──
  if (mode === 'expand') {
    const bucketKey = (body?.bucketKey || '').trim()
    const bucket = theCase.arguments.find((a) => a.key === bucketKey)
    if (!bucket) return Response.json({ error: 'unknown bucketKey for expand' }, { status: 400 })

    const seed = `${question} — ${bucket.label}`
    const added = await buildExpandEvidence(pool, payload, seed, bucketKey, {
      exclude: existingPaperIds,
      count: 3,
    })
    const evidence_pool: EvidenceCard[] = [...theCase.evidence_pool, ...added]
    const args: ArgumentBucket[] = theCase.arguments.map((a) =>
      a.key === bucketKey ? { ...a, card_ids: [...a.card_ids, ...added.map((c) => c.id)] } : a,
    )
    const updated = await updateCase(pool, theCase.id, memberId, { evidence_pool, arguments: args })
    return Response.json({
      caseId: theCase.id,
      arguments: updated!.arguments,
      evidence_pool: updated!.evidence_pool,
      added: added.length,
    })
  }

  // ── INITIAL / WEB: (re)build the whole pool, grouped by freshly proposed buckets ──
  // `origin` lets the gap-driven acquisition pass (research-023) POST kept scholarly papers back to
  // /api/papers/ingest so thin topics grow the library; falls back gracefully if unresolvable.
  const origin = (() => {
    try {
      return new URL(request.url).origin
    } catch {
      return undefined
    }
  })()
  const built = await buildInitialEvidence(pool, payload, question, {
    forceWeb: mode === 'web',
    exclude: new Set<number>(),
    origin,
  })
  const updated = await updateCase(pool, theCase.id, memberId, {
    evidence_pool: built.cards,
    arguments: built.arguments,
    // Re-building the pool invalidates any previously assembled sections.
    sections: null,
    status: 'draft',
  })
  return Response.json({
    caseId: theCase.id,
    arguments: updated!.arguments,
    evidence_pool: updated!.evidence_pool,
    added: built.cards.length,
  })
}
