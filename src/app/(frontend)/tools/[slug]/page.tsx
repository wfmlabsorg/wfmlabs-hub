import { getPayload } from 'payload'
import config from '@payload-config'
import { notFound } from 'next/navigation'
import { RichTextContent } from '@/components/ui/RichTextContent'
import { DiscussionSection } from '@/components/discussion/DiscussionSection'
import { ReactionBar } from '@/components/ui/ReactionBar'
import React from 'react'

const categoryColors: Record<string, string> = {
  calculator: '#3b82f6',
  analyzer: '#8b5cf6',
  simulator: '#06b6d4',
  model: '#f59e0b',
  methodology: '#10b981',
  // Legacy fallbacks
  'capacity-planning': '#3b82f6',
  forecasting: '#8b5cf6',
  scheduling: '#10b981',
  analytics: '#8b5cf6',
  'value-planning': '#f59e0b',
  staffing: '#3b82f6',
}

const categoryLabels: Record<string, string> = {
  calculator: 'Calculator',
  analyzer: 'Analyzer',
  simulator: 'Simulator',
  model: 'Model',
  methodology: 'Methodology',
  'capacity-planning': 'Calculator',
  forecasting: 'Calculator',
  scheduling: 'Calculator',
  analytics: 'Analyzer',
  'value-planning': 'Model',
  staffing: 'Calculator',
}

