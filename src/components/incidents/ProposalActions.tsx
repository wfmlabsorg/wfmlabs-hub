'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

// Confirm / Dismiss for a PROPOSED incident (phase 4). Admin only — the server route re-checks.
// Confirm opens the incident (status open, declared now). Dismiss needs a reason and hides it for good.
interface Props {
  id: number
  compact?: boolean
}

const btn: React.CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  fontFamily: "'IBM Plex Sans', sans-serif",
  padding: '0.45rem 0.8rem',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--fg)',
  cursor: 'pointer',
}

export function ProposalActions({ id, compact }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dismissing, setDismissing] = useState(false)
  const [reason, setReason] = useState('')

  async function run(action: 'confirm' | 'dismiss') {
    setBusy(action)
    setError(null)
    try {
      const res = await fetch(`/api/desk-proposals/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: action === 'dismiss' ? reason : undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Request failed (${res.status})`)
      }
      setDismissing(false)
      setReason('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginTop: compact ? '0.5rem' : '1rem' }}>
      <button type="button" style={{ ...btn, borderColor: 'rgba(34,211,238,0.5)', color: '#22d3ee' }} disabled={busy !== null} onClick={() => run('confirm')}>
        {busy === 'confirm' ? 'Confirming…' : 'Confirm as incident'}
      </button>
      {!dismissing ? (
        <button type="button" style={btn} disabled={busy !== null} onClick={() => setDismissing(true)}>
          Dismiss…
        </button>
      ) : (
        <>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why (required)"
            aria-label="Dismiss reason"
            style={{ ...btn, fontWeight: 400, minWidth: '14rem', cursor: 'text' }}
          />
          <button type="button" style={{ ...btn, borderColor: 'rgba(239,68,68,0.5)', color: '#ef4444' }} disabled={busy !== null || !reason.trim()} onClick={() => run('dismiss')}>
            {busy === 'dismiss' ? 'Dismissing…' : 'Dismiss'}
          </button>
          <button type="button" style={{ ...btn, color: 'var(--fg-muted)' }} disabled={busy !== null} onClick={() => { setDismissing(false); setReason('') }}>
            Cancel
          </button>
        </>
      )}
      {error && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{error}</span>}
    </div>
  )
}
