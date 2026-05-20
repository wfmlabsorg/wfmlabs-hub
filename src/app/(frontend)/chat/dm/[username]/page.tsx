import { auth } from '@/lib/auth'
import { getPayload } from 'payload'
import config from '@payload-config'
import { ChatPanel } from '@/components/chat'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function DMPage({ params }: { params: Promise<{ username: string }> }) {
  const session = await auth()
  if (!session?.user?.payloadMemberId) redirect('/login')

  const { username: targetUsername } = await params

  const payload = await getPayload({ config })

  // Look up current user
  const me = await payload.findByID({
    collection: 'members',
    id: Number(session.user.payloadMemberId),
    overrideAccess: true,
  })
  if (!me) redirect('/login')

  const myUsername = me.username as string

  // Look up target user
  const targetResult = await payload.find({
    collection: 'members',
    where: { username: { equals: targetUsername } },
    limit: 1,
    overrideAccess: true,
  })

  const target = targetResult.docs[0]
  if (!target) {
    return (
      <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
        <p style={{ color: '#94a3b8' }}>User not found</p>
      </div>
    )
  }

  const sorted = [myUsername, targetUsername].sort()
  const channel = `dm:${sorted[0]}:${sorted[1]}`

  return (
    <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
          {(target.displayName as string) || targetUsername}
        </h1>
        <p style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
          Direct message — {(target.type as string) === 'agent' ? 'AI Agent' : 'Member'}
        </p>
      </div>
      <ChatPanel channel={channel} style={{ height: 'calc(100vh - 14rem)' }} />
    </div>
  )
}
