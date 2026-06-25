/**
 * Beacon web-reach (WFM-88 / research-014) — Exa search, gated + cite-only-what-was-fetched.
 *
 * When INTERNAL retrieval is thin (the library doesn't carry the question), Beacon may reach the
 * open web for canonical sources it can actually cite (e.g. CEB/Gartner CES, the Service-Profit
 * Chain). The no-fabrication rail extends to the web: Beacon may cite ONLY the highlight text Exa
 * actually returned, plus the URL — never embellish beyond what was fetched. Web sources are tagged
 * distinctly in the brief's SOURCES table and graded conservatively.
 *
 * Mechanism: Exa `/search` REST (no SDK dependency). `type:"auto"`, highlights nested under
 * `contents` (per Exa's coding-agent guide — `text/highlights/summary` MUST be under `contents`;
 * do NOT use deprecated `useAutoprompt`/`numSentences`/`livecrawl:"always"`). Reads EXA_API_KEY from
 * env; if unset, returns [] silently (graceful skip). Bounded to a single call per brief by the
 * caller. On any error returns [] — web-reach must never take the route down.
 */

export interface WebSource {
  title: string
  url: string
  highlights: string[]
  publishedDate?: string
}

interface ExaResult {
  title?: string
  url?: string
  highlights?: string[]
  publishedDate?: string
}

/**
 * Search the open web via Exa. Returns [] when EXA_API_KEY is unset (silent skip) or on any error.
 * `opts.includeDomains` / `opts.excludeDomains` map to Exa's domain filters (NOT includeUrls).
 */
export async function webReach(
  query: string,
  opts: { numResults?: number; includeDomains?: string[]; excludeDomains?: string[] } = {},
): Promise<WebSource[]> {
  const key = process.env.EXA_API_KEY
  const q = (query || '').trim()
  if (!key || !q) return []

  try {
    const resp = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key },
      body: JSON.stringify({
        query: q.slice(0, 1000),
        type: 'auto',
        numResults: opts.numResults ?? 8,
        ...(opts.includeDomains ? { includeDomains: opts.includeDomains } : {}),
        ...(opts.excludeDomains ? { excludeDomains: opts.excludeDomains } : {}),
        // highlights MUST be nested under `contents` per Exa's guide.
        contents: { highlights: true },
      }),
    })
    if (!resp.ok) {
      console.error('[beacon/webreach] Exa', resp.status, (await resp.text()).slice(0, 200))
      return []
    }
    const data = (await resp.json()) as { results?: ExaResult[] }
    return (data.results || [])
      .filter((r) => r.url && Array.isArray(r.highlights) && r.highlights.length > 0)
      .map((r) => ({
        title: String(r.title || r.url),
        url: String(r.url),
        highlights: (r.highlights || []).map((h) => String(h)),
        publishedDate: r.publishedDate,
      }))
  } catch (e) {
    console.error('[beacon/webreach] failed (skipping web-reach):', String(e).slice(0, 200))
    return []
  }
}
