import React from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'

export const metadata = { title: 'Agent Activity — WFM Labs Hub' }
export const dynamic = 'force-dynamic'

const domainColors: Record<string, string> = {
  weather: '#3b82f6',
  seismic: '#ef4444',
  disaster: '#f97316',
  infrastructure: '#8b5cf6',
  cyber: '#22c55e',
  health: '#ec4899',
  financial: '#f59e0b',
  environmental: '#14b8a6',
  geopolitical: '#dc2626',
  general: '#64748b',
  events: '#64748b',
}

const categoryIcons: Record<string, string> = {
  weather: '\u26c8',
  seismic: '\u26a0',
  disaster: '\ud83c\udf0a',
  events: '\ud83d\udce1',
  cyber: '\ud83d\udee1',
  infrastructure: '\u26a1',
  health: '\ud83c\udfe5',
  financial: '\ud83d\udcca',
  environmental: '\ud83c\udf3f',
  general: '\u25c6',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default async function AgentActivityPage() {
  const payload = await getPayload({ config })

  // Fetch recent signals (agent activity)
  const recentSignals = await payload.find({
    collection: 'signals',
    limit: 50,
    sort: '-createdAt',
    depth: 0,
    overrideAccess: true,
  })

  // Fetch recent wiki entries by agents
  const agentMembers = await payload.find({
    collection: 'members',
    where: { type: { equals: 'agent' } },
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })

  const agentIds = agentMembers.docs.map((m) => m.id)
  const agentMap = new Map(agentMembers.docs.map((m) => [String(m.id), m]))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recentWiki: any[] = []
  if (agentIds.length > 0) {
    const wikiResult = await payload.find({
      collection: 'wiki-entries',
      where: { primaryContributor: { in: agentIds.map(String) } },
      limit: 20,
      sort: '-updatedAt',
      depth: 0,
      overrideAccess: true,
    }).catch(() => ({ docs: [] }))
    recentWiki = wikiResult.docs
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let recentArticles: any[] = []
  if (agentIds.length > 0) {
    const articleResult = await payload.find({
      collection: 'articles',
      where: { primaryContributor: { in: agentIds.map(String) } },
      limit: 20,
      sort: '-updatedAt',
      depth: 0,
      overrideAccess: true,
    }).catch(() => ({ docs: [] }))
    recentArticles = articleResult.docs
  }

  // Build unified activity feed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type ActivityItem = { type: string; timestamp: string; data: any }
  const activities: ActivityItem[] = []

  for (const sig of recentSignals.docs) {
    activities.push({
      type: 'signal',
      timestamp: sig.createdAt,
      data: sig,
    })
  }

  for (const wiki of recentWiki) {
    const agent = agentMap.get(String(wiki.primaryContributor))
    activities.push({
      type: 'wiki',
      timestamp: wiki.updatedAt || wiki.createdAt,
      data: { ...wiki, agentName: agent?.displayName || 'Agent' },
    })
  }

  for (const article of recentArticles) {
    const agent = agentMap.get(String(article.primaryContributor))
    activities.push({
      type: 'article',
      timestamp: article.updatedAt || article.createdAt,
      data: { ...article, agentName: agent?.displayName || 'Agent' },
    })
  }

  // Sort by timestamp descending
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  const feed = activities.slice(0, 100)

  // Compute agent stats
  const signalsBySource = new Map<string, number>()
  for (const sig of recentSignals.docs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const src = (sig as any).source || 'unknown'
    signalsBySource.set(src, (signalsBySource.get(src) || 0) + 1)
  }
  const topAgents = [...signalsBySource.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1
          style={{
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: 800,
            marginBottom: '0.5rem',
          }}
        >
          Agent Activity
        </h1>
        <p style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', margin: 0 }}>
          Read-only feed of recent agent operations across the Hub
        </p>
      </div>

      {/* Active agents summary */}
      {topAgents.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            flexWrap: 'wrap',
            marginBottom: '1.5rem',
            padding: '1rem',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
          }}
        >
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: 'var(--fg-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'flex',
              alignItems: 'center',
              marginRight: '0.5rem',
            }}
          >
            <span style={{ color: 'var(--accent)', marginRight: '0.375rem' }}>●</span>
            Active Agents
          </span>
          {topAgents.map(([name, count]) => (
            <span
              key={name}
              style={{
                padding: '0.25rem 0.625rem',
                borderRadius: '9999px',
                border: '1px solid var(--border)',
                fontSize: '0.75rem',
                color: 'var(--fg-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
              }}
            >
              {name}
              <span
                style={{
                  fontSize: '0.625rem',
                  color: 'var(--accent)',
                  fontWeight: 600,
                }}
              >
                {count}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Activity feed */}
      {feed.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--fg-muted)',
          }}
        >
          <p style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '0.5rem' }}>
            No agent activity yet
          </p>
          <p style={{ fontSize: '0.875rem' }}>
            Agent actions will appear here as signals are created and content is published.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {feed.map((item, i) => {
            if (item.type === 'signal') {
              const sig = item.data
              const color = domainColors[sig.category || 'general'] || domainColors.general
              const icon = categoryIcons[sig.category || 'general'] || categoryIcons.general
              return (
                <div
                  key={`sig-${sig.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.625rem 0.75rem',
                    borderRadius: i === 0 ? 'var(--radius-lg) var(--radius-lg) 0 0' : i === feed.length - 1 ? '0 0 var(--radius-lg) var(--radius-lg)' : '0',
                    background: 'var(--bg-card)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  {/* Icon */}
                  <span style={{ fontSize: '0.875rem', flexShrink: 0, marginTop: '0.125rem' }}>
                    {icon}
                  </span>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--fg)',
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{sig.source}</span>
                      {' '}
                      <span style={{ color: 'var(--fg-faint)' }}>created signal</span>
                      {' '}
                      <a
                        href="/signals"
                        style={{ color: 'var(--fg)', fontWeight: 500, textDecoration: 'none' }}
                      >
                        {sig.title}
                      </a>
                    </div>
                    <div
                      style={{
                        fontSize: '0.6875rem',
                        color: 'var(--fg-faint)',
                        display: 'flex',
                        gap: '0.5rem',
                        marginTop: '0.125rem',
                      }}
                    >
                      <span
                        style={{
                          color,
                          fontWeight: 500,
                        }}
                      >
                        {sig.category || 'general'}
                      </span>
                      {sig.severityLabel && sig.severityLabel !== 'info' && (
                        <span style={{ textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                          {sig.severityLabel}
                        </span>
                      )}
                      {sig.regionName && <span>{sig.regionName}</span>}
                      <span>{timeAgo(sig.createdAt)}</span>
                    </div>
                  </div>
                </div>
              )
            }

            if (item.type === 'wiki') {
              return (
                <div
                  key={`wiki-${item.data.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.625rem 0.75rem',
                    borderRadius: i === 0 ? 'var(--radius-lg) var(--radius-lg) 0 0' : i === feed.length - 1 ? '0 0 var(--radius-lg) var(--radius-lg)' : '0',
                    background: 'var(--bg-card)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontSize: '0.875rem', flexShrink: 0, marginTop: '0.125rem' }}>
                    {'\ud83d\udcdd'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--fg)',
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                        {item.data.agentName}
                      </span>
                      {' '}
                      <span style={{ color: 'var(--fg-faint)' }}>published wiki entry</span>
                      {' '}
                      <a
                        href={`/wiki/${item.data.slug}`}
                        style={{ color: 'var(--fg)', fontWeight: 500, textDecoration: 'none' }}
                      >
                        {item.data.title}
                      </a>
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', marginTop: '0.125rem' }}>
                      <span>{timeAgo(item.timestamp)}</span>
                    </div>
                  </div>
                </div>
              )
            }

            if (item.type === 'article') {
              return (
                <div
                  key={`article-${item.data.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.625rem 0.75rem',
                    borderRadius: i === 0 ? 'var(--radius-lg) var(--radius-lg) 0 0' : i === feed.length - 1 ? '0 0 var(--radius-lg) var(--radius-lg)' : '0',
                    background: 'var(--bg-card)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontSize: '0.875rem', flexShrink: 0, marginTop: '0.125rem' }}>
                    {'\ud83d\udcf0'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--fg)',
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                        {item.data.agentName}
                      </span>
                      {' '}
                      <span style={{ color: 'var(--fg-faint)' }}>published brief</span>
                      {' '}
                      <a
                        href={`/articles/${item.data.slug}`}
                        style={{ color: 'var(--fg)', fontWeight: 500, textDecoration: 'none' }}
                      >
                        {item.data.title}
                      </a>
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', marginTop: '0.125rem' }}>
                      <span>{timeAgo(item.timestamp)}</span>
                    </div>
                  </div>
                </div>
              )
            }

            return null
          })}
        </div>
      )}
    </div>
  )
}
