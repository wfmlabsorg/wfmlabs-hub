/**
 * Beacon → Claude (WFM-82). Thin wrapper over the Anthropic Messages API used by the commissioned
 * session. Model is pinned to claude-sonnet-4-6 (the live commissioned model).
 */

export const BEACON_MODEL = 'claude-sonnet-4-6'

export async function callClaude(
  system: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  maxTokens = 3200,
): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY not set')
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: BEACON_MODEL, max_tokens: maxTokens, system, messages }),
  })
  if (!resp.ok) throw new Error(`Claude ${resp.status}: ${(await resp.text()).slice(0, 200)}`)
  const data = (await resp.json()) as { content?: { text?: string }[] }
  return data.content?.[0]?.text?.trim() || ''
}
