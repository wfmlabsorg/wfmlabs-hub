import React from 'react'

interface DetailPageLayoutProps {
  breadcrumbs: Array<{ label: string; href?: string }>
  title: string
  status?: string | null
  tier?: string | null
  primaryContributor?: { displayName: string; username: string } | string | number | null
  publishedAt?: string | null
  updatedAt?: string | null
  topics?: Array<{ name: string; slug: string } | string | number> | null
  stats?: {
    discussionCount?: number | null
    reactionCount?: number | null
    viewCount?: number | null
  } | null
  children: React.ReactNode
  sidebar?: React.ReactNode
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function DetailPageLayout({
  breadcrumbs,
  title,
  status,
  tier,
  primaryContributor,
  publishedAt,
  updatedAt,
  topics,
  stats,
  children,
  sidebar,
}: DetailPageLayoutProps) {
  const contributor =
    typeof primaryContributor === 'object' &&
    primaryContributor !== null &&
    'displayName' in primaryContributor
      ? primaryContributor
      : null

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
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span>/</span>}
            {crumb.href ? (
              <a href={crumb.href} style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>
                {crumb.label}
              </a>
            ) : (
              <span style={{ color: 'var(--fg)' }}>{crumb.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>

      <div style={{ display: 'flex', gap: '2.5rem' }}>
        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              {status && (
                <span className={`badge badge-status-${status}`} style={{ fontSize: '0.6875rem' }}>
                  {status}
                </span>
              )}
              {tier && (
                <span className={`badge badge-tier-${tier}`} style={{ fontSize: '0.6875rem' }}>
                  {tier}
                </span>
              )}
            </div>

            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.3, marginBottom: '0.75rem' }}>
              {title}
            </h1>

            {/* Meta row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                fontSize: '0.8125rem',
                color: 'var(--fg-muted)',
                flexWrap: 'wrap',
              }}
            >
              {contributor && (
                <a
                  href={`/member/${contributor.username}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--fg-muted)', textDecoration: 'none' }}
                >
                  <div
                    style={{
                      width: '1.5rem',
                      height: '1.5rem',
                      borderRadius: '50%',
                      background: 'var(--accent-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: 'var(--accent)',
                    }}
                  >
                    {contributor.displayName.charAt(0).toUpperCase()}
                  </div>
                  {contributor.displayName}
                </a>
              )}
              {publishedAt && <span>Published {formatDate(publishedAt)}</span>}
              {updatedAt && <span>Updated {formatDate(updatedAt)}</span>}
            </div>
          </div>

          {/* Content */}
          <div style={{ marginBottom: '3rem' }}>{children}</div>

          {/* Discussion placeholder */}
          <div
            style={{
              borderTop: '1px solid var(--border)',
              paddingTop: '2rem',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
              Discussion
            </h2>
            <div
              style={{
                textAlign: 'center',
                padding: '2rem',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--fg-muted)',
                fontSize: '0.875rem',
              }}
            >
              Discussion threads coming soon.
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside
          className="detail-sidebar"
          style={{
            width: '16rem',
            flexShrink: 0,
          }}
        >
          <div style={{ position: 'sticky', top: '4.5rem' }}>
            {/* Topics */}
            {topics && topics.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--fg-muted)',
                    marginBottom: '0.5rem',
                  }}
                >
                  Topics
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                  {topics.map((topic, i) => {
                    const name =
                      typeof topic === 'object' && topic !== null && 'name' in topic
                        ? topic.name
                        : String(topic)
                    return (
                      <span key={i} className="topic-pill">
                        {name}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Stats */}
            {stats && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--fg-muted)',
                    marginBottom: '0.5rem',
                  }}
                >
                  Stats
                </h3>
                <div style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>
                  {[
                    { label: 'Views', value: stats.viewCount },
                    { label: 'Discussions', value: stats.discussionCount },
                    { label: 'Reactions', value: stats.reactionCount },
                  ]
                    .filter((s) => s.value != null)
                    .map((s) => (
                      <div
                        key={s.label}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '0.25rem 0',
                        }}
                      >
                        <span>{s.label}</span>
                        <span style={{ fontWeight: 500, color: 'var(--fg)' }}>{s.value}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Custom sidebar content */}
            {sidebar}
          </div>
        </aside>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .detail-sidebar { display: none !important; }
        }
      `}</style>
    </div>
  )
}
