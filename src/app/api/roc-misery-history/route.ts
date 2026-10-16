import { readMiseryHistory } from '@/lib/misery'

/**
 * ROC Misery history — hourly frames of every airport's misery score for the dashboard's 24 h replay
 * (api-083, 2026-10-16; modelled on FlightAware MiseryMap's playback). Same SQL rule as the live view.
 *
 * GET /api/roc-misery-history[?hours=24]  (public, read-only; 6..72 h)
 * { frames: [ { sweep_id, observed_at, airports: { ICAO: [misery|null, cancelled, movements, cancel_rate|null] } } ], meta }
 */
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const h = Number(new URL(req.url).searchParams.get('hours') ?? 24)
    const hours = Number.isFinite(h) ? Math.min(72, Math.max(6, Math.round(h))) : 24
    const payload = await readMiseryHistory(hours)
    return Response.json(payload, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })
  } catch (e) {
    console.error('roc-misery-history query error:', e)
    return Response.json({ error: 'Failed to query airport misery history' }, { status: 500 })
  }
}
