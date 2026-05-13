import React from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'

const categoryColors: Record<string, { bg: string; fg: string; border: string }> = {
  weather: { bg: '#dbeafe', fg: '#1e40af', border: '#3b82f6' },
  seismic: { bg: '#fee2e2', fg: '#991b1b', border: '#ef4444' },
  disaster: { bg: '#ffedd5', fg: '#9a3412', border: '#f97316' },
  cyber: { bg: '#d1fae5', fg: '#065f46', border: '#22c55e' },
  health: { bg: '#fce7f3', fg: '#9d174d', border: '#ec4899' },
  infrastructure: { bg: '#ede9fe', fg: '#5b21b6', border: '#8b5cf6' },
  financial: { bg: '#fef3c7', fg: '#92400e', border: '#f59e0b' },
  environmental: { bg: '#ccfbf1', fg: '#115e59', border: '#14b8a6' },
  summary: { bg: '#e0e7ff', fg: '#3730a3', border: '#6366f1' },
  general: { bg: '#f1f5f9', fg: '#475569', border: '#94a3b8' },
}

const categoryLabels: Record<string, string> = {
  weather: 'Weather',
  seismic: 'Seismic',
  disaster: 'Disaster',
  cyber: 'Cyber',
  health: 'Health',
  infrastructure: 'Infrastructure',
  financial: 'Financial',
  environmental: 'Environmental',
  summary: 'Summary',
  general: 'General',
}

