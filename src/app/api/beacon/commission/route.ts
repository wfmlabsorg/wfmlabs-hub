import { gateMember, updateCase, type Commission } from '@/lib/beacon/cases'
import { BEACON_COMMISSIONED_PROMPT } from '@/lib/beacon/commissioned-prompt'
import { callClaude } from '@/lib/beacon/claude'

/**
 * POST /api/beacon/commission — the Case Canvas intake turn (WFM-91 / research-017).
 *
 * A TERSE replacement for the chat Beacon's long-paragraph intake (a known complaint). Given the
 * conversation so far, Beacon either asks ONE short sharpening question, or — when the problem is a
 * decidable question — locks the commission {decision, skeptic, context, sharpened_question}. It
 * never runs a long pre-delivery negotiation; replies stay 1–3 sentences.
 *
 * Output is a single structured JSON object both ways (so the client parses one shape):
 *   not ready → {"ready":false,"reply":"<one short question>"}
 *   ready     → {"ready":true,"decision":..,"skeptic":..,"context":..,"sharpened_question":..}
 *
 * Body: { messages: [{role:'user'|'assistant', content}], caseId?: number }
 *   caseId (optional) — when present and the commission locks, it is persisted onto that case.
 *
 * Auth + premium gate + (when caseId given) member ownership enforced. Env: ANTHROPIC_API_KEY.
 */

export const runtime = 'nodejs'
export const maxDuration = 60

interface Body {
  messages?: { role?: string; content?: string }[]
  caseId?: number
}

function cleanMessages(raw: Body['messages']): { role: 'user' | 'assistant'; content: string }[] {
  const out: { role: 'user' | 'assistant'; content: string }[] = []
  for (const m of raw || []) {
    const role: 'user' | 'assistant' = m?.role === 'assistant' ? 'assistant' : 'user'
    const content = (m?.content || '').trim()
    if (!content) continue
    const last = out[out.length - 1]
    if (last && last.role === role) last.content += `\n\n${content}`
    else out.push({ role, content })
  }
  return out
}

export async function POST(request: Request) {
  const gate = await gateMember()
  if (gate instanceof Response) return gate
  const { pool, memberId, member } = gate

  const body = (await request.json().catch(() => null)) as Body | null
  const messages = cleanMessages(body?.messages)
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return Response.json({ error: 'send at least one member message' }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const system = `${BEACON_COMMISSIONED_PROMPT}

Today is ${today}. The commissioning member is @${member.username}.

## Runtime control (Case Canvas intake)
You are in the INTAKE phase of a Case Canvas session. Your ONLY job this turn is to lock a sharp, decidable commission — you do NOT search, grade, or write a brief here.
- Ask AT MOST ONE short sharpening question, and only if it genuinely changes the research (the decision, the skeptic, or the operating context). Keep it to ONE or TWO sentences. Never ask the member to narrow or downgrade their ask; never say the evidence "isn't there" — that judgment belongs to the evidence step, not intake.
- The moment the problem is a decidable question (which is after at most one or two exchanges, or immediately if the ask is already clear), LOCK the commission.
- Respond with ONLY a single minified JSON object, no prose, no code fence:
  - still sharpening → {"ready":false,"reply":"<your one short question>"}
  - locked → {"ready":true,"decision":"<the sharpened decision/claim they're defending>","skeptic":"<who they must convince>","context":"<channel/size/sector that scopes it>","sharpened_question":"<the single sharp research question, one sentence>"}
Use "" for any field the member genuinely hasn't given. Do not invent specifics.`

  let raw: string
  try {
    raw = await callClaude(system, messages, 600)
  } catch (e) {
    return Response.json({ error: 'beacon failed to respond', detail: String(e).slice(0, 200) }, { status: 502 })
  }

  let parsed: { ready?: boolean; reply?: string } & Partial<Commission>
  try {
    parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
  } catch {
    // Model didn't emit JSON — treat the whole reply as a clarifying question (never 500 on this).
    return Response.json({ ready: false, reply: raw.trim() || 'Could you say a bit more about the decision you need to defend?' })
  }

  if (!parsed.ready) {
    return Response.json({ ready: false, reply: (parsed.reply || '').trim() || raw.trim() })
  }

  const commission: Commission = {
    decision: (parsed.decision || '').trim(),
    skeptic: (parsed.skeptic || '').trim(),
    context: (parsed.context || '').trim(),
    sharpened_question: (parsed.sharpened_question || parsed.decision || '').trim(),
  }

  // Persist onto the case if one was supplied (ownership enforced inside updateCase).
  let caseId: number | undefined
  if (body?.caseId != null) {
    const updated = await updateCase(pool, Number(body.caseId), memberId, { commission })
    if (!updated) return Response.json({ error: 'case not found' }, { status: 404 })
    caseId = updated.id
  }

  return Response.json({ ready: true, commission, caseId })
}
