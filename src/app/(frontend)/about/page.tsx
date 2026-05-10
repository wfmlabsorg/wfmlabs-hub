import React from 'react'

export const metadata = { title: 'About' }

export default function AboutPage() {
  return (
    <div style={{ maxWidth: '42rem', margin: '0 auto', padding: '3rem 1rem' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '1.5rem' }}>
        About <span style={{ color: 'var(--accent)' }}>WFM Labs</span> Hub
      </h1>

      <div style={{ fontSize: '0.9375rem', lineHeight: 1.8, color: 'var(--fg-muted)' }}>
        <p style={{ marginBottom: '1.25rem' }}>
          WFM Labs Hub is a practitioner workspace for workforce management professionals.
          It brings together research, tools, knowledge, and community in one place — built
          by practitioners, for practitioners.
        </p>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--fg)', marginTop: '2rem', marginBottom: '0.75rem' }}>
          What you&apos;ll find here
        </h2>

        <ul style={{ paddingLeft: '1.25rem', marginBottom: '1.25rem' }}>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong style={{ color: 'var(--fg)' }}>Wiki</strong> — A knowledge base of WFM concepts,
            processes, metrics, and frameworks. Collaboratively maintained and continuously refined.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong style={{ color: 'var(--fg)' }}>Research</strong> — Curated academic papers and
            industry reports with practitioner commentary explaining why they matter.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong style={{ color: 'var(--fg)' }}>Tools</strong> — Interactive calculators, planning
            utilities, and analytical tools for capacity planning, forecasting, and scheduling.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong style={{ color: 'var(--fg)' }}>Articles</strong> — Thought pieces and practitioner
            perspectives on workforce management trends and techniques.
          </li>
          <li style={{ marginBottom: '0.5rem' }}>
            <strong style={{ color: 'var(--fg)' }}>Compass</strong> — The Contact Center Compass
            newsletter archive — weekly insights on WFM trends, tools, and techniques.
          </li>
        </ul>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--fg)', marginTop: '2rem', marginBottom: '0.75rem' }}>
          Built different
        </h2>

        <p style={{ marginBottom: '1.25rem' }}>
          This isn&apos;t another vendor platform or generic community forum. WFM Labs Hub is a
          purpose-built workspace where practitioners can find validated knowledge, test tools,
          and contribute to the field. Every asset goes through a maturity lifecycle — from draft
          to published to refined to mature — ensuring quality through community review.
        </p>

        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--fg)', marginTop: '2rem', marginBottom: '0.75rem' }}>
          The stack
        </h2>

        <p>
          Built with Next.js and Payload CMS. Open infrastructure for an open community.
        </p>
      </div>
    </div>
  )
}
