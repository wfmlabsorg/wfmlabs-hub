import { getPayload } from 'payload'
import config from '@payload-config'
import { sql } from '@payloadcms/db-postgres'

/**
 * Signals API — ingest signals from ROC Worker and serve to frontend.
 *
 * POST /api/signals — Create signal (ROC Worker via API key, or admin)
 * GET  /api/signals — List recent signals (public)
 */

// Full signals category allowlist — MUST match the Postgres enum
// `enum_signals_category` (and the options in src/collections/Signals.ts).
// hub-033: previous list predated the travel/labor/supply_chain domains, so
// travel-intel signals were being coerced to 'general' and dropped from the
// travel op-risk index.
const VALID_CATEGORIES = [
  'weather', 'seismic', 'disaster', 'events', 'cyber',
  'infrastructure', 'health', 'financial', 'environmental',
  'geopolitical', 'general', 'labor', 'supply_chain', 'travel',
] as const

type SignalCategory = (typeof VALID_CATEGORIES)[number]

export async function POST(req: Request) {
  // Authenticate: ROC API key, Sentinel API key, or admin session
  const rocKey = req.headers.get('x-roc-api-key')
  const sentinelKey = req.headers.get('x-sentinel-api-key')
  const isValidApiKey =
    (rocKey && process.env.ROC_API_KEY && rocKey === process.env.ROC_API_KEY) ||
    (sentinelKey && process.env.SENTINEL_API_KEY && sentinelKey === process.env.SENTINEL_API_KEY)

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
      // Coerce genuinely unknown values to 'general'; known enum values pass through.
      const category = ((VALID_CATEGORIES as readonly string[]).includes(sig.category || '')
        ? sig.category
        : 'general') as SignalCategory

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
  const page = Math.max(parseInt(url.searchParams.get('page') || '1'), 1)
  const category = url.searchParams.get('category')
  const regionId = url.searchParams.get('region')
  const source = url.searchParams.get('source')
  const severityLabel = url.searchParams.get('severityLabel')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (category && (VALID_CATEGORIES as readonly string[]).includes(category)) {
    where.category = { equals: category }
  }
  if (regionId) where.regionId = { equals: regionId }
  if (source) where.source = { equals: source }
  if (severityLabel && ['info', 'moderate', 'severe', 'extreme'].includes(severityLabel)) {
    where.severityLabel = { equals: severityLabel }
  }

  const signals = await payload.find({
    collection: 'signals',
    where: Object.keys(where).length > 0 ? where : undefined,
    limit,
    page,
    sort: '-createdAt',
  })

  // Merge the worker-managed `regions` text[] column (added by the cyber CVE
  // de-dup, roc#10) onto each doc. It is not part of the Payload collection
  // schema, so `find` does not return it — read it raw and zip it in by id.
  // A single de-duped CVE carries every affected city in this array.
  try {
    const ids = (signals.docs as Array<{ id: number }>).map((d) => d.id)
    if (ids.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const drizzle = (payload.db as any).drizzle
      const res = await drizzle.execute(
        sql`SELECT id, regions FROM signals WHERE id IN (${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      )
      const rows: Array<{ id: number; regions: string[] | null }> = res.rows || res
      const regionsById = new Map<number, string[]>()
      for (const r of rows) {
        if (Array.isArray(r.regions) && r.regions.length > 0) {
          regionsById.set(Number(r.id), r.regions)
        }
      }
      for (const doc of signals.docs as Array<{ id: number; regions?: string[] }>) {
        const regions = regionsById.get(doc.id)
        if (regions) doc.regions = regions
      }
    }
  } catch {
    // Non-fatal: if the raw read fails, signals still render without regions.
  }

  return Response.json(signals)
}

/**
 * DELETE /api/signals?older_than=48h — Purge signals older than specified duration.
 * Requires admin session or ROC API key.
 */
export async function DELETE(req: Request) {
  const rocKey = req.headers.get('x-roc-api-key')
  const isValidApiKey = rocKey && process.env.ROC_API_KEY && rocKey === process.env.ROC_API_KEY

  const payload = await getPayload({ config })

  if (!isValidApiKey) {
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

  const url = new URL(req.url)
  const hours = parseInt(url.searchParams.get('hours') || '48')
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  try {
    const old = await payload.find({
      collection: 'signals',
      where: { createdAt: { less_than: cutoff } },
      limit: 100,
      sort: 'createdAt',
    })

    let deleted = 0
    for (const doc of old.docs) {
      await payload.delete({ collection: 'signals', id: doc.id, overrideAccess: true })
      deleted++
    }

    const remaining = old.totalDocs - deleted
    return Response.json({
      deleted,
      remaining,
      cutoff,
      message: remaining > 0
        ? `Deleted ${deleted}. ${remaining} more older signals remain — call again to continue.`
        : `Deleted ${deleted}. All signals older than ${hours}h removed.`,
    })
  } catch (e) {
    return Response.json({ error: 'Purge failed' }, { status: 500 })
  }
}
