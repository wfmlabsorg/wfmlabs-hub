import { gateMember, loadCase, updateCase, type CaseSections, type EvidenceCard } from '@/lib/beacon/cases'
import { BEACON_COMMISSIONED_PROMPT } from '@/lib/beacon/commissioned-prompt'
import { callClaude } from '@/lib/beacon/claude'

/**
 * POST /api/beacon/assemble — generate the connective sections from the CURATED case (WFM-91 / 017).
 *
 * Reads ONLY the cards the member kept into The Case (state==='cased') and writes the four discrete
 * sections — Position, Steelman, Where-the-evidence-runs-out, Bottom line — as SEPARATE structured
 * strings (never one giant blob; that's the truncation bug this redesign kills). No-fabrication: it
 * may cite ONLY the cased evidence handed to it; gaps must be honest. Persists sections +
 * status='assembled'.
 *
 * Body: { caseId }.  Auth + premium gate + member ownership enforced. Env: ANTHROPIC_API_KEY.
 */

export const runtime = 'nodejs'
export const maxDuration = 120

interface Body {
  caseId?: number
}

function casedBlock(cards: EvidenceCard[], buckets: { key: string; label: string }[]): string {
  const labelOf = new Map(buckets.map((b) => [b.key, b.label]))
  const lines: string[] = []
  for (const c of cards) {
    const auth = c.source.authors.slice(0, 3).join(', ') || 'n/a'
    const tag = c.source.type === 'web' ? `web · ${c.source.url}` : `${auth} · ${c.source.url}`
    lines.push(
      `- [${labelOf.get(c.supports_argument) || c.supports_argument} | grade ${c.grade}] ${c.claim}\n    SOURCE: "${c.source.title}" (${tag})`,
    )
  }
  return lines.join('\n')
}

export async function POST(request: Request) {
  const gate = await gateMember()
  if (gate instanceof Response) return gate
  const { pool, memberId, member } = gate

  const body = (await request.json().catch(() => null)) as Body | null
  if (body?.caseId == null) return Response.json({ error: 'caseId required' }, { status: 400 })

  const theCase = await loadCase(pool, Number(body.caseId), memberId)
  if (!theCase) return Response.json({ error: 'case not found' }, { status: 404 })

  const cased = theCase.evidence_pool.filter((c) => c.state === 'cased')
  if (cased.length === 0) {
    return Response.json({ error: 'Curate at least one card into The Case before assembling.' }, { status: 400 })
  }

  const commission = theCase.commission
  const today = new Date().toISOString().slice(0, 10)
  const system = `${BEACON_COMMISSIONED_PROMPT}

Today is ${today}. The commissioning member is @${member.username}.

## Runtime control (Case Canvas assemble)
The member has CURATED their case: below is the ONLY evidence you may use. Write the four connective sections of the Defensible Position Brief AROUND this curated evidence — as SEPARATE blocks, never one combined message.
- THE COMMISSION:
  decision: ${commission?.decision || '(unspecified)'}
  skeptic: ${commission?.skeptic || '(unspecified)'}
  context: ${commission?.context || '(unspecified)'}
  sharpened question: ${commission?.sharpened_question || commission?.decision || '(unspecified)'}
- CURATED EVIDENCE (cite ONLY these — by claim/source; never invent a citation; web sources cite only their fetched text + URL):
${casedBlock(cased, theCase.arguments)}

Produce ONLY a minified JSON object, no prose, no code fence:
{"position":"<2–4 sentences: the defensible claim, calibrated to the cased evidence and its grades>","steelman":"<2–4 sentences: the strongest opposing case the cased evidence supports; if the curated set carries no opposition, say so plainly and flag the absence>","gaps":"<2–4 sentences: where the cased evidence runs out — thin/old/off-context/vendor-interested spots; the ambush-prevention section; be honest>","bottom_line":"<1–2 sentences: the position that survives scrutiny and exactly where it stops being defensible>"}
Each value is plain prose (no markdown headers). Calibrate to the A–V grades shown — never assert strength the cased evidence won't carry.`

  let raw: string
  try {
    raw = await callClaude(system, [{ role: 'user', content: 'Assemble the four sections from the curated evidence above.' }], 1800)
  } catch (e) {
    return Response.json({ error: 'beacon failed to assemble', detail: String(e).slice(0, 200) }, { status: 502 })
  }

  let parsed: Partial<CaseSections>
  try {
    parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
  } catch {
    return Response.json({ error: 'beacon returned an unparseable assembly', detail: raw.slice(0, 200) }, { status: 502 })
  }

  const sections: CaseSections = {
    position: (parsed.position || '').trim(),
    steelman: (parsed.steelman || '').trim(),
    gaps: (parsed.gaps || '').trim(),
    bottom_line: (parsed.bottom_line || '').trim(),
  }

  const updated = await updateCase(pool, theCase.id, memberId, { sections, status: 'assembled' })
  return Response.json({ caseId: theCase.id, status: updated!.status, sections })
}
