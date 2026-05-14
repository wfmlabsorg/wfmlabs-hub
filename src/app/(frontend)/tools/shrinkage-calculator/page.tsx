import { Metadata } from 'next'
import { ShrinkageCalculator } from '@/components/tools/ShrinkageCalculator'

export const metadata: Metadata = {
  title: 'Shrinkage Impact Calculator | WFM Labs',
  description:
    'Calculate how workforce shrinkage impacts staffing requirements and costs. Model planned and unplanned shrinkage categories to understand FTE and budget impact.',
}

export default function ShrinkageCalculatorPage() {
  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Breadcrumbs */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          fontSize: '0.8125rem',
          color: 'var(--fg-faint)',
          marginBottom: '1rem',
        }}
      >
        <a href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>
          Home
        </a>
        <span>/</span>
        <a href="/tools" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>
          Tools
        </a>
        <span>/</span>
        <span style={{ color: 'var(--fg)' }}>Shrinkage Calculator</span>
      </nav>

      {/* Header badges */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.25rem 0.625rem',
            fontSize: '0.6875rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            borderRadius: '9999px',
            background: '#f59e0b20',
            color: '#f59e0b',
          }}
        >
          Capacity Planning
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.25rem 0.625rem',
            fontSize: '0.6875rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            borderRadius: '9999px',
            background: '#10b98120',
            color: '#10b981',
          }}
        >
          Published
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.25rem 0.625rem',
            fontSize: '0.6875rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            borderRadius: '9999px',
            background: '#3b82f620',
            color: '#3b82f6',
          }}
        >
          Free
        </span>
      </div>

      {/* Title */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.2, marginBottom: '0.5rem' }}>
          Shrinkage Impact Calculator
        </h1>
        <p style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', lineHeight: 1.6, maxWidth: '48rem' }}>
          Model how planned and unplanned shrinkage categories compound to affect your staffing
          requirements and operating costs. Adjust individual categories to see real-time impact on
          FTE demand and annual budget.
        </p>
      </div>

      {/* Calculator */}
      <ShrinkageCalculator />

      {/* Methodology */}
      <div
        style={{
          marginTop: '3rem',
          paddingTop: '2rem',
          borderTop: '1px solid var(--border)',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Methodology</h2>
        <div style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', lineHeight: 1.7, maxWidth: '48rem' }}>
          <p style={{ marginBottom: '1rem' }}>
            <strong style={{ color: 'var(--fg)' }}>Shrinkage</strong> is the percentage of paid time
            during which agents are unavailable to handle customer contacts. It divides into two
            groups:
          </p>
          <ul style={{ paddingLeft: '1.25rem', marginBottom: '1rem' }}>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong style={{ color: 'var(--fg)' }}>Planned shrinkage</strong> — scheduled
              activities like breaks, training, PTO, and meetings. Predictable and budgetable.
            </li>
            <li>
              <strong style={{ color: 'var(--fg)' }}>Unplanned shrinkage</strong> — unscheduled
              absences, tardiness, extended breaks, system outages. Harder to forecast and control.
            </li>
          </ul>
          <p style={{ marginBottom: '1rem' }}>
            The FTE impact formula accounts for the compounding effect of shrinkage:
          </p>
          <div
            style={{
              padding: '1rem 1.25rem',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius)',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              color: 'var(--fg)',
              marginBottom: '1rem',
            }}
          >
            Actual FTEs = Base Requirement / (1 - Total Shrinkage %)
          </div>
          <p>
            Industry benchmarks for total shrinkage typically fall between 30-35%. Operations
            exceeding 35% should investigate unplanned shrinkage drivers — absenteeism and schedule
            adherence improvements often yield the highest ROI.
          </p>
        </div>
      </div>
    </div>
  )
}
