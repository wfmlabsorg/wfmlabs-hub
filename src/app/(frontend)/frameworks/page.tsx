import React from 'react'

export const metadata = { title: 'Frameworks' }

export default function FrameworksBrowsePage() {
  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Frameworks
        </h1>
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.9375rem' }}>
          Structured thinking models and decision frameworks for workforce management.
        </p>
      </div>

      <div
        style={{
          textAlign: 'center',
          padding: '4rem 2rem',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--fg-muted)',
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.3 }}>&#9881;</div>
        <p style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem' }}>
          Coming soon
        </p>
        <p style={{ fontSize: '0.875rem' }}>
          Frameworks collection is under development. Check back soon.
        </p>
      </div>
    </div>
  )
}