const domainLabels: Record<string, string> = {
  'staffing-capacity': 'Staffing & Capacity',
  'forecasting-accuracy': 'Forecasting & Accuracy',
  'workforce-economics': 'Workforce Economics',
  'operations-routing': 'Operations & Routing',
  'measurement-analytics': 'Measurement & Analytics',
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

  const reactionTypes = ['like', 'insightful', 'practical', 'question'] as const
  const reactionCounts: Record<string, number> = { like: 0, insightful: 0, practical: 0, question: 0 }
  for (const rType of reactionTypes) {
    const r = await payload.find({
      collection: 'reactions',
      where: {
        'target.relationTo': { equals: 'tools' },
        'target.value': { equals: tool.id },
        type: { equals: rType },
      },
      limit: 0,
      overrideAccess: true,
    })
    reactionCounts[rType] = r.totalDocs
  }

  const contributor =
    typeof tool.primaryContributor === 'object' &&
    tool.primaryContributor !== null &&
    'displayName' in tool.primaryContributor
      ? tool.primaryContributor
      : null

  const catColor = categoryColors[tool.category || ''] || 'var(--accent)'
  const catLabel = categoryLabels[tool.category || ''] || tool.category || ''
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const domainLabel = domainLabels[(tool as any).domain || ''] || ''

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

      {/* Header: badges + title + description introduction */}
      <div style={{ marginBottom: '1.5rem' }}>
        {/* Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
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
          {domainLabel && (
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
                background: 'var(--bg-secondary)',
                color: 'var(--fg-muted)',
              }}
            >
              {domainLabel}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.2, marginBottom: '0.75rem' }}>
          {tool.title}
        </h1>

        {/* Introduction — the description serves as the "what does this tool do" intro */}
        {tool.description && (
          <p style={{
            fontSize: '1rem',
            color: 'var(--fg-muted)',
            lineHeight: 1.7,
            maxWidth: '48rem',
            marginBottom: '0.75rem',
          }}>
            {tool.description}
          </p>
        )}

        {/* Meta line */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            fontSize: '0.8125rem',
            color: 'var(--fg-faint)',
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
                  width: '1.25rem',
                  height: '1.25rem',
                  borderRadius: '50%',
                  background: 'var(--accent-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  color: 'var(--accent)',
                }}
              >
                {(contributor as { displayName: string }).displayName.charAt(0).toUpperCase()}
              </div>
              {(contributor as { displayName: string }).displayName}
            </a>
          )}
          {tool.updatedAt && <span>Updated {formatDate(tool.updatedAt)}</span>}
          {tool.sourceCodeUrl && (
            <a href={tool.sourceCodeUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              Source code ↗
            </a>
          )}
        </div>
      </div>

      {/* Reaction bar */}
      <div style={{ marginBottom: '1.5rem' }}>
        <ReactionBar targetType="tools" targetId={tool.id} counts={reactionCounts as { like: number; insightful: number; practical: number; question: number }} />
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
                  {tool.embedUrl ? 'Live tool' : 'No embed available'}
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
                  Open full screen ↗
                </a>
              )}
            </div>
            {tool.embedUrl ? (
              <iframe
                src={tool.embedUrl}
                title={tool.title}
                style={{ width: '100%', height: '600px', border: 'none', display: 'block' }}
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

          {/* Sections: About → Methodology → Discussion (reordered) */}
          <ToolSections tool={tool} />
        </div>

        {/* Sidebar */}
        <aside className="tool-detail-sidebar" style={{ width: '16rem', flexShrink: 0 }}>
          <div style={{ position: 'sticky', top: '4.5rem' }}>
            {/* Quick actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {tool.embedUrl && (
                <a href={tool.embedUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ textAlign: 'center' }}>
                  Launch tool
                </a>
              )}
              {tool.sourceCodeUrl && (
                <a href={tool.sourceCodeUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ textAlign: 'center' }}>
                  Source code
                </a>
              )}
            </div>

            {/* Info cards */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>
                Details
              </h3>
              <div style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>
                {[
                  { label: 'Type', value: catLabel },
                  ...(domainLabel ? [{ label: 'Domain', value: domainLabel }] : []),
                  ...(tool.version ? [{ label: 'Version', value: `v${tool.version}` }] : []),
                  { label: 'Views', value: String(tool.stats?.viewCount ?? 0) },
                  { label: 'Discussions', value: String(tool.stats?.discussionCount ?? 0) },
                ].map((s) => (
                  <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0' }}>
                    <span>{s.label}</span>
                    <span style={{ fontWeight: 500, color: 'var(--fg)' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Contributor */}
            {contributor && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>
                  Contributor
                </h3>
                <a
                  href={`/member/${(contributor as { username: string }).username}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'var(--fg)', fontSize: '0.8125rem' }}
                >
                  <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '50%', background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)' }}>
                    {(contributor as { displayName: string }).displayName.charAt(0).toUpperCase()}
                  </div>
                  {(contributor as { displayName: string }).displayName}
                </a>
              </div>
            )}

            {/* Topics */}
            {tool.topics && Array.isArray(tool.topics) && tool.topics.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>
                  Topics
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                  {tool.topics.map((topic: unknown, i: number) => {
                    const name = typeof topic === 'object' && topic !== null && 'name' in (topic as Record<string, unknown>)
                      ? (topic as { name: string }).name : String(topic)
                    return <span key={i} className="topic-pill">{name}</span>
                  })}
                </div>
              </div>
            )}
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
function ToolSections({ tool }: { tool: any }) {
  const catLabel = categoryLabels[tool.category || ''] || tool.category || 'Tool'
  const domainLabel = domainLabels[(tool as any).domain || ''] || ''

  return (
    <div>
      {/* Section 1: About — What does this tool do? */}
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>
          About this {catLabel.toLowerCase()}
        </h2>
        {tool.description ? (
          <div style={{
            fontSize: '0.9375rem',
            color: 'var(--fg)',
            lineHeight: 1.8,
            marginBottom: '1rem',
          }}>
            <p style={{ margin: '0 0 1rem 0' }}>{tool.description}</p>
          </div>
        ) : (
          <p style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', fontStyle: 'italic' }}>
            Description coming soon.
          </p>
        )}

        {/* Quick facts strip */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '1rem',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          borderLeft: `3px solid ${categoryColors[tool.category || ''] || 'var(--accent)'}`,
        }}>
          {tool.category && (
            <div style={{ fontSize: '0.8125rem' }}>
              <span style={{ color: 'var(--fg-faint)' }}>Type: </span>
              <span style={{ fontWeight: 600 }}>{catLabel}</span>
            </div>
          )}
          {domainLabel && (
            <div style={{ fontSize: '0.8125rem' }}>
              <span style={{ color: 'var(--fg-faint)' }}>Domain: </span>
              <span style={{ fontWeight: 600 }}>{domainLabel}</span>
            </div>
          )}
          {tool.embedUrl && (
            <div style={{ fontSize: '0.8125rem' }}>
              <span style={{ color: 'var(--fg-faint)' }}>Access: </span>
              <span style={{ fontWeight: 600 }}>Free &amp; interactive</span>
            </div>
          )}
          {tool.sourceCodeUrl && (
            <div style={{ fontSize: '0.8125rem' }}>
              <span style={{ color: 'var(--fg-faint)' }}>Source: </span>
              <a href={tool.sourceCodeUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>
                Open source ↗
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Methodology */}
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
            Methodology documentation will be added soon. This section will cover the formulas, assumptions, and best practices behind this tool.
          </div>
        )}
      </div>

      {/* Section 3: Discussion */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
        <DiscussionSection assetType="tools" assetId={tool.id} />
      </div>
    </div>
  )
}
