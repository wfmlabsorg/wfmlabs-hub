import { getPayload } from 'payload'
import config from '@payload-config'

/**
 * Signal purge cron — runs daily at 06:00 UTC via Vercel Cron (see `vercel.json`).
 * Deletes signals older than 192 hours (8 days). Processes in batches of 100.
 *
 * Why 192 h: the OVIX op-risk index reads a 168 h (7-day) window of signals, so the
 * previous 48 h retention made the "7-day" score a 2–3-day score and corrupted its
 * baseline (2026-10-12 audit). 192 h = 168 h window + 24 h slack for the daily cron.
 *
 * Also callable manually:
 *   GET /api/signals/purge?hours=192
 *
 * Requires CRON_SECRET header (Vercel injects this for cron jobs)
 * or admin session.
 */

const RETENTION_HOURS = 192
const BATCH_SIZE = 100

export async function GET(req: Request) {
  // Vercel cron sends CRON_SECRET header automatically
  const cronSecret = req.headers.get('authorization')
  const isVercelCron = cronSecret === `Bearer ${process.env.CRON_SECRET}`
  const rocKey = req.headers.get('x-roc-api-key')
  const isRocKey = rocKey && process.env.ROC_API_KEY && rocKey === process.env.ROC_API_KEY

  const payload = await getPayload({ config })

  if (!isVercelCron && !isRocKey) {
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
  const hours = parseInt(url.searchParams.get('hours') || String(RETENTION_HOURS))
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  let totalDeleted = 0

  try {
    // Process in batches to stay within function time limits
    let hasMore = true
    while (hasMore) {
      const old = await payload.find({
        collection: 'signals',
        where: { createdAt: { less_than: cutoff } },
        limit: BATCH_SIZE,
        sort: 'createdAt',
      })

      if (old.docs.length === 0) {
        hasMore = false
        break
      }

      for (const doc of old.docs) {
        await payload.delete({ collection: 'signals', id: doc.id, overrideAccess: true })
        totalDeleted++
      }

      // If we got a full batch, there might be more
      hasMore = old.docs.length === BATCH_SIZE
    }

    return Response.json({
      purged: totalDeleted,
      retentionHours: hours,
      cutoff,
      message: totalDeleted > 0
        ? `Purged ${totalDeleted} signals older than ${hours}h`
        : `No signals older than ${hours}h to purge`,
    })
  } catch (e) {
    console.error('Signal purge error:', e)
    return Response.json({ error: 'Purge failed' }, { status: 500 })
  }
}
