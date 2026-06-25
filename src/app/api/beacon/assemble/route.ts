import {
  gateMember,
  loadCase,
  updateCase,
  type CaseSections,
  type CitationRef,
  type EvidenceCard,
} from '@/lib/beacon/cases'
import { BEACON_COMMISSIONED_PROMPT } from '@/lib/beacon/commissioned-prompt'
import { callClaude } from '@/lib/beacon/claude'
import { tierLabel } from '@/lib/beacon/tiers'

/**
 * POST /api/beacon/assemble — synthesize the connective sections from the CURATED case (WFM-91/94).
 *
 * Reads ONLY the cards the member kept into The Case (state==='cased') and writes the four sections —
 * Position, Steelman, Where-the-evidence-runs-out, Bottom line — as SEPARATE structured strings.
 * Iteration 2 (research-020): the Position is now a ROBUST, multi-paragraph SYNTHESIS that weaves the
 * curated arguments together, with INLINE `[E#]` citations to specific cards and EXPLICIT
 * academic-vs-weak weighting (it must say where it leans on peer-reviewed research vs softer
 * web/vendor claims, and never present a vendor claim as settled). Every cased card is assigned a
 * stable `E#` ref; the response carries a `citations` map so the UI (021) can render the `[E#]`
 * tokens as chips that link to their source card. No-fabrication: cite ONLY the cased evidence;
 * gaps must be honest. Persists sections + status='assembled'.
 *
 * Body: { caseId }.  Auth + premium gate + member ownership enforced. Env: ANTHROPIC_API_KEY.
 */

export const runtime = 'nodejs'
export const maxDuration = 120

interface Body {
  caseId?: number
}

/**
 * Render the cased evidence for the prompt, each card prefixed with its stable `[E#]` ref plus its
 * argument bucket, credibility tier, and A–V grade — so the model can cite specific cards inline and
 * weight academic vs weak evidence. `refOf` maps card.id → "E#".
 */
function casedBlock(
  cards: EvidenceCard[],
  buckets: { key: string; label: string }[],
  refOf: Map<string, string>,
): string {
  const labelOf = new Map(buckets.map((b) => [b.key, b.label]))
  const lines: string[] = []
  for (const c of cards) {
    const ref = refOf.get(c.id) || 'E?'
    const auth = c.source.authors.slice(0, 3).join(', ') || 'n/a'
    const tag = c.source.type === 'web' ? `web · ${c.source.url}` : `${auth} · ${c.source.url}`
    const tier = c.source.tier ? tierLabel(c.source.tier) : c.source.type === 'web' ? 'web · unverified' : 'library'
    lines.push(
      `- [${ref}] [${labelOf.get(c.supports_argument) || c.supports_argument} | ${tier} | grade ${c.grade}] ${c.claim}\n    SOURCE: "${c.source.title}" (${tag})`,
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

  // Assign each cased card a stable inline-citation ref (E1, E2, …) in presentation order, and build
  // the citations map up front so it covers EVERY cased card (any [E#] the model emits resolves).
  const refOf = new Map<string, string>()
  cased.forEach((c, i) => refOf.set(c.id, `E${i + 1}`))
  const citations: CitationRef[] = cased.map((c) => ({
    ref: refOf.get(c.id)!,
    card_id: c.id,
    grade: c.grade,
    tier: c.source.tier,
    label: (c.source.title || c.claim).slice(0, 120),
  }))

  const commission = theCase.commission
  const today = new Date().toISOString().slice(0, 10)
  const system = `${BEACON_COMMISSIONED_PROMPT}

Today is ${today}. The commissioning member is @${member.username}.

## Runtime control (Case Canvas assemble)
The member has CURATED their case: below is the ONLY evidence you may use. Write the connective sections of the Defensible Position Brief AROUND this curated evidence — as SEPARATE blocks, never one combined message.
- THE COMMISSION:
  decision: ${commission?.decision || '(unspecified)'}
  skeptic: ${commission?.skeptic || '(unspecified)'}
  context: ${commission?.context || '(unspecified)'}
  sharpened question: ${commission?.sharpened_question || commission?.decision || '(unspecified)'}
- CURATED EVIDENCE — each card has a citation id [E#], its argument, its credibility tier, and its A–V grade. Cite ONLY these, BY THEIR [E#] id, inline in your prose; never invent a citation; web/vendor sources cite only their fetched text + URL:
${casedBlock(cased, theCase.arguments, refOf)}

CREDIBILITY RAIL (enforce in your weighting):
- peer-reviewed / preprint / institutional tiers = HARD research — these can carry a claim.
- "vendor · interested" (grade V) = an interested party's marketing claim — hypothesis-generating ONLY, NEVER load-bearing; never present it as settled.
- "web · unverified" (capped at grade C) = suggestive only.
- NO claim or argument may stand on V or C evidence ALONE without you SAYING SO in the prose.

Write the "position" as a ROBUST, DECISION-READY SYNTHESIS (2–4 paragraphs, not two thin sentences) that WEAVES the curated arguments together into one coherent case for the commission's decision. Requirements for "position":
- Ground every substantive claim in specific cards via inline [E#] citations (e.g. "[E2]", "[E3][E5]").
- Make the academic-vs-weak weighting EXPLICIT — e.g. "strongly supported by peer-reviewed [E2]; the vendor figure [E5] is directional only" / "this rests only on web claims [E4] and should be treated as suggestive." Lean visibly on the hard tiers; flag where you lean on soft ones.
- Stay CALIBRATED to the grades shown — do not assert strength the cased evidence won't carry, and never overreach beyond the cards.
The other three sections stay tight (2–4 sentences each) and may also cite [E#].

Produce ONLY a minified JSON object, no prose, no code fence:
{"position":"<the multi-paragraph synthesized, [E#]-cited, academic-vs-weak-weighted position; separate paragraphs with \\n\\n>","steelman":"<2–4 sentences: the strongest opposing case the cased evidence supports, citing [E#]; if the curated set carries no opposition, say so plainly and flag the absence>","gaps":"<2–4 sentences: where the cased evidence runs out — thin/old/off-context/vendor-interested spots, naming the [E#] that are weak; the ambush-prevention section; be honest>","bottom_line":"<1–2 sentences: the position that survives scrutiny and exactly where it stops being defensible>"}
Each value is plain prose (no markdown headers). Use ONLY the [E#] ids listed above for citations.`

  let raw: string
  try {
    raw = await callClaude(system, [{ role: 'user', content: 'Assemble the sections from the curated evidence above — synthesize the Position, cite [E#] inline, and weight academic vs weak.' }], 2400)
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
    citations,
  }

  const updated = await updateCase(pool, theCase.id, memberId, { sections, status: 'assembled' })
  return Response.json({ caseId: theCase.id, status: updated!.status, sections })
}
