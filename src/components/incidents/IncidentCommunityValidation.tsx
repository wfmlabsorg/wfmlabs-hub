'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  slug: string
  confirmations: number
  denials: number
  loggedIn: boolean
  hasVoted: boolean
}

export function IncidentCommunityValidation({
  slug,
  confirmations,
  denials,
  loggedIn,
  hasVoted,
}: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [voted, setVoted] = useState(hasVoted)

  async function respond(affected: boolean) {
    setBusy(affected ? 'yes' : 'no')
    setError(null)
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(slug)}/affected`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affected }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 409) {
          setVoted(true)
          throw new Error('You already responded to this incident.')
        }
        throw new Error(data.error || `Request failed (${res.status})`)
      }
      setVoted(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record response')
    } finally {
      setBusy(null)
    }
  }

  const total = confirmations + denials

  return (
    <div
      style={{
        padding: '1.25rem',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        marginBottom: '2rem',
      }}
    >
      <div
        style={{
          fontSize: '0.6875rem',
          fontWeight: 600,
          color: 'var(--fg-faint)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.5rem',
        }}
      >
        Community Validation
      </div>

      {!loggedIn ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', margin: 0 }}>
          <a href="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Sign in
          </a>{' '}
          to confirm whether your operations are affected.
        </p>
      ) : voted ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', margin: '0 0 0.5rem' }}>
          Thanks — your response was recorded.
        </p>
      ) : (
        <>
          <p style={{ fontSize: '0.9375rem', color: 'var(--fg)', margin: '0 0 0.75rem' }}>
            Are your operations affected by this incident?
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => respond(true)}
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                fontFamily: "'IBM Plex Sans', sans-serif",
                padding: '0.5rem 1.25rem',
                borderRadius: 'var(--radius)',
                border: '1px solid #10b98144',
                background: 'rgba(16,185,129,0.08)',
                color: '#10b981',
                cursor: busy ? 'default' : 'pointer',
              }}
            >
              {busy === 'yes' ? 'Saving…' : 'Yes, affected'}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => respond(false)}
              style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                fontFamily: "'IBM Plex Sans', sans-serif",
                padding: '0.5rem 1.25rem',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--fg-muted)',
                cursor: busy ? 'default' : 'pointer',
              }}
            >
              {busy === 'no' ? 'Saving…' : 'Not affected'}
            </button>
          </div>
        </>
      )}

      {/* Counts */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginTop: '0.875rem',
          fontSize: '0.8125rem',
        }}
      >
        <span style={{ color: '#10b981' }}>{confirmations} confirmed affected</span>
        <span style={{ color: 'var(--fg-faint)' }}>{denials} not affected</span>
        {total > 0 && <span style={{ color: 'var(--fg-faint)', marginLeft: 'auto' }}>{total} responses</span>}
      </div>

      {error && (
        <div style={{ marginTop: '0.625rem', fontSize: '0.8125rem', color: '#ef4444' }}>{error}</div>
      )}
    </div>
  )
}
