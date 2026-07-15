import React from 'react'

/**
 * Visible degraded state for live-data surfaces when the upstream fetch fails.
 * Deliberately NOT the same as an empty state — members must be able to tell
 * "no incidents" apart from "the feed is down".
 */
export function DataUnavailable({
  title = 'Live data temporarily unavailable',
  detail = 'The data feed could not be reached just now. This is a connection issue, not an all-clear — please refresh in a moment.',
}: {
  title?: string
  detail?: string
}) {
  return (
    <div
      role="alert"
      style={{
        textAlign: 'center',
        padding: '3rem 2rem',
        border: '1px solid rgba(245,158,11,0.35)',
        background: 'rgba(245,158,11,0.06)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div
        style={{
          fontSize: '0.6875rem',
          fontWeight: 700,
          fontFamily: "'IBM Plex Mono', monospace",
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: '#f59e0b',
          marginBottom: '0.625rem',
        }}
      >
        ⚠ Feed degraded
      </div>
      <p style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.5rem' }}>{title}</p>
      <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', margin: 0, lineHeight: 1.5 }}>{detail}</p>
    </div>
  )
}
