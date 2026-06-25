import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'

/**
 * POST /api/papers/ratify — ratify a proposed corpus paper to `published` (research-029 / WFM-103).
 *
 * This is the FOREMAN/curator ratification gate for the Beacon publish flywheel (and any other
 * proposed paper). It is a thin, authenticated wrapper over `payload.update({ status: 'published' })`.
 * Going through Payload's local API (NOT a raw SQL UPDATE) is the whole point: it fires the Papers
 * `afterChange` hook, which triggers card+embed (lib/papers/cardEmbed) so the paper becomes
 * retrievable + citable in future cases.
 *
 * Curators can equivalently flip the status field in the Payload admin UI (that also fires the hook) —
 * this endpoint exists so FOREMAN has a scriptable path that still runs the hook (a raw SQL UPDATE
 * would bypass it and leave the paper un-carded).
 *
 * Headers: X-BEACON-API-KEY: <shared secret>  (same key as /api/papers/ingest — server-to-server).
 * Body: { id } | { sourceUrl } | { slug }  (one identifier required).
 */

export const runtime = 'nodejs'

interface Body {
  id?: number | string
  sourceUrl?: string
  slug?: string
}

export async function POST(req: Request) {
  const apiKey = req.headers.get('x-beacon-api-key')
  if (!apiKey || !process.env.BEACON_API_KEY || apiKey !== process.env.BEACON_API_KEY) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const payload = await getPayload({ config })

  // Resolve the paper by id, sourceUrl, or slug.
  let id: number | string | undefined = body.id
  if (!id && (body.sourceUrl || body.slug)) {
    const where: Where = body.sourceUrl
      ? { sourceUrl: { equals: body.sourceUrl } }
      : { slug: { equals: body.slug as string } }
    const found = await payload.find({ collection: 'papers', where, limit: 1, depth: 0, overrideAccess: true })
    if (found.docs.length === 0) return Response.json({ error: 'paper not found' }, { status: 404 })
    id = found.docs[0].id as number
  }
  if (id === undefined || id === null || id === '') {
    return Response.json({ error: 'Provide one of: id, sourceUrl, slug' }, { status: 400 })
  }

  let current
  try {
    current = await payload.findByID({ collection: 'papers', id, depth: 0, overrideAccess: true })
  } catch {
    return Response.json({ error: 'paper not found' }, { status: 404 })
  }
  if (!current) return Response.json({ error: 'paper not found' }, { status: 404 })

  if (current.status === 'published') {
    return Response.json({ id, status: 'published', alreadyPublished: true })
  }

  // Flip to published via the local API so the afterChange hook fires (→ card+embed).
  const updated = await payload.update({
    collection: 'papers',
    id,
    data: {
      status: 'published',
      ...(current.publishedAt ? {} : { publishedAt: new Date().toISOString() }),
    },
    overrideAccess: true,
  })

  return Response.json({ id: updated.id, status: updated.status, ratified: true })
}
