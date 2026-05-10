import React from 'react'

export default async function ScenarioDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1rem' }}>
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          fontSize: '0.8125rem',
          color: 'var(--fg-faint)',
          marginBottom: '1.5rem',
        }}
      >
        <a href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Home</a>
        <span>/</span>
        <a href="/scenarios" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Scenarios</a>
        <span>/</span>
        <span style={{ color: 'var(--fg)' }}>{slug}</span>
      </nav>

      <div
        style={{
          textAlign: 'center',
          padding: '4rem 2rem',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--fg-muted)',
        }}
      >
        <p style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem' }}>
          Coming soon
        </p>
        <p style={{ fontSize: '0.875rem' }}>
          This scenario is not yet available.
        </p>
      </div>
    </div>
  )
}
