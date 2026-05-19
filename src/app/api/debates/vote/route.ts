import { getPayload } from 'payload'
import config from '@payload-config'
import { getPool } from '@/lib/db'

export async function POST(req: Request) {
  const payload = await getPayload({ config })

  // Authenticate member
  const cookieHeader = req.headers.get('cookie') || ''
  const headers = new Headers()
  headers.set('cookie', cookieHeader)

  let memberId: number | null = null
  try {
    const { user } = await payload.auth({ headers })
    if (user) memberId = user.id as number
  } catch {
    // not logged in
  }

  if (!memberId) {
    return Response.json({ error: 'Must be logged in to vote' }, { status: 401 })
  }

  const body = await req.json() as { debateId: number; position: string; comment?: string }

  if (!body.debateId || !body.position) {
    return Response.json({ error: 'debateId and position required' }, { status: 400 })
  }

  if (!['advocate', 'challenger'].includes(body.position)) {
    return Response.json({ error: 'position must be advocate or challenger' }, { status: 400 })
  }

  // Verify debate exists and is in voting state
  const debate = await payload.findByID({
    collection: 'debates',
    id: body.debateId,
    depth: 0,
    overrideAccess: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any

  if (!debate) {
    return Response.json({ error: 'Debate not found' }, { status: 404 })
  }

  if (debate.status !== 'voting') {
    return Response.json({ error: 'Debate is not currently accepting votes' }, { status: 400 })
  }

  // Check if voting period has ended
  if (debate.votingClosesAt && new Date(debate.votingClosesAt) < new Date()) {
    return Response.json({ error: 'Voting period has ended' }, { status: 400 })
  }

  const pool = getPool()

  try {
    // Upsert vote (one per member per debate)
    const existing = await pool.query(
      'SELECT id, position FROM debate_votes WHERE debate_id = $1 AND member_id = $2',
      [body.debateId, memberId],
    )

    if (existing.rows.length > 0) {
      const oldPosition = existing.rows[0].position
      if (oldPosition === body.position) {
        return Response.json({ error: 'Already voted for this position', existing: true }, { status: 409 })
      }
      // Change vote
      await pool.query(
        'UPDATE debate_votes SET position = $1, comment = $2, created_at = NOW() WHERE debate_id = $3 AND member_id = $4',
        [body.position, body.comment || null, body.debateId, memberId],
      )
      // Update counts: decrement old, increment new
      const advDelta = body.position === 'advocate' ? 1 : -1
      const chaDelta = body.position === 'challenger' ? 1 : -1
      await payload.update({
        collection: 'debates',
        id: body.debateId,
        data: {
          advocateVotes: Math.max(0, (debate.advocateVotes || 0) + advDelta),
          challengerVotes: Math.max(0, (debate.challengerVotes || 0) + chaDelta),
        },
        overrideAccess: true,
      })
    } else {
      // New vote
      await pool.query(
        'INSERT INTO debate_votes (debate_id, member_id, position, comment) VALUES ($1, $2, $3, $4)',
        [body.debateId, memberId, body.position, body.comment || null],
      )
      // Increment count
      await payload.update({
        collection: 'debates',
        id: body.debateId,
        data: {
          advocateVotes: (debate.advocateVotes || 0) + (body.position === 'advocate' ? 1 : 0),
          challengerVotes: (debate.challengerVotes || 0) + (body.position === 'challenger' ? 1 : 0),
        },
        overrideAccess: true,
      })
    }

    return Response.json({ success: true, position: body.position })
  } catch (e) {
    console.error('Vote error:', e)
    return Response.json({ error: 'Failed to record vote' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const debateId = url.searchParams.get('debateId')
  if (!debateId) return Response.json({ error: 'debateId required' }, { status: 400 })

  const pool = getPool()
  const result = await pool.query(
    'SELECT position, comment, created_at FROM debate_votes WHERE debate_id = $1 ORDER BY created_at DESC LIMIT 50',
    [parseInt(debateId)],
  )

  return Response.json({ votes: result.rows })
}
