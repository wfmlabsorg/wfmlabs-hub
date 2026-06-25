import { gateMember, loadCase, loadCasePaper, saveCasePaper } from '@/lib/beacon/cases'
import { buildCorpusPaperData } from '@/lib/beacon/publishPaper'

/**
 * POST /api/beacon/paper/publish — publish a finished Beacon paper into the WFM Labs corpus
 * (research-029 / WFM-103). THE FLYWHEEL: a member's developed paper (research-027's `paper.draft`)
 * becomes an original WFM Labs `papers` row so that, once ratified, it is citable in future cases.
 *
 * Body: { caseId }. Gates (identical policy to the rest of the paper pipeline):
 *   - auth + premium (gateMember)
 *   - member ownership (loadCase / loadCasePaper enforce member_id in every query)
 *   - the case must already have a generated paper draft (run POST /api/beacon/paper first)
 *
 * Behaviour:
 *   - Maps the draft → a `papers` row authored "Beacon / @member", sourceType=manual,
 *     paperType=literature-review, sourceUrl = a STABLE canonical internal URL keyed on the case id.
 *   - Dedups by that sourceUrl: first publish CREATES the row at status `proposed` (NOT live);
 *     re-publishing the same case UPDATES that row's content (status is left to the ratification gate).
 *   - Marks beacon_cases.paper.status = 'published_proposed' and records the corpus paper id.
 *
 * NO auto-publish: the row lands `proposed` and stays member-private (hidden from /research, 404 on
 * direct slug) until a curator/FOREMAN ratifies it to `published` — which triggers card+embed
 * (lib/papers/cardEmbed via the Papers afterChange hook) so it becomes retrievable + citable.
 * Governance mirrors WFM-99's propose→wiki gate (proposed status + Payload-admin ratification).
 */

export const runtime = 'nodejs'

interface Body {
  caseId?: number
}

export async function POST(request: Request) {
  const gate = await gateMember()
  if (gate instanceof Response) return gate
  const { pool, payload, memberId, member } = gate

  const body = (await request.json().catch(() => null)) as Body | null
  const caseId = Number(body?.caseId)
  if (!Number.isSafeInteger(caseId) || caseId <= 0) {
    return Response.json({ error: 'caseId must be a positive integer' }, { status: 400 })
  }

  // Ownership: loadCase returns null for a case the member doesn't own.
  const theCase = await loadCase(pool, caseId, memberId)
  if (!theCase) return Response.json({ error: 'case not found' }, { status: 404 })

  // The paper must already be developed (research-027) before it can be published.
  const casePaper = await loadCasePaper(pool, caseId, memberId)
  if (!casePaper?.draft) {
    return Response.json(
      { error: 'No paper draft on this case. Develop it first (POST /api/beacon/paper).' },
      { status: 400 },
    )
  }

  const data = buildCorpusPaperData(casePaper.draft, {
    caseId,
    memberUsername: member.username || `member-${memberId}`,
  })

  // Dedup by the canonical internal URL — re-publishing the same case updates one row, never dupes.
  const existing = await payload.find({
    collection: 'papers',
    where: { sourceUrl: { equals: data.sourceUrl } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  let paperId: number
  let action: 'created' | 'updated'
  let corpusStatus: string

  try {
    if (existing.docs.length > 0) {
      // Update content only. Status is owned by the ratification gate — never auto-(un)publish here.
      const prev = existing.docs[0]
      const updated = await payload.update({
        collection: 'papers',
        id: prev.id,
        data: {
          title: data.title,
          sourceName: data.sourceName,
          paperType: data.paperType,
          authors: data.authors,
          abstract: data.abstract,
          fullText: data.fullText,
          description: data.description,
        },
        overrideAccess: true,
      })
      paperId = updated.id as number
      action = 'updated'
      corpusStatus = (updated.status as string) || (prev.status as string) || 'proposed'
    } else {
      const created = await payload.create({
        collection: 'papers',
        data: {
          ...data,
          // Co-authored "Beacon / @member"; the member is the primary contributor (owns edits).
          primaryContributor: memberId,
          // NOT live — proposed until a curator ratifies. This is the human gate.
          status: 'proposed',
          tier: 'free',
        },
        overrideAccess: true,
      })
      paperId = created.id as number
      action = 'created'
      corpusStatus = (created.status as string) || 'proposed'
    }
  } catch (e) {
    return Response.json(
      { error: 'failed to write the corpus paper', detail: String(e).slice(0, 200) },
      { status: 502 },
    )
  }

  // Record the publish state back onto the case paper (so 028's UI can show it + link the corpus row).
  const saved = await saveCasePaper(pool, caseId, memberId, {
    ...casePaper,
    status: 'published_proposed',
    published_paper_id: paperId,
    published_at: new Date().toISOString(),
  })
  if (!saved) {
    return Response.json({ error: 'failed to persist publish state on the case' }, { status: 500 })
  }

  return Response.json({
    caseId,
    action,
    paperId,
    slug: data.slug,
    sourceUrl: data.sourceUrl,
    corpusStatus, // 'proposed' on first publish — member-private until ratified
    caseStatus: 'published_proposed',
  })
}
