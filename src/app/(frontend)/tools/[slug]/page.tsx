import { getPayload } from 'payload'
import config from '@payload-config'
import { notFound } from 'next/navigation'
import { RichTextContent } from '@/components/ui/RichTextContent'
import React from 'react'

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

const statusColors: Record<string, string> = {
  published: '#10b981',
  draft: '#6b7280',
  proposed: '#f59e0b',
  refined: '#3b82f6',
  mature: '#8b5cf6',
  deprecated: '#ef4444',
}

const tierColors: Record<string, string> = {
  public: '#10b981',
  free: '#3b82f6',
  practitioner: '#f59e0b',
  'practitioner-plus': '#ef4444',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default async function ToolDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'tools',
    where: { slug: { equals: slug } },
    depth: 2,
    limit: 1,
    overrideAccess: true,
  })

  const tool = result.docs[0]
  if (!tool) notFound()

  const contributor =
    typeof tool.primaryContributor === 'object' &&
    tool.primaryContributor !== null &&
    'displayName' in tool.primaryContributor
      ? tool.primaryContributor
      : null

  const catColor = categoryColors[tool.category || ''] || 'var(--accent)'
  const catLabel = categoryLabels[tool.category || ''] || tool.category || ''
  const sColor = statusColors[tool.status || ''] || '#6b7280'
  const tColor = tierColors[tool.tier || ''] || '#6b7280'

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
        <a href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Home</a>
        <span>/</span>
        <a href="/tools" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Tools</a>
        <span>/</span>
        <span style={{ color: 'var(--fg)' }}>{tool.title}</span>
      </nav>

      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        }}
      >
        {/* Category badge */}
        {tool.category && (
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
              background: `${catColor}20`,
              color: catColor,
            }}
          >
            {catLabel}
          </span>
        )}
        {/* Status badge */}
        {tool.status && (
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
              background: `${sColor}20`,
              color: sColor,
            }}
          >
            {tool.status}
          </span>
        )}
        {/* Tier badge */}
        {tool.tier && (
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
              background: `${tColor}20`,
              color: tColor,
            }}
          >
            {tool.tier}
          </span>
        )}
      </div>

      {/* Title row */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.2, marginBottom: '0.5rem' }}>
          {tool.title}
        </h1>
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
              href={`/member/${(contributor as { username: string }).username}`}
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
                {(contributor as { displayName: string }).displayName.charAt(0).toUpperCase()}
              </div>
              by {(contributor as { displayName: string }).displayName}
            </a>
          )}
          {tool.version && <span>v{tool.version}</span>}
          {tool.updatedAt && <span>Updated {formatDate(tool.updatedAt)}</span>}
        </div>
      </div>

      {/* Main layout: content + sidebar */}
      <div style={{ display: 'flex', gap: '2rem' }}>
        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Embedded tool iframe */}
          <div
            style={{
              marginBottom: '1.5rem',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              background: 'var(--bg-card)',
            }}
          >
            {/* Iframe toolbar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 1rem',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                fontSize: '0.8125rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: tool.embedUrl ? '#10b981' : '#6b7280' }} />
                <span style={{ color: 'var(--fg-muted)' }}>
                  {tool.embedUrl ? 'Live Tool' : 'No embed available'}
                </span>
              </div>
              {tool.embedUrl && (
                <a
                  href={tool.embedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.25rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'var(--fg)',
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    textDecoration: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Launch in new tab ↗
                </a>
              )}
            </div>
            {/* Iframe or placeholder */}
            {tool.embedUrl ? (
              <iframe
                src={tool.embedUrl}
                title={tool.title}
                style={{
                  width: '100%',
                  height: '600px',
                  border: 'none',
                  display: 'block',
                }}
                allow="clipboard-write; clipboard-read"
                loading="lazy"
              />
            ) : (
              <div
                style={{
                  height: '400px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--fg-muted)',
                  gap: '0.75rem',
                }}
              >
                <div style={{ fontSize: '2.5rem', opacity: 0.3 }}>&#9881;</div>
                <p style={{ fontSize: '0.9375rem' }}>Tool embed not available yet</p>
                <p style={{ fontSize: '0.8125rem', opacity: 0.7 }}>Check back soon or contact the contributor</p>
              </div>
            )}
          </div>

          {/* Tabs */}
          <ToolTabs tool={tool} />
        </div>

        {/* Sidebar */}
        <aside
          className="tool-detail-sidebar"
          style={{
            width: '16rem',
            flexShrink: 0,
          }}
        >
          <div style={{ position: 'sticky', top: '4.5rem' }}>
            {/* Topics */}
            {tool.topics && Array.isArray(tool.topics) && tool.topics.length > 0 && (
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
                  {tool.topics.map((topic: unknown, i: number) => {
                    const name =
                      typeof topic === 'object' && topic !== null && 'name' in (topic as Record<string, unknown>)
                        ? (topic as { name: string }).name
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
            {tool.stats && (
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
                    { label: 'Views', value: tool.stats.viewCount },
                    { label: 'Discussions', value: tool.stats.discussionCount },
                    { label: 'Reactions', value: tool.stats.reactionCount },
                  ].map((s) => (
                    <div
                      key={s.label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.25rem 0',
                      }}
                    >
                      <span>{s.label}</span>
                      <span style={{ fontWeight: 500, color: 'var(--fg)' }}>{s.value ?? 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contributors */}
            {contributor && (
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
                  Contributors
                </h3>
                <a
                  href={`/member/${(contributor as { username: string }).username}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    textDecoration: 'none',
                    color: 'var(--fg)',
                    fontSize: '0.8125rem',
                  }}
                >
                  <div
                    style={{
                      width: '1.75rem',
                      height: '1.75rem',
                      borderRadius: '50%',
                      background: 'var(--accent-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--accent)',
                    }}
                  >
                    {(contributor as { displayName: string }).displayName.charAt(0).toUpperCase()}
                  </div>
                  {(contributor as { displayName: string }).displayName}
                </a>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {tool.embedUrl && (
                <a
                  href={tool.embedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ textAlign: 'center' }}
                >
                  Launch Tool
                </a>
              )}
              {tool.sourceCodeUrl && (
                <a
                  href={tool.sourceCodeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ textAlign: 'center' }}
                >
                  Source Code
                </a>
              )}
            </div>

            {/* Related assets placeholder */}
            <div style={{ marginTop: '1.5rem' }}>
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
                Related Assets
              </h3>
              <div
                style={{
                  padding: '1rem',
                  border: '1px dashed var(--border)',
                  borderRadius: 'var(--radius)',
                  textAlign: 'center',
                  fontSize: '0.8125rem',
                  color: 'var(--fg-faint)',
                }}
              >
                Coming soon
              </div>
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .tool-detail-sidebar { display: none !important; }
        }
      `}</style>
    </div>
  )
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function ToolTabs({ tool }: { tool: any }) {
  // Server component — render all tabs, use CSS to show/hide via :target or just show all stacked
  // Since this is a server component, we render all content in a tabbed visual layout
  return (
    <div>
      {/* Tab headers */}
      <div
        style={{
          display: 'flex',
          borderBottom: '2px solid var(--border)',
          marginBottom: '1.5rem',
          gap: '0',
        }}
      >
        {['Methodology', 'About', 'Discussion'].map((tab, i) => (
          <div
            key={tab}
            style={{
              padding: '0.625rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: i === 0 ? 'var(--accent)' : 'var(--fg-muted)',
              borderBottom: i === 0 ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: '-2px',
              cursor: 'default',
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* Methodology section */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Methodology</h2>
        {tool.methodology ? (
          <RichTextContent content={tool.methodology} />
        ) : (
          <div
            style={{
              padding: '2rem',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-lg)',
              textAlign: 'center',
              color: 'var(--fg-muted)',
              fontSize: '0.875rem',
            }}
          >
            Methodology documentation will be added by the contributor.
          </div>
        )}
      </div>

      {/* About section */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>About</h2>
        {tool.description && (
          <p style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', lineHeight: 1.7, marginBottom: '1rem' }}>
            {tool.description}
          </p>
        )}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(12rem, 1fr))',
            gap: '1rem',
          }}
        >
          {tool.version && (
            <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', fontSize: '0.8125rem' }}>
              <div style={{ color: 'var(--fg-faint)', marginBottom: '0.25rem' }}>Version</div>
              <div style={{ fontWeight: 600 }}>{tool.version}</div>
            </div>
          )}
          {tool.category && (
            <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', fontSize: '0.8125rem' }}>
              <div style={{ color: 'var(--fg-faint)', marginBottom: '0.25rem' }}>Category</div>
              <div style={{ fontWeight: 600 }}>{categoryLabels[tool.category] || tool.category}</div>
            </div>
          )}
          {tool.sourceCodeUrl && (
            <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', fontSize: '0.8125rem' }}>
              <div style={{ color: 'var(--fg-faint)', marginBottom: '0.25rem' }}>Source Code</div>
              <a href={tool.sourceCodeUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: 'var(--accent)' }}>
                View Repository
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Discussion section */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Discussion</h2>
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
  )
}
