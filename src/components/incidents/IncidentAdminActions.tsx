'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  slug: string
  sevLevel: string
  status: string
}

const CLOSE_REASONS = [
  { value: 'resolved', label: 'Resolved' },
  { value: 'false_positive', label: 'False positive' },
  { value: 'merged', label: 'Merged' },
  { value: 'superseded', label: 'Superseded' },
]

const SEV_ORDER = ['SEV4', 'SEV3', 'SEV2', 'SEV1']
const stepSev = (current: string, dir: 1 | -1): string => {
  const i = SEV_ORDER.indexOf(current)
  if (i < 0) return current
  return SEV_ORDER[Math.max(0, Math.min(SEV_ORDER.length - 1, i + dir))]
}

const btnBase: React.CSSProperties = {
  fontSize: '0.8125rem',
  fontWeight: 600,
  fontFamily: "'IBM Plex Sans', sans-serif",
  padding: '0.5rem 0.875rem',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--fg)',
  cursor: 'pointer',
  transition: 'border-color 0.15s, background 0.15s',
}

export function IncidentAdminActions({ slug, sevLevel, status }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [panel, setPanel] = useState<'note' | 'close' | null>(null)
  const [noteText, setNoteText] = useState('')
  const [closeReason, setCloseReason] = useState('resolved')

  const isClosed = status === 'closed'

  async function run(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action)
    setError(null)
    try {
      const res = await fetch(`/api/incidents/${encodeURIComponent(slug)}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Request failed (${res.status})`)
      }
      setPanel(null)
      setNoteText('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  const escalateTo = stepSev(sevLevel, 1)
  const deescalateTo = stepSev(sevLevel, -1)
  const canEscalate = escalateTo !== sevLevel
  const canDeescalate = deescalateTo !== sevLevel

  return (
    <div
      style={{
        marginTop: '2rem',
        padding: '1.25rem',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.875rem',
        }}
      >
        <h2
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--fg-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: 0,
          }}
        >
          Admin Actions
        </h2>
        <span
          style={{
            fontSize: '0.625rem',
            fontWeight: 700,
            fontFamily: "'IBM Plex Mono', monospace",
            padding: '0.0625rem 0.375rem',
            borderRadius: '4px',
            background: 'var(--accent-light)',
            color: 'var(--accent)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Admin
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {!isClosed && (
          <>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => run('validate')}
              style={{ ...btnBase, borderColor: '#22d3ee44', color: '#22d3ee' }}
            >
              {busy === 'validate' ? 'Validating…' : '✓ Validate'}
            </button>

            <button
              type="button"
              disabled={busy !== null || !canEscalate}
              onClick={() => {
                if (window.confirm(`Escalate ${sevLevel} → ${escalateTo}?`)) run('escalate')
              }}
              style={{
                ...btnBase,
                borderColor: '#ef444444',
                color: '#ef4444',
                opacity: canEscalate ? 1 : 0.4,
                cursor: canEscalate ? 'pointer' : 'not-allowed',
              }}
            >
              {busy === 'escalate' ? 'Escalating…' : `↑ Escalate${canEscalate ? ` → ${escalateTo}` : ''}`}
            </button>

            <button
              type="button"
              disabled={busy !== null || !canDeescalate}
              onClick={() => {
                if (window.confirm(`De-escalate ${sevLevel} → ${deescalateTo}?`)) run('de-escalate')
              }}
              style={{
                ...btnBase,
                borderColor: '#10b98144',
                color: '#10b981',
                opacity: canDeescalate ? 1 : 0.4,
                cursor: canDeescalate ? 'pointer' : 'not-allowed',
              }}
            >
              {busy === 'de-escalate' ? 'De-escalating…' : `↓ De-escalate${canDeescalate ? ` → ${deescalateTo}` : ''}`}
            </button>

            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setPanel(panel === 'note' ? null : 'note')}
              style={{ ...btnBase, ...(panel === 'note' ? { borderColor: 'var(--accent)' } : {}) }}
            >
              ✎ Add Note
            </button>

            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setPanel(panel === 'close' ? null : 'close')}
              style={{ ...btnBase, ...(panel === 'close' ? { borderColor: 'var(--accent)' } : {}) }}
            >
              ✖ Close
            </button>
          </>
        )}

        {isClosed && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              if (window.confirm('Reopen this incident?')) run('reopen')
            }}
            style={{ ...btnBase, borderColor: '#f9731644', color: '#f97316' }}
          >
            {busy === 'reopen' ? 'Reopening…' : '↺ Reopen'}
          </button>
        )}
      </div>

      {/* Add Note panel */}
      {panel === 'note' && (
        <div style={{ marginTop: '0.875rem' }}>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note to the incident timeline…"
            rows={3}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '0.625rem',
              color: 'var(--fg)',
              fontSize: '0.875rem',
              fontFamily: "'IBM Plex Sans', sans-serif",
              resize: 'vertical',
              outline: 'none',
            }}
          />
          <div style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              disabled={busy !== null || !noteText.trim()}
              onClick={() => run('add_note', { note: noteText.trim() })}
              style={{
                ...btnBase,
                background: noteText.trim() ? 'var(--accent)' : 'var(--bg-card)',
                color: noteText.trim() ? 'var(--bg)' : 'var(--fg-faint)',
                borderColor: 'transparent',
                cursor: noteText.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              {busy === 'add_note' ? 'Saving…' : 'Save Note'}
            </button>
          </div>
        </div>
      )}

      {/* Close panel */}
      {panel === 'close' && (
        <div style={{ marginTop: '0.875rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>Reason:</span>
          <select
            value={closeReason}
            onChange={(e) => setCloseReason(e.target.value)}
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '0.4375rem 0.625rem',
              color: 'var(--fg)',
              fontSize: '0.8125rem',
              fontFamily: "'IBM Plex Sans', sans-serif",
              outline: 'none',
            }}
          >
            {CLOSE_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run('close', { reason: closeReason })}
            style={{ ...btnBase, borderColor: '#64748b66', color: 'var(--fg)' }}
          >
            {busy === 'close' ? 'Closing…' : 'Confirm Close'}
          </button>
        </div>
      )}

      {error && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: '#ef4444' }}>{error}</div>
      )}
    </div>
  )
}
