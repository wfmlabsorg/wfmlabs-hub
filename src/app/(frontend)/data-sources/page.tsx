import React from 'react'

export const metadata = { title: 'Data Sources' }
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

const domainIcons: Record<string, string> = {
  weather: '🌦️',
  seismic: '🌍',
  disaster: '🚨',
  infrastructure: '🏗️',
  cyber: '🔒',
  health: '🏥',
  financial: '💹',
  environmental: '🌿',
  news: '📰',
}

const domains = [
  { value: 'all', label: 'All', icon: '📡' },
  { value: 'weather', label: 'Weather', icon: '🌦️' },
  { value: 'seismic', label: 'Seismic', icon: '🌍' },
  { value: 'disaster', label: 'Disaster', icon: '🚨' },
  { value: 'infrastructure', label: 'Infrastructure', icon: '🏗️' },
  { value: 'cyber', label: 'Cyber', icon: '🔒' },
  { value: 'health', label: 'Health', icon: '🏥' },
  { value: 'financial', label: 'Financial', icon: '💹' },
  { value: 'environmental', label: 'Environmental', icon: '🌿' },
  { value: 'news', label: 'News', icon: '📰' },
]

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

interface MergedFeed extends FeedRegistry {
  health?: FeedHealth
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

function statusColor(status?: string) {
  if (!status) return 'var(--fg-faint)'
  switch (status) {
    case 'LIVE': return '#10b981'
    case 'DELAYED': return '#f59e0b'
    case 'STALE': return '#f59e0b'
    case 'DEAD': return '#ef4444'
    default: return 'var(--fg-faint)'
  }
}

function formatMinutes(mins?: string) {
  if (!mins) return '—'
  const m = parseFloat(mins)
  if (m < 1) return '<1 min ago'
  if (m < 60) return `${Math.round(m)} min ago`
  if (m < 1440) return `${Math.round(m / 60)}h ago`
  return `${Math.round(m / 1440)}d ago`
}

export default async function DataSourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>
}) {
  const resolvedParams = await searchParams
  const activeDomain = resolvedParams.domain || 'all'

  // Fetch both APIs server-side
  const [registryRes, healthRes] = await Promise.all([
    fetch('https://ovix-api.tedlango.workers.dev/api/ovix/feeds', { next: { revalidate: 300 } })
      .then(r => r.json())
      .catch(() => ({ feeds: [], count: 0 })),
    fetch('https://ovix-api.tedlango.workers.dev/api/ovix/feed-health', { next: { revalidate: 300 } })
      .then(r => r.json())
      .catch(() => ({ feeds: [], totalFeeds: 0, healthy: 0, stale: 0 })),
  ])

  // Merge health into registry
  const allFeeds: MergedFeed[] = registryRes.feeds.map((feed: FeedRegistry) => {
    const health = healthRes.feeds.find((h: FeedHealth) => h.source === feed.id)
    return { ...feed, health }
  })

  // Filter by domain
  const feeds = activeDomain === 'all'
    ? allFeeds
    : allFeeds.filter(f => f.domain === activeDomain)

  // Stats
  const totalFeeds = registryRes.count || allFeeds.length
  const healthyCount = healthRes.healthy || 0
  const staleCount = (healthRes.totalFeeds || 0) - healthyCount

  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Page header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
          Data Sources
        </h1>
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          Open intelligence APIs powering the Operational Volatility Index. {totalFeeds} live feeds across 9 domains.
        </p>

        {/* Stats bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          flexWrap: 'wrap',
          padding: '0.75rem 1rem',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border)',
          fontSize: '0.8125rem',
        }}>
          <span style={{ fontWeight: 600 }}>
            <span style={{ color: 'var(--accent)' }}>{totalFeeds}</span> total feeds
          </span>
          <span>
            <span style={{ color: '#10b981', fontWeight: 600 }}>{healthyCount}</span> healthy
          </span>
          <span>
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>{staleCount}</span> stale
          </span>
          <a
            href="https://roc-beta.wfmlabs.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 500 }}
          >
            Powered by ROC →
          </a>
        </div>
      </div>

      {/* Domain filter chips */}
      <div className="category-chips-row">
        {domains.map((d) => (
          <a
            key={d.value}
            href={d.value === 'all' ? '/data-sources' : `/data-sources?domain=${d.value}`}
            className={`category-chip ${d.value === activeDomain ? 'category-chip-active' : ''}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <span className="category-chip-icon">{d.icon}</span>
            {d.label}
          </a>
        ))}
      </div>

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
          {activeDomain === 'all'
            ? '📡 All Feeds'
            : `${domainIcons[activeDomain] || '📡'} ${domains.find(d => d.value === activeDomain)?.label || 'Feeds'}`}
        </h2>
        <span style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>
          {feeds.length} {feeds.length === 1 ? 'Feed' : 'Feeds'}
        </span>
      </div>

      {/* Feed cards grid */}
      {feeds.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '4rem 2rem',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-lg)',
          color: 'var(--fg-muted)',
        }}>
          <p style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem' }}>
            No feeds in this domain
          </p>
          <p style={{ fontSize: '0.875rem' }}>
            Try selecting a different domain filter.
          </p>
        </div>
      ) : (
        <div className="tools-grid">
          {feeds.map((feed) => (
            <a
              key={feed.id}
              href={`/data-sources/${feed.id}`}
              className="asset-card-link"
            >
              <div className="asset-card">
                {/* Gradient header */}
                <div
                  className="asset-card-gradient"
                  style={{ background: domainGradients[feed.domain] || domainGradients.news }}
                >
                  <div className="asset-card-badges">
                    <div className="asset-card-badges-left">
                      <span className="asset-card-badge">
                        {feed.domain}
                      </span>
                      <span className="asset-card-badge">
                        {feed.coverage}
                      </span>
                    </div>
                    <div className="asset-card-badges-right">
                      <span
                        className="asset-card-badge"
                        style={{
                          background: `${statusColor(feed.health?.status)}33`,
                          color: statusColor(feed.health?.status),
                        }}
                      >
                        {statusIndicator(feed.health?.status)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="asset-card-content">
                  <h3 className="asset-card-title">{feed.name}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', marginBottom: '0.25rem' }}>
                    {feed.provider}
                  </p>
                  <p className="asset-card-description">
                    {feed.scoring}
                  </p>

                  {/* Footer */}
                  <div className="asset-card-footer">
                    <span>
                      ⚡ {feed.refresh}
                    </span>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      {feed.health && (
                        <>
                          <span>{feed.health.events_24h} events/24h</span>
                          <span>{formatMinutes(feed.health.minutes_since_last)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
