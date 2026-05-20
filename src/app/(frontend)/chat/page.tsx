import React from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { auth } from '@/lib/auth'
import { ChatPanel } from '@/components/chat'

export const metadata = { title: 'Community Chat — WFM Labs Hub' }
export const dynamic = 'force-dynamic'

const domainColors: Record<string, string> = {
  weather: '#3b82f6',
  seismic: '#ef4444',
  disaster: '#f97316',
  infrastructure: '#8b5cf6',
  cyber: '#22c55e',
  health: '#ec4899',
  financial: '#f59e0b',
  environmental: '#14b8a6',
  geopolitical: '#dc2626',
  general: '#64748b',
  events: '#64748b',
}

const categoryIcons: Record<string, string> = {
  weather: '\u26c8',
  seismic: '\u26a0',
  disaster: '\ud83c\udf0a',
  events: '\ud83d\udce1',
  cyber: '\ud83d\udee1',
  infrastructure: '\u26a1',
  health: '\ud83c\udfe5',
  financial: '\ud83d\udcca',
  environmental: '\ud83c\udf3f',
  general: '\u25c6',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default async function ChatPage() {
  const session = await auth()
  const payload = await getPayload({ config })

  // Fetch recent signals for activity feed
  const recentSignals = await payload.find({
    collection: 'signals',
    limit: 30,
    sort: '-createdAt',
    depth: 0,
    overrideAccess: true,
  })

  const isAuthenticated = !!session?.user?.payloadMemberId

  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1
          style={{
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: 800,
            marginBottom: '0.5rem',
          }}
        >
          Community Chat
        </h1>
        <p style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', margin: 0 }}>
          {isAuthenticated
            ? 'Real-time community channel — powered by Ably'
            : 'Sign in to join the conversation'}
        </p>
      </div>

      {/* Two-column layout: Chat (primary) + Activity Feed (secondary) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isAuthenticated ? '1fr 22rem' : '1fr',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        {/* Chat Panel */}
        {isAuthenticated ? (
          <ChatPanel
            channel="community:general"
            style={{ height: 'calc(100vh - 14rem)', minHeight: '500px' }}
          />
        ) : (
          <div
            style={{
              padding: '3rem 2rem',
              textAlign: 'center',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--bg-card)',
            }}
          >
            <p style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '0.75rem' }}>
              Join the conversation
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', marginBottom: '1.25rem' }}>
              Sign in to chat with the community and interact with AI agents in real time.
            </p>
            <a
              href="/login"
              style={{
                display: 'inline-block',
                padding: '0.5rem 1.25rem',
                background: '#22d3ee',
                color: '#0b1120',
                borderRadius: '0.5rem',
                fontWeight: 600,
                fontSize: '0.875rem',
                textDecoration: 'none',
              }}
            >
              Sign In
            </a>
          </div>
        )}

        {/* Activity Feed sidebar */}
        <div>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--fg-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.75rem',
            }}
          >
            Recent Agent Activity
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              maxHeight: isAuthenticated ? 'calc(100vh - 16rem)' : 'none',
              overflowY: isAuthenticated ? 'auto' : 'visible',
            }}
          >
            {recentSignals.docs.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2rem 1rem',
                  border: '1px dashed var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  color: 'var(--fg-muted)',
                  fontSize: '0.8125rem',
                }}
              >
                No agent activity yet
              </div>
            ) : (
              recentSignals.docs.map((sig, i) => {
                const color =
                  domainColors[(sig.category as string) || 'general'] || domainColors.general
                const icon =
                  categoryIcons[(sig.category as string) || 'general'] || categoryIcons.general
                return (
                  <div
                    key={sig.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.625rem',
                      padding: '0.5rem 0.625rem',
                      borderRadius:
                        i === 0
                          ? 'var(--radius-lg) var(--radius-lg) 0 0'
                          : i === recentSignals.docs.length - 1
                            ? '0 0 var(--radius-lg) var(--radius-lg)'
                            : '0',
                      background: 'var(--bg-card)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <span style={{ fontSize: '0.8125rem', flexShrink: 0, marginTop: '0.0625rem' }}>
                      {icon}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--fg)',
                          lineHeight: 1.4,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                          {(sig as unknown as Record<string, unknown>).source as string}
                        </span>{' '}
                        <a
                          href="/signals"
                          style={{
                            color: 'var(--fg)',
                            fontWeight: 500,
                            textDecoration: 'none',
                          }}
                        >
                          {sig.title}
                        </a>
                      </div>
                      <div
                        style={{
                          fontSize: '0.625rem',
                          color: 'var(--fg-faint)',
                          display: 'flex',
                          gap: '0.375rem',
                          marginTop: '0.0625rem',
                        }}
                      >
                        <span style={{ color, fontWeight: 500 }}>
                          {(sig.category as string) || 'general'}
                        </span>
                        <span>{timeAgo(sig.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
