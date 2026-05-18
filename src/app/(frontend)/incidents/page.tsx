import React from 'react'

export const metadata = { title: 'Incidents — WFM Labs Hub' }

export default function IncidentsPage() {
  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Incidents
        </h1>
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.9rem', lineHeight: 1.6, maxWidth: '48rem' }}>
          Validated operational events tracked by Watchkeeper. Each incident is declared when severity thresholds are met,
          monitored through its lifecycle, and resolved when impact subsides.
        </p>
      </div>

      {/* Placeholder — coming soon */}
      <div style={{
        textAlign: 'center',
        padding: '4rem 2rem',
        border: '1px dashed var(--border)',
        borderRadius: 'var(--radius-lg)',
        color: 'var(--fg-muted)',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.3 }}>🛡</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Coming soon</h2>
        <p style={{ fontSize: '0.875rem', maxWidth: '28rem', margin: '0 auto', lineHeight: 1.6 }}>
          Watchkeeper will declare and track incidents across all ROC domains.
          Active incidents will appear here with severity, timeline, affected regions, and resolution status.
        </p>
      </div>
    </div>
  )
}