const severityColors: Record<string, string> = {
  extreme: '#e74c3c',
  severe: '#f39c12',
  moderate: '#3498db',
  info: '#27ae60',
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export const dynamic = 'force-dynamic'

export default async function BriefsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>
}) {
  const params = await searchParams
  const payload = await getPayload({ config })
  const activeCategory = params.category || null
  const page = parseInt(params.page || '1')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { status: { equals: 'published' } }
  if (activeCategory && Object.keys(categoryColors).includes(activeCategory)) {
    where.category = { equals: activeCategory }
  }

  const briefs = await payload.find({
    collection: 'briefs',
    where,
    limit: 20,
    page,
    sort: '-publishedAt',
    depth: 1,
  })

  const filterCategories = Object.keys(categoryColors)

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
          Operational Briefs
        </h1>
        <p style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', margin: 0 }}>
          AI-generated intelligence from Sentinel and the OVIX agent team
          {briefs.totalDocs > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', marginLeft: '0.75rem' }}>
              {briefs.totalDocs} briefs
            </span>
          )}
        </p>
      </div>

      {/* Category filter chips */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <a
          href="/briefs"
          style={{
            padding: '0.375rem 0.875rem',
            borderRadius: '9999px',
            border: '1px solid var(--border)',
            background: !activeCategory ? 'var(--fg)' : 'transparent',
            color: !activeCategory ? 'var(--bg)' : 'var(--fg-muted)',
            fontSize: '0.8125rem',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          All
        </a>
        {filterCategories.map((cat) => {
          const colors = categoryColors[cat]
          const isActive = activeCategory === cat
          return (
            <a
              key={cat}
              href={isActive ? '/briefs' : `/briefs?category=${cat}`}
              style={{
                padding: '0.375rem 0.875rem',
                borderRadius: '9999px',
                border: `1px solid ${isActive ? colors.border : 'var(--border)'}`,
                background: isActive ? `${colors.border}15` : 'transparent',
                color: isActive ? colors.border : 'var(--fg-muted)',
                fontSize: '0.8125rem',
                fontWeight: 500,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '0.5rem',
                  height: '0.5rem',
                  borderRadius: '50%',
                  background: colors.border,
                  flexShrink: 0,
                }}
              />
              {categoryLabels[cat]}
            </a>
          )
        })}
      </div>

      {/* Brief cards */}
      {briefs.docs.length === 0 ? (
        <div
          style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--fg-muted)',
          }}
        >
          <p style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '0.5rem' }}>
            No briefs {activeCategory ? `in ${categoryLabels[activeCategory]}` : 'yet'}
          </p>
          <p style={{ fontSize: '0.875rem' }}>
            Operational briefs appear here as Sentinel detects significant events across monitored domains.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {briefs.docs.map((brief: any) => {
            const colors = categoryColors[brief.category] || categoryColors.general
            const sevColor = severityColors[brief.severityLabel || 'info'] || severityColors.info
            const agent =
              typeof brief.agent === 'object' && brief.agent
                ? brief.agent
                : null

            return (
              <a
                key={brief.id}
                href={`/briefs/${brief.slug}`}
                className="card"
                style={{
                  display: 'flex',
                  overflow: 'hidden',
                  textDecoration: 'none',
                  color: 'inherit',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                {/* Category color band */}
                <div
                  style={{
                    width: '5px',
                    background: colors.border,
                    flexShrink: 0,
                  }}
                />

                <div style={{ flex: 1, padding: '1.25rem' }}>
                  {/* Top row: category badge + severity + time */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.5rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '0.25rem',
                        background: colors.bg,
                        color: colors.fg,
                      }}
                    >
                      {categoryLabels[brief.category] || brief.category}
                    </span>
                    {brief.briefType === 'summary' && (
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          padding: '0.125rem 0.5rem',
                          borderRadius: '0.25rem',
                          background: '#e0e7ff',
                          color: '#3730a3',
                        }}
                      >
                        DAILY SUMMARY
                      </span>
                    )}
                    {brief.severity != null && (
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          color: sevColor,
                        }}
                      >
                        {brief.severity.toFixed(1)}
                      </span>
                    )}
                    <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', marginLeft: 'auto' }}>
                      {brief.publishedAt ? timeAgo(brief.publishedAt) : timeAgo(brief.createdAt)}
                    </span>
                  </div>

                  {/* Title */}
                  <h3
                    style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      marginBottom: '0.375rem',
                      lineHeight: 1.3,
                    }}
                  >
                    {brief.title}
                  </h3>

                  {/* Excerpt */}
                  {brief.excerpt && (
                    <p
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--fg-muted)',
                        lineHeight: 1.5,
                        marginBottom: '0.5rem',
                      }}
                    >
                      {brief.excerpt.length > 200
                        ? brief.excerpt.slice(0, 200) + '...'
                        : brief.excerpt}
                    </p>
                  )}

                  {/* Footer: agent + region */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.75rem',
                      fontSize: '0.6875rem',
                      color: 'var(--fg-faint)',
                      alignItems: 'center',
                    }}
                  >
                    {agent && (
                      <span style={{ fontWeight: 500 }}>
                        {agent.displayName || agent.username}
                      </span>
                    )}
                    {brief.regionName && (
                      <>
                        <span style={{ opacity: 0.4 }}>{'\u00b7'}</span>
                        <span>{brief.regionName}</span>
                      </>
                    )}
                    {(brief.stats?.discussionCount || 0) > 0 && (
                      <>
                        <span style={{ opacity: 0.4 }}>{'\u00b7'}</span>
                        <span>{brief.stats.discussionCount} comments</span>
                      </>
                    )}
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {(briefs.hasPrevPage || briefs.hasNextPage) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1rem',
            marginTop: '2rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border)',
          }}
        >
          {briefs.hasPrevPage && (
            <a
              href={`/briefs?${activeCategory ? `category=${activeCategory}&` : ''}page=${page - 1}`}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--fg)',
                fontSize: '0.8125rem',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              {'\u2190'} Newer
            </a>
          )}
          <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)' }}>
            Page {page}
          </span>
          {briefs.hasNextPage && (
            <a
              href={`/briefs?${activeCategory ? `category=${activeCategory}&` : ''}page=${page + 1}`}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--fg)',
                fontSize: '0.8125rem',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Older {'\u2192'}
            </a>
          )}
        </div>
      )}
    </div>
  )
}
