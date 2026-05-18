import React from 'react'

export const metadata = { title: 'Chat — WFM Labs Hub' }

export default function ChatPage() {
  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Chat
        </h1>
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.9rem', lineHeight: 1.6, maxWidth: '48rem' }}>
          Talk to ROC agents directly. Ask questions about operational risk, workforce disruptions,
          travel advisories, and geopolitical events — powered by the same intelligence pipeline
          that drives Mission Control.
        </p>
      </div>

      <div style={{
        textAlign: 'center',
        padding: '4rem 2rem',
        border: '1px dashed var(--border)',
        borderRadius: 'var(--radius-lg)',
        color: 'var(--fg-muted)',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.3 }}>&#x1F4AC;</div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Coming soon</h2>
        <p style={{ fontSize: '0.875rem', maxWidth: '28rem', margin: '0 auto', lineHeight: 1.6 }}>
          ROC agents will be available for conversational queries across all 12 domains.
          Ask Compass for workforce strategy, Atlas for geopolitical context, or Beacon for
          real-time signal analysis.
        </p>
      </div>
    </div>
  )
}
