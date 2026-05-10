import React from 'react'

const typeColors: Record<string, string> = {
  'wiki-entry': '#8b5cf6',
  paper: '#3b82f6',
  article: '#10b981',
  tool: '#f59e0b',
  'newsletter-issue': '#ef4444',
  member: '#6366f1',
}

const typeLabels: Record<string, string> = {
  'wiki-entry': 'Wiki',
  paper: 'Research',
  article: 'Article',
  tool: 'Tool',
  'newsletter-issue': 'Compass',
  member: 'Member',
}

interface AssetCardProps {
  title: string
  description?: string | null
  slug: string
  assetType: string
  status?: string | null
  tier?: string | null
  topics?: Array<{ name: string; slug: string } | string | number> | null
  primaryContributor?: { displayName: string; username: string } | string | number | null
  stats?: {
    discussionCount?: number | null
    reactionCount?: number | null
    viewCount?: number | null
  } | null
  href: string
}

export function AssetCard({
  title,
  description,
  assetType,
  status,
  topics,
  primaryContributor,
  stats,
  href,
}: AssetCardProps) {
  const color = typeColors[assetType] || 'var(--accent)'
  const label = typeLabels[assetType] || assetType

  return (
    <a href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="card" style={{ padding: '1.25rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header: type badge + status badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <span
            className="badge"
            style={{
              background: `${color}20`,
              color: color,
              fontSize: '0.6875rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            {label}
          </span>
          {status && (
            <span className={`badge badge-status-${status}`} style={{ fontSize: '0.6875rem' }}>
              {status}
            </span>
          )}
        </div>

        {/* Title */}
        <h3
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            lineHeight: 1.4,
            marginBottom: '0.375rem',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {title}
        </h3>

        {/* Description */}
        {description && (
          <p
            style={{
              fontSize: '0.8125rem',
              color: 'var(--fg-muted)',
              lineHeight: 1.5,
              marginBottom: '0.75rem',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              flex: 1,
            }}
          >
            {description}
          </p>
        )}
        {!description && <div style={{ flex: 1 }} />}

        {/* Topics */}
        {topics && topics.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.75rem' }}>
            {topics.slice(0, 3).map((topic, i) => {
              const name = typeof topic === 'object' && topic !== null && 'name' in topic ? topic.name : String(topic)
              return (
                <span key={i} className="topic-pill">
                  {name}
                </span>
              )
            })}
            {topics.length > 3 && (
              <span className="topic-pill">+{topics.length - 3}</span>
            )}
          </div>
        )}

        {/* Footer: contributor + stats */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '0.5rem',
            borderTop: '1px solid var(--border)',
            fontSize: '0.75rem',
            color: 'var(--fg-faint)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            {/* Avatar placeholder */}
            <div
              style={{
                width: '1.25rem',
                height: '1.25rem',
                borderRadius: '50%',
                background: `${color}40`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.625rem',
                fontWeight: 600,
                color: color,
              }}
            >
              {typeof primaryContributor === 'object' &&
              primaryContributor !== null &&
              'displayName' in primaryContributor
                ? primaryContributor.displayName.charAt(0).toUpperCase()
                : '?'}
            </div>
            <span>
              {typeof primaryContributor === 'object' &&
              primaryContributor !== null &&
              'displayName' in primaryContributor
                ? primaryContributor.displayName
                : 'Unknown'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {stats?.discussionCount ? (
              <span title="Discussions">{stats.discussionCount} disc</span>
            ) : null}
            {stats?.reactionCount ? (
              <span title="Reactions">{stats.reactionCount} reactions</span>
            ) : null}
          </div>
        </div>
      </div>
    </a>
  )
}
