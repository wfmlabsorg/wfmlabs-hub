import React from 'react'

// ── Coverage / balance view ──
// Read-only "at a glance" panel that surfaces the feed's geo + category + domain
// skew (e.g. "open incidents are EU weather, US count is cyber-heavy") plus the
// open-incident corroboration breakdown used for triage. All data is assembled
// server-side by the /incidents page via the same neonQuery helper and passed in
// as plain distributions — this component is purely presentational.

export interface DistroItem {
  label: string
  count: number
  color: string
  /** Optional href to filter the incident list to this slice */
  href?: string
}

export interface CoveragePanelProps {
  windowDays: number
  totalSignals: number
  signalsByRegion: DistroItem[]
  signalsByCategory: DistroItem[]
  incidentsByDomain: DistroItem[]
  incidentsByRegion: DistroItem[]
  corroboration: DistroItem[]
  totalOpenIncidents: number
  needsValidation: number
}

function DistroBars({
  items,
  emptyLabel,
}: {
  items: DistroItem[]
  emptyLabel: string
}) {
  const max = items.reduce((m, i) => Math.max(m, i.count), 0)
  if (items.length === 0 || max === 0) {
    return (
      <div style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', fontStyle: 'italic', padding: '0.25rem 0' }}>
        {emptyLabel}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      {items.map((item) => {
        const pct = max > 0 ? Math.max(4, Math.round((item.count / max) * 100)) : 0
        const row = (
          <>
            <span
              style={{
                fontSize: '0.6875rem',
                color: 'var(--fg-muted)',
                width: '5.5rem',
                flexShrink: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {item.label}
            </span>
            <span
              style={{
                position: 'relative',
                flex: 1,
                height: '0.75rem',
                background: 'var(--bg-tertiary)',
                borderRadius: '3px',
                overflow: 'hidden',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  inset: '0 auto 0 0',
                  width: `${pct}%`,
                  background: item.color,
                  opacity: 0.85,
                  borderRadius: '3px',
                }}
              />
            </span>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                fontFamily: "'IBM Plex Mono', monospace",
                color: 'var(--fg)',
                width: '2.25rem',
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              {item.count}
            </span>
          </>
        )
        const rowStyle: React.CSSProperties = {
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          textDecoration: 'none',
          color: 'inherit',
        }
        return item.href ? (
          <a key={item.label} href={item.href} style={rowStyle}>
            {row}
          </a>
        ) : (
          <div key={item.label} style={rowStyle}>
            {row}
          </div>
        )
      })}
    </div>
  )
}

function DistroCard({
  title,
  subtitle,
  items,
  emptyLabel,
}: {
  title: string
  subtitle?: string
  items: DistroItem[]
  emptyLabel: string
}) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '0.875rem 1rem',
      }}
    >
      <div style={{ marginBottom: '0.625rem' }}>
        <div
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            color: 'var(--fg)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: '0.625rem', color: 'var(--fg-faint)', marginTop: '0.125rem' }}>{subtitle}</div>
        )}
      </div>
      <DistroBars items={items} emptyLabel={emptyLabel} />
    </div>
  )
}

export function CoveragePanel({
  windowDays,
  totalSignals,
  signalsByRegion,
  signalsByCategory,
  incidentsByDomain,
  incidentsByRegion,
  corroboration,
  totalOpenIncidents,
  needsValidation,
}: CoveragePanelProps) {
  const win = `Last ${windowDays}d`
  return (
    <details open style={{ marginBottom: '2rem' }}>
      <summary
        style={{
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'var(--fg-faint)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          cursor: 'pointer',
          marginBottom: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          flexWrap: 'wrap',
        }}
      >
        <span>Coverage &amp; Balance</span>
        <span style={{ fontWeight: 400, color: 'var(--fg-faint)', textTransform: 'none', letterSpacing: 0 }}>
          {totalOpenIncidents} open · {totalSignals} signals ({win})
        </span>
        {needsValidation > 0 && (
          <span
            style={{
              fontSize: '0.625rem',
              fontWeight: 700,
              fontFamily: "'IBM Plex Mono', monospace",
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '0.125rem 0.5rem',
              borderRadius: '4px',
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.3)',
              color: '#f59e0b',
            }}
          >
            {needsValidation} need validation
          </span>
        )}
      </summary>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(15rem, 1fr))',
          gap: '0.75rem',
        }}
      >
        <DistroCard
          title="Open Incidents · Region"
          subtitle="Geographic skew of active incidents"
          items={incidentsByRegion}
          emptyLabel="No open incidents"
        />
        <DistroCard
          title="Open Incidents · Domain"
          subtitle="Which risk domains are active"
          items={incidentsByDomain}
          emptyLabel="No open incidents"
        />
        <DistroCard
          title="Corroboration · Triage"
          subtitle="Open incidents by external corroboration"
          items={corroboration}
          emptyLabel="No open incidents"
        />
        <DistroCard
          title="Signals · Region"
          subtitle={`Inflow geo skew · ${win}`}
          items={signalsByRegion}
          emptyLabel="No recent signals"
        />
        <DistroCard
          title="Signals · Category"
          subtitle={`Inflow by category · ${win}`}
          items={signalsByCategory}
          emptyLabel="No recent signals"
        />
      </div>
    </details>
  )
}
