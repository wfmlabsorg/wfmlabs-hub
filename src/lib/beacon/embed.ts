/**
 * Beacon query embedding (WFM-88 / research-014) — bge-m3, 1024-d.
 *
 * The Deep-Research DB upgrades the corpus from MiniLM-384 to `@cf/baai/bge-m3`
 * (1024-d): `research_cards.embedding` (card-level) and `paper_chunks.embedding`
 * are (re)populated with bge-m3 by the paper-embed worker (research-013). For
 * kNN to be meaningful the QUERY must live in the SAME bge-m3 space, so we embed
 * the query with the SAME model here.
 *
 * Mechanism — Cloudflare Workers AI REST (`/ai/run/@cf/baai/bge-m3`), called
 * directly from the Node serverless route. We deliberately do NOT proxy through
 * the paper-embed worker: that worker is research-013 (not yet on roc `main`),
 * so depending on it would couple this PR to an undeployed branch and add a
 * network hop + failure mode. The REST endpoint invokes the IDENTICAL model the
 * corpus was embedded with, so the vector space matches exactly.
 *
 * Provisioning (FOREMAN, in Vercel): `CLOUDFLARE_ACCOUNT_ID` and
 * `CLOUDFLARE_API_TOKEN` (a token with the *Workers AI* permission). If either
 * is unset we return null and the caller falls back to keyword retrieval —
 * embedding must never take the whole route down.
 */

export const EMBED_MODEL = '@cf/baai/bge-m3'
export const EMBED_DIMS = 1024

/**
 * Normalize the Workers AI REST response into a single vector. Cloudflare's bge
 * family returns `{ result: { shape, data: number[][] }, success }`; we also
 * tolerate the OpenAI-style `data:[{embedding:[]}]` and a bare `response` shape
 * so a platform-side schema tweak doesn't silently break retrieval. Mirrors the
 * paper-embed worker's `normalizeEmbeddings` so query + corpus stay in lockstep.
 */
function firstVector(raw: unknown): number[] | null {
  const r = raw as Record<string, unknown>
  const result = (r?.result ?? r) as Record<string, unknown>
  const data = (result?.data ?? result?.response) as unknown
  if (!Array.isArray(data) || data.length === 0) return null
  const el = data[0]
  if (Array.isArray(el)) return el as number[]
  if (el && typeof el === 'object' && Array.isArray((el as { embedding?: unknown }).embedding)) {
    return (el as { embedding: number[] }).embedding
  }
  return null
}

/**
 * Embed a query string into the 1024-d bge-m3 space via Cloudflare Workers AI.
 * Returns null on any failure (missing creds, HTTP error, wrong dimension) so
 * the caller can fall back to keyword retrieval.
 */
export async function embedQuery(text: string): Promise<number[] | null> {
  const clean = (text || '').trim()
  if (!clean) return null

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!accountId || !token) {
    console.warn('[beacon/embed] CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN unset — falling back to keyword retrieval')
    return null
  }

  try {
    const resp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${EMBED_MODEL}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        // bge-m3 takes a string or array; a 1-element array keeps the response
        // shape identical to the worker's batched calls.
        body: JSON.stringify({ text: [clean.slice(0, 4000)] }),
      },
    )
    if (!resp.ok) {
      console.error('[beacon/embed] CF Workers AI', resp.status, (await resp.text()).slice(0, 200))
      return null
    }
    const vec = firstVector(await resp.json())
    if (!vec || vec.length !== EMBED_DIMS) {
      console.error('[beacon/embed] unexpected vector dim', vec?.length)
      return null
    }
    return vec
  } catch (e) {
    console.error('[beacon/embed] embedding failed, falling back to keyword:', String(e).slice(0, 200))
    return null
  }
}

/** pgvector literal for a parameterized `$n::vector` cast. */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`
}
