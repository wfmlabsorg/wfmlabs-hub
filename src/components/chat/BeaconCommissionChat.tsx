'use client'

import React, { useCallback, useState } from 'react'
import { useSession } from 'next-auth/react'
import { ChatProvider } from './ChatProvider'
import { ChatPanel } from './ChatPanel'

/**
 * Commission Beacon — the member-facing surface for a commissioned research session (WFM-71).
 *
 * Runs in the member's private DM channel `dm:beacon:<memberId>` over the existing Ably chat.
 * After the member sends, it triggers POST /api/beacon/respond, which runs the six-step
 * commissioned session and posts Beacon's reply back into the channel (it arrives via Ably).
 * Premium gating + retrieval + the no-fabrication rails live server-side in the responder.
 */
export function BeaconCommissionChat() {
  const { data: session, status } = useSession()
  const memberId = session?.user?.payloadMemberId
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const channel = memberId ? `dm:beacon:${memberId}` : ''

  const onAfterSend = useCallback(async () => {
    if (!channel) return
    setError(null)
    setThinking(true)
    try {
      const res = await fetch('/api/beacon/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel }),
      })
      if (res.status === 402) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setError(j.error || 'Commissioned research sessions are a premium feature.')
      } else if (!res.ok) {
        setError('Beacon hit a snag answering that. Give it another try in a moment.')
      }
    } catch {
      setError('Beacon is unreachable right now.')
    } finally {
      setThinking(false)
    }
  }, [channel])

  if (status === 'loading') {
    return <div style={{ color: '#64748b', fontSize: '0.875rem', padding: '1rem 0' }}>Loading…</div>
  }

  if (!memberId) {
    return (
      <div
        style={{
          background: '#111827',
          border: '1px solid #1e293b',
          borderRadius: '0.75rem',
          padding: '1.25rem 1.5rem',
          color: '#94a3b8',
          fontSize: '0.9rem',
        }}
      >
        <strong style={{ color: '#f1f5f9' }}>Commission Beacon</strong> — bring a real decision and
        Beacon builds you a defensible, cited position.{' '}
        <a href="/login" style={{ color: '#22d3ee' }}>
          Sign in
        </a>{' '}
        to start a session.
      </div>
    )
  }

  return (
    <ChatProvider>
      <div
        style={{
          background: '#0b1120',
          border: '1px solid #1e293b',
          borderRadius: '0.75rem',
          padding: '1.25rem 1.5rem 1rem',
          marginBottom: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span
            style={{
              fontSize: '0.625rem',
              fontWeight: 700,
              background: '#a78bfa22',
              color: '#a78bfa',
              border: '1px solid #a78bfa44',
              borderRadius: '0.25rem',
              padding: '0.0625rem 0.375rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Agent
          </span>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9' }}>
            Commission Beacon
          </h2>
        </div>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.55 }}>
          Bring me the problem you&apos;re trying to solve — a metric you&apos;re designing, a decision
          you need to defend, a practice you&apos;re unsure works. I&apos;ll pull the research that bears
          on it, rate how strong the evidence is, steelman the other side, and hand you a{' '}
          <strong style={{ color: '#cbd5e1' }}>Defensible Position Brief</strong> — including where the
          evidence runs out. Your session is private. I show my sources and I never invent a citation.
        </p>
      </div>

      {error && (
        <div
          style={{
            background: '#451a0333',
            border: '1px solid #f59e0b44',
            borderRadius: '0.5rem',
            padding: '0.625rem 0.875rem',
            color: '#f59e0b',
            fontSize: '0.85rem',
            marginBottom: '0.75rem',
          }}
        >
          {error}
        </div>
      )}

      <ChatPanel
        channel={channel}
        onAfterSend={onAfterSend}
        agentThinking={thinking}
        thinkingLabel="Beacon is searching the library and weighing the evidence…"
        headerLabel="Beacon — commissioned session"
        placeholder="Describe the decision you need to defend…"
        style={{ height: '560px' }}
      />

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }`}</style>
    </ChatProvider>
  )
}
