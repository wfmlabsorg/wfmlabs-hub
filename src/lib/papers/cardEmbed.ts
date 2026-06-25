/**
 * Ratify → card + embed trigger (research-029 / WFM-103) — the flywheel's last link.
 *
 * When a `papers` row is ratified to `status: 'published'` (a curator/FOREMAN flips it in the Payload
 * admin, or via POST /api/papers/ratify), the paper must be CARDED and EMBEDDED so it becomes
 * retrievable + citable in future Beacon cases. Carding/embedding are the roc workers paper-cards
 * (research-012) and paper-embed (research-013); both ultimately scan the corpus for published papers
 * that still need a research_card / an embedding and process them.
 *
 * This helper is the *push* path: on ratification we proactively nudge those workers so a newly-ratified
 * paper is enrolled immediately rather than waiting for the next cron sweep. It is intentionally:
 *   - OPTIONAL — if PAPER_CARDS_URL / PAPER_EMBED_URL are unset (e.g. the workers aren't deployed yet,
 *     which is the case until research-012/013 ship) it no-ops cleanly; the workers' own cron scan is
 *     the backstop, so ratification is never blocked on this push.
 *   - FIRE-AND-FORGET — it never throws into the caller (a Payload afterChange hook / the ratify route)
 *     and never blocks the admin save; failures are logged, not propagated.
 *   - AUTHENTICATED with the shared BEACON_API_KEY (the same secret paper-harvest uses for
 *     /api/papers/ingest), so the worker contract is consistent across the pipeline.
 */

interface TriggerResult {
  worker: 'paper-cards' | 'paper-embed'
  triggered: boolean
  ok?: boolean
  status?: number
  skipped?: 'no-url' | 'no-key'
  error?: string
}

async function nudge(
  worker: 'paper-cards' | 'paper-embed',
  url: string | undefined,
  apiKey: string | undefined,
  paperId: number,
): Promise<TriggerResult> {
  if (!url) return { worker, triggered: false, skipped: 'no-url' }
  if (!apiKey) return { worker, triggered: false, skipped: 'no-key' }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-BEACON-API-KEY': apiKey },
      body: JSON.stringify({ paperId }),
    })
    return { worker, triggered: true, ok: res.ok, status: res.status }
  } catch (e) {
    return { worker, triggered: false, error: String(e).slice(0, 200) }
  }
}

/**
 * Nudge the card + embed workers for a freshly-ratified paper. Never throws; returns a per-worker
 * summary for logging. Safe to call on every proposed→published transition.
 */
export async function triggerCardEmbed(paperId: number): Promise<TriggerResult[]> {
  const apiKey = process.env.BEACON_API_KEY
  const results = await Promise.all([
    nudge('paper-cards', process.env.PAPER_CARDS_URL, apiKey, paperId),
    nudge('paper-embed', process.env.PAPER_EMBED_URL, apiKey, paperId),
  ])
  const fired = results.filter((r) => r.triggered)
  if (fired.length) {
    console.info(`[cardEmbed] ratify trigger for paper ${paperId}:`, JSON.stringify(results))
  }
  return results
}
