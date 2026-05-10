import { getPayload } from 'payload'
import config from '@payload-config'
import React from 'react'

export const metadata = { title: 'Tools' }

const categories = [
  { value: 'all', label: 'All' },
  { value: 'capacity-planning', label: 'Capacity Planning' },
  { value: 'forecasting', label: 'Forecasting' },
  { value: 'scheduling', label: 'Scheduling' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'value-planning', label: 'Value Planning' },
  { value: 'staffing', label: 'Staffing' },
]

const categoryColors: Record<string, string> = {
  'capacity-planning': '#f59e0b',
  forecasting: '#3b82f6',
  scheduling: '#8b5cf6',
  analytics: '#10b981',
  'value-planning': '#ef4444',
  staffing: '#6366f1',
}

const categoryLabels: Record<string, string> = {
  'capacity-planning': 'Capacity Planning',
  forecasting: 'Forecasting',
  scheduling: 'Scheduling',
  analytics: 'Analytics',
  'value-planning': 'Value Planning',
  staffing: 'Staffing',
}

export default async function ToolsBrowsePage() {
  const payload = await getPayload({ config })
  const tools = await payload
    .find({ collection: 'tools', limit: 50, sort: '-updatedAt', depth: 1, overrideAccess: true })
    .catch(() => ({ docs: [] }))

  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Page header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Tools
        </h1>
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.9375rem' }}>
          Interactive calculators, planning tools, and analytical utilities for WFM practitioners. Click to try them live.
        </p>
      </div>

      {/* Category filter pills */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          marginBottom: '2rem',
          paddingBottom: '1.5rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {categories.map((cat) => (
          <span
            key={cat.value}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0.375rem 0.875rem',
              fontSize: '0.8125rem',
              fontWeight: 500,
              borderRadius: '9999px',
              border: '1px solid var(--border)',
              background: cat.value === 'all' ? 'var(--accent)' : 'var(--bg-card)',
              color: cat.value === 'all' ? 'var(--accent-text)' : 'var(--fg-muted)',
              cursor: 'default',
            }}
          >
            {cat.label}
          </span>
        ))}
      </div>

      {/* Tools count */}
      <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--fg-muted)' }}>
        {tools.docs.length} {tools.docs.length === 1 ? 'tool' : 'tools'}
      </div>

      {/* Tool cards grid */}
      {tools.docs.length === 0 ? (
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
            No tools yet
          </p>
          <p style={{ fontSize: '0.875rem' }}>
            Tools will appear here once published.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(20rem, 1fr))',
            gap: '1.25rem',
          }}
        >
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {tools.docs.map((tool: any) => {
            const catColor = categoryColors[tool.category || ''] || 'var(--accent)'
            const catLabel = categoryLabels[tool.category || ''] || tool.category || ''
            const contributor =
              typeof tool.primaryContributor === 'object' &&
              tool.primaryContributor !== null &&
              'displayName' in tool.primaryContributor
                ? tool.primaryContributor
                : null

            return (
              <div
                key={tool.id}
                className="card"
                style={{
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                }}
              >
                {/* Header: category badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0.1875rem 0.5rem',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                      borderRadius: '9999px',
                      background: `${catColor}20`,
                      color: catColor,
                    }}
                  >
                    {catLabel}
                  </span>
                </div>

                {/* Title */}
                <h3
                  style={{
                    fontSize: '1.0625rem',
                    fontWeight: 600,
                    lineHeight: 1.4,
                    marginBottom: '0.5rem',
                  }}
                >
                  {tool.title}
                </h3>

                {/* Description */}
                {tool.description && (
                  <p
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--fg-muted)',
                      lineHeight: 1.5,
                      marginBottom: '1rem',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      flex: 1,
                    }}
                  >
                    {tool.description}
                  </p>
                )}
                {!tool.description && <div style={{ flex: 1 }} />}

                {/* Footer: contributor + try it button */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--fg-faint)' }}>
                    <div
                      style={{
                        width: '1.25rem',
                        height: '1.25rem',
                        borderRadius: '50%',
                        background: `${catColor}40`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        color: catColor,
                      }}
                    >
                      {contributor ? contributor.displayName.charAt(0).toUpperCase() : '?'}
                    </div>
                    <span>{contributor ? contributor.displayName : 'Unknown'}</span>
                    {tool.stats?.viewCount ? (
                      <span style={{ marginLeft: '0.5rem' }}>{tool.stats.viewCount} views</span>
                    ) : null}
                  </div>
                  <a
                    href={`/tools/${tool.slug}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--accent-text)',
                      background: 'var(--accent)',
                      borderRadius: 'var(--radius)',
                      textDecoration: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Try it
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
