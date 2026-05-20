'use client'

import React, { useState } from 'react'

export interface PollOption {
  key: string
  label: string
}

export interface PollMessageProps {
  body: string
  options: PollOption[]
  incidentSlug?: string
  pollType?: string
  messageId?: string
  onRespond?: (key: string) => void
}

export function PollMessage({
  body,
  options,
  incidentSlug,
  pollType,
  messageId,
  onRespond,
}: PollMessageProps) {
  const [responded, setResponded] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async (option: PollOption) => {
    if (responded || loading) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/chat/poll-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incidentSlug,
          pollType,
          response: option.key,
          messageId,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || `HTTP ${res.status}`)
      }

      setResponded(option.key)
      onRespond?.(option.key)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit response')
    } finally {
      setLoading(false)
    }
  }

  const respondedOption = options.find((o) => o.key === responded)

  return (
    <div
      style={{
        background: '#1e293b',
        border: '1px solid #22d3ee33',
        borderRadius: '0.75rem',
        padding: '0.75rem 1rem',
        maxWidth: '80%',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.625rem',
      }}
    >
      {/* Poll badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
        <span
          style={{
            fontSize: '0.625rem',
            fontWeight: 700,
            background: '#22d3ee22',
            color: '#22d3ee',
            border: '1px solid #22d3ee44',
            borderRadius: '0.25rem',
            padding: '0.0625rem 0.375rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Poll
        </span>
      </div>

      {/* Question */}
      <p
        style={{
          margin: 0,
          fontSize: '0.875rem',
          color: '#f1f5f9',
          lineHeight: 1.5,
        }}
      >
        {body}
      </p>

      {/* Response state */}
      {responded ? (
        <div
          style={{
            fontSize: '0.8125rem',
            color: '#22d3ee',
            fontWeight: 600,
          }}
        >
          Responded: {respondedOption?.label ?? responded}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {options.map((option) => (
            <button
              key={option.key}
              onClick={() => handleClick(option)}
              disabled={loading}
              style={{
                padding: '0.4375rem 0.875rem',
                background: loading ? '#0f172a' : '#0e3a4a',
                color: loading ? '#64748b' : '#22d3ee',
                border: '1px solid #22d3ee44',
                borderRadius: '0.5rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: loading ? 'default' : 'pointer',
                textAlign: 'left',
                fontFamily: "'IBM Plex Sans', sans-serif",
                transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  ;(e.currentTarget as HTMLButtonElement).style.background = '#164e63'
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  ;(e.currentTarget as HTMLButtonElement).style.background = '#0e3a4a'
                }
              }}
            >
              {loading ? '…' : option.label}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div style={{ fontSize: '0.75rem', color: '#f87171' }}>{error}</div>
      )}
    </div>
  )
}
