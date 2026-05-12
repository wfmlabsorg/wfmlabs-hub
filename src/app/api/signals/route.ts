import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Signals API — ingest signals from ROC Worker and serve to frontend.
 *
 * POST /api/signals — Create signal (ROC Worker via API key, or admin)
 * GET  /api/signals — List recent signals (public)
 */

export async function POST(req: Request) {
  // Authenticate: ROC API key or admin session
  const apiKey = req.headers.get('x-roc-api-key')
  const isValidApiKey = apiKey && process.env.ROC_API_KEY && apiKey === process.env.ROC_API_KEY

  const payload = await getPayload({ config })

  if (!isValidApiKey) {
    // Check for admin session
    try {
      const cookieHeader = req.headers.get('cookie') || ''
      const headers = new Headers()
      headers.set('cookie', cookieHeader)
      const { user } = await payload.auth({ headers })
      if (!user || (user as unknown as Record<string, unknown>).role !== 'admin') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } catch {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const body = await req.json() as {
      signals?: Array<{
        signalType: string
        title: string
        message: string
        source: string
        severity?: number
        severityLabel?: string
        category?: string
        regionId?: string
        regionName?: string
        sourceUrl?: string
        metadata?: Record<string, unknown>
      }>
      // Single signal shorthand
      signalType?: string
      title?: string
      message?: string
      source?: string
      severity?: number
      severityLabel?: string
      category?: string
      regionId?: string
      regionName?: string
      sourceUrl?: string
      metadata?: Record<string, unknown>
    }

    // Support both single signal and batch
    const signals = body.signals || (body.message ? [body] : [])

    if (signals.length === 0) {
      return Response.json({ error: 'No signals provided' }, { status: 400 })
    }

    const results = []
    for (const sig of signals) {
      if (!sig.message || !sig.source || !sig.signalType) continue

      const signalType = (['ai', 'alert', 'ovix', 'member'].includes(sig.signalType) ? sig.signalType : 'ai') as 'ai' | 'alert' | 'ovix' | 'member'
      const severityLabel = (sig.severityLabel || (
        sig.severity && sig.severity >= 8 ? 'extreme'
        : sig.severity && sig.severity >= 6 ? 'severe'
        : sig.severity && sig.severity >= 4 ? 'moderate'
        : 'info'
      )) as 'info' | 'moderate' | 'severe' | 'extreme'
      const category = (['weather', 'seismic', 'disaster', 'events', 'cyber', 'infrastructure', 'health', 'financial', 'general'].includes(sig.category || '') ? sig.category : 'general') as 'weather' | 'seismic' | 'disaster' | 'events' | 'cyber' | 'infrastructure' | 'health' | 'financial' | 'general'

      const created = await payload.create({
        collection: 'signals',
        data: {
          signalType,
          title: sig.title || sig.message.slice(0, 80),
          message: sig.message,
          source: sig.source,
          severity: sig.severity || undefined,
          severityLabel,
          category,
          regionId: sig.regionId || undefined,
          regionName: sig.regionName || undefined,
          sourceUrl: sig.sourceUrl || undefined,
          metadata: sig.metadata || undefined,
        },
        overrideAccess: true,
      })
      results.push({ id: created.id })
    }

    return Response.json({ success: true, count: results.length, signals: results })
  } catch (e) {
    return Response.json({ error: 'Failed to create signal' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const payload = await getPayload({ config })
  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
  const category = url.searchParams.get('category')
  const regionId = url.searchParams.get('region')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (category) where.category = { equals: category }
  if (regionId) where.regionId = { equals: regionId }

  const signals = await payload.find({
    collection: 'signals',
    where: Object.keys(where).length > 0 ? where : undefined,
    limit,
    sort: '-createdAt',
  })

  return Response.json(signals)
}
