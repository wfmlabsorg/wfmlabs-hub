import React from 'react'
import { notFound } from 'next/navigation'
import { FEED_DESCRIPTIONS } from '@/lib/constants/feed-descriptions'

export const dynamic = 'force-dynamic'

const domainGradients: Record<string, string> = {
  weather: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)',
  seismic: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
  disaster: 'linear-gradient(135deg, #f97316 0%, #f59e0b 100%)',
  infrastructure: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
  cyber: 'linear-gradient(135deg, #22c55e 0%, #10b981 100%)',
  health: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
  financial: 'linear-gradient(135deg, #f59e0b 0%, #eab308 100%)',
  environmental: 'linear-gradient(135deg, #14b8a6 0%, #22c55e 100%)',
  news: 'linear-gradient(135deg, #64748b 0%, #6b7280 100%)',
}

const domainColors: Record<string, string> = {
  weather: '#3b82f6',
  seismic: '#ef4444',
  disaster: '#f97316',
  infrastructure: '#8b5cf6',
  cyber: '#22c55e',
  health: '#ec4899',
  financial: '#f59e0b',
  environmental: '#14b8a6',
  news: '#64748b',
}

interface FeedRegistry {
  id: string
  name: string
  domain: string
  source_url: string
  api_type: string
  provider: string
  coverage: string
  refresh: string
  scoring: string
  docs: string
}

const domainDashboardMap: Record<string, string> = {
  weather: 'weather',
  seismic: 'seismic',
  disaster: 'disaster',
  infrastructure: 'infrastructure',
  cyber: 'cyber',
  health: 'health',
  financial: 'financial',
  environmental: 'environmental',
  news: 'geopolitical',
}

const domainDashboardLabel: Record<string, string> = {
  weather: 'Weather Intelligence',
  seismic: 'Seismic Activity',
  disaster: 'Disaster Monitor',
  infrastructure: 'Infrastructure Status',
  cyber: 'Cyber Threat',
  health: 'Health Surveillance',
  financial: 'Financial',
  environmental: 'Environmental',
  news: 'Geopolitical Risk',
}

interface FeedHealth {
  source: string
  domain: string
  total_events: string
  events_1h: string
  events_6h: string
  events_24h: string
  last_ingested: string
  avg_severity: string
  max_severity: string
  minutes_since_last: string
  status: string
}

function statusIndicator(status?: string) {
  if (!status) return '⚪ UNKNOWN'
  switch (status) {
    case 'LIVE': return '🟢 LIVE'
    case 'DELAYED': return '🟡 DELAYED'
    case 'STALE': return '🟡 STALE'
    case 'DEAD': return '🔴 DOWN'
    default: return '⚪ ' + status
  }
}

function statusBadgeStyle(status?: string): React.CSSProperties {
  const colors: Record<string, { bg: string; fg: string }> = {
    LIVE: { bg: '#065f46', fg: '#6ee7b7' },
    DELAYED: { bg: '#78350f', fg: '#fbbf24' },
    STALE: { bg: '#78350f', fg: '#fbbf24' },
    DEAD: { bg: '#7f1d1d', fg: '#fca5a5' },
  }
  const c = colors[status || ''] || { bg: '#374151', fg: '#9ca3af' }
  return { background: c.bg, color: c.fg }
}

function formatMinutes(mins?: string) {
  if (!mins) return '—'
  const m = parseFloat(mins)
  if (m < 1) return '<1 min ago'
  if (m < 60) return `${Math.round(m)} min ago`
  if (m < 1440) return `${Math.round(m / 60)}h ago`
  return `${Math.round(m / 1440)}d ago`
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await fetch('https://ovix-api.tedlango.workers.dev/api/ovix/feeds', { next: { revalidate: 300 } })
    .then(r => r.json())
    .catch(() => ({ feeds: [] }))
  const feed = res.feeds.find((f: FeedRegistry) => f.id === id)
  return { title: feed ? feed.name : 'Data Source' }
}

export default async function DataSourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [registryRes, healthRes] = await Promise.all([
    fetch('https://ovix-api.tedlango.workers.dev/api/ovix/feeds', { next: { revalidate: 300 } })
      .then(r => r.json())
      .catch(() => ({ feeds: [] })),
    fetch('https://ovix-api.tedlango.workers.dev/api/ovix/feed-health', { next: { revalidate: 300 } })
      .then(r => r.json())
      .catch(() => ({ feeds: [] })),
  ])

  const feed: FeedRegistry | undefined = registryRes.feeds.find((f: FeedRegistry) => f.id === id)
  if (!feed) return notFound()

  const health: FeedHealth | undefined = healthRes.feeds.find((h: FeedHealth) => h.source === id)
  const gradient = domainGradients[feed.domain] || domainGradients.news
  const color = domainColors[feed.domain] || '#64748b'

  const infoRows = [
    { label: 'Endpoint', value: feed.source_url, href: feed.source_url },
    { label: 'API Type', value: feed.api_type },
    { label: 'Provider', value: feed.provider },
    { label: 'Coverage', value: feed.coverage },
    { label: 'Refresh Rate', value: feed.refresh },
    { label: 'Documentation', value: feed.docs, href: feed.docs },
  ]

  return (
    <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '1rem', fontSize: '0.8125rem' }}>
        <a href="/data-sources" style={{ color: 'var(--fg-muted)' }}>Data Sources</a>
        <span style={{ color: 'var(--fg-faint)', margin: '0 0.5rem' }}>/</span>
        <span style={{ color: 'var(--fg)' }}>{feed.name}</span>
      </div>

      {/* Header banner */}
      <div style={{
        background: gradient,
        borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
        padding: '2rem 1.5rem',
        color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <span className="asset-card-badge">{feed.domain}</span>
          {health && (
            <span className="badge" style={statusBadgeStyle(health.status)}>
              {statusIndicator(health.status)}
            </span>
          )}
          <span className="asset-card-badge">{feed.coverage}</span>
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
          {feed.name}
        </h1>
        <p style={{ margin: '0.5rem 0 0', opacity: 0.9, fontSize: '0.9375rem' }}>
          {feed.provider}
        </p>
      </div>

      {/* Main content card */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderTop: 'none',
        borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
        padding: '1.5rem',
      }}>
        {/* About this Data Source */}
        {FEED_DESCRIPTIONS[feed.id] && (() => {
          const desc = FEED_DESCRIPTIONS[feed.id]
          const fields = [
            { label: 'Operator', value: desc.operator },
            { label: 'License', value: desc.license },
            { label: 'Registration', value: desc.registration },
            { label: 'Cost', value: desc.cost },
          ]
          return (
            <>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>
                About this Data Source
              </h2>
              <div style={{
                padding: '1rem',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                marginBottom: '2rem',
              }}>
                <p style={{ fontSize: '0.875rem', lineHeight: 1.7, marginBottom: '1rem' }}>
                  {desc.summary}
                </p>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))',
                  gap: '0.5rem',
                }}>
                  {fields.map((f) => (
                    <div key={f.label} style={{
                      padding: '0.5rem 0.75rem',
                      background: 'var(--bg-card)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                    }}>
                      <div style={{
                        fontSize: '0.625rem',
                        color: 'var(--fg-faint)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        marginBottom: '0.125rem',
                      }}>
                        {f.label}
                      </div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                        {f.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )
        })()}

        {/* Info grid */}
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>Feed Details</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))',
          gap: '0.75rem',
          marginBottom: '2rem',
        }}>
          {infoRows.map((row) => (
            <div key={row.label} style={{
              padding: '0.75rem',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                {row.label}
              </div>
              {row.href ? (
                <a
                  href={row.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.8125rem', wordBreak: 'break-all' }}
                >
                  {row.value}
                </a>
              ) : (
                <div style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{row.value}</div>
              )}
            </div>
          ))}
        </div>

        {/* Scoring section */}
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>
          How this feed contributes to OVIX
        </h2>
        <div style={{
          padding: '1rem',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          marginBottom: '2rem',
        }}>
          <p style={{ fontSize: '0.875rem', marginBottom: '0.75rem', lineHeight: 1.6 }}>
            {feed.scoring}
          </p>
          {/* Domain contribution bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', minWidth: '4rem' }}>
              {feed.domain}
            </span>
            <div style={{
              flex: 1,
              height: '0.5rem',
              background: 'var(--border)',
              borderRadius: '9999px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: health ? `${Math.min(100, (parseFloat(health.avg_severity) / 10) * 100)}%` : '50%',
                height: '100%',
                background: color,
                borderRadius: '9999px',
                transition: 'width 0.3s',
              }} />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', minWidth: '2.5rem', textAlign: 'right' }}>
              {health ? `${parseFloat(health.avg_severity).toFixed(1)}/10` : '—'}
            </span>
          </div>
        </div>

        {/* Live Health panel */}
        {health && (
          <>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              Live Health
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))',
              gap: '0.75rem',
              marginBottom: '2rem',
            }}>
              {[
                { label: 'Status', value: statusIndicator(health.status) },
                { label: 'Events (24h)', value: health.events_24h },
                { label: 'Events (1h)', value: health.events_1h },
                { label: 'Last Ingested', value: formatMinutes(health.minutes_since_last) },
                { label: 'Avg Severity', value: parseFloat(health.avg_severity).toFixed(1) },
                { label: 'Max Severity', value: health.max_severity },
              ].map((stat) => (
                <div key={stat.label} style={{
                  padding: '0.75rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                    {stat.label}
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* View in ROC button */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <a
            href="/roc"
            target="_blank"
            rel="noopener"
            className="btn btn-primary"
            style={{ padding: '0.625rem 1.5rem' }}
          >
            View {domainDashboardLabel[feed.domain] || 'Scores'} Dashboard →
          </a>
          <a
            href="/data-sources"
            className="btn btn-secondary"
            style={{ padding: '0.625rem 1.5rem' }}
          >
            ← All Data Sources
          </a>
        </div>

        {/* Discussion placeholder */}
        <div style={{
          padding: '1.5rem',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          textAlign: 'center',
        }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', margin: 0 }}>
            Discussions coming soon — this feed is powered by the{' '}
            <a href="/roc" target="_blank" rel="noopener">
              ROC operational platform
            </a>.
          </p>
        </div>
      </div>
    </div>
  )
}
