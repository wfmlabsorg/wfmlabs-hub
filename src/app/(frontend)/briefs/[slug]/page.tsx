import { getPayload } from 'payload'
import config from '@payload-config'
import { notFound } from 'next/navigation'
import { RichTextContent } from '@/components/ui/RichTextContent'
import { DiscussionSection } from '@/components/discussion/DiscussionSection'
import React from 'react'

const categoryColors: Record<string, { bg: string; fg: string; border: string }> = {
  weather: { bg: '#dbeafe', fg: '#1e40af', border: '#3b82f6' },
  seismic: { bg: '#ffe4e6', fg: '#9f1239', border: '#f43f5e' },
  disaster: { bg: '#fee2e2', fg: '#991b1b', border: '#ef4444' },
  cyber: { bg: '#d1fae5', fg: '#065f46', border: '#22c55e' },
  health: { bg: '#fce7f3', fg: '#9d174d', border: '#ec4899' },
  infrastructure: { bg: '#ede9fe', fg: '#5b21b6', border: '#8b5cf6' },
  financial: { bg: '#fef3c7', fg: '#92400e', border: '#f59e0b' },
  environmental: { bg: '#ccfbf1', fg: '#115e59', border: '#14b8a6' },
  summary: { bg: '#e0e7ff', fg: '#3730a3', border: '#6366f1' },
  general: { bg: '#f1f5f9', fg: '#475569', border: '#94a3b8' },
}

const categoryLabels: Record<string, string> = {
  weather: 'Weather', seismic: 'Seismic', disaster: 'Disaster',
  cyber: 'Cyber', health: 'Health', infrastructure: 'Infrastructure',
  financial: 'Financial', environmental: 'Environmental',
  summary: 'Summary', general: 'General',
}

const severityColors: Record<string, string> = {
  extreme: '#e74c3c', severe: '#eab308', moderate: '#3498db', info: '#27ae60',
}

export default async function BriefDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'briefs',
    where: { slug: { equals: slug } },
    depth: 2,
    limit: 1,
    overrideAccess: true,
  })

  const brief = result.docs[0] as any
  if (!brief) notFound()

  const colors = categoryColors[brief.category] || categoryColors.general
  const sevColor = severityColors[brief.severityLabel || 'info'] || severityColors.info
  const agent =
    typeof brief.agent === 'object' && brief.agent
      ? brief.agent
      : null

  return (
    <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      {/* Breadcrumbs */}
      <div style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', marginBottom: '1.5rem' }}>
        <a href="/" style={{ color: 'var(--fg-faint)', textDecoration: 'none' }}>Home</a>
        <span style={{ margin: '0 0.5rem' }}>/</span>
        <a href="/briefs" style={{ color: 'var(--fg-faint)', textDecoration: 'none' }}>Briefs</a>
        <span style={{ margin: '0 0.5rem' }}>/</span>
        <span style={{ color: 'var(--fg-muted)' }}>{brief.title.slice(0, 40)}{brief.title.length > 40 ? '...' : ''}</span>
      </div>

      {/* Category band */}
      <div
        style={{
          borderLeft: `4px solid ${colors.border}`,
          paddingLeft: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Badges */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '0.25rem 0.625rem',
              borderRadius: '0.25rem',
              background: colors.bg,
              color: colors.fg,
            }}
          >
            {categoryLabels[brief.category] || brief.category}
          </span>
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              padding: '0.25rem 0.625rem',
              borderRadius: '0.25rem',
              background: 'var(--bg-secondary)',
              color: 'var(--fg-muted)',
              textTransform: 'uppercase',
            }}
          >
            {brief.briefType === 'summary' ? 'Daily Summary' : brief.briefType === 'analysis' ? 'Event Analysis' : 'Incident Brief'}
          </span>
          {brief.severity != null && (
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: sevColor,
              }}
            >
              Severity {brief.severity.toFixed(1)}/10
            </span>
          )}
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, lineHeight: 1.2, marginBottom: '0.5rem' }}>
          {brief.title}
        </h1>

        {/* Meta */}
        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--fg-faint)', flexWrap: 'wrap' }}>
          {agent && (
            <span>
              <span style={{ fontWeight: 500, color: 'var(--fg-muted)' }}>{agent.displayName || agent.username}</span>
            </span>
          )}
          {brief.publishedAt && (
            <span>Published {new Date(brief.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          )}
          {brief.regionName && <span>{brief.regionName}</span>}
        </div>
      </div>

      {/* Excerpt */}
      {brief.excerpt && (
        <p style={{
          fontSize: '1.0625rem',
          color: 'var(--fg-muted)',
          lineHeight: 1.6,
          fontStyle: 'italic',
          marginBottom: '1.5rem',
          paddingBottom: '1.5rem',
          borderBottom: '1px solid var(--border)',
        }}>
          {brief.excerpt}
        </p>
      )}

      {/* Body */}
      <div style={{ marginBottom: '2rem' }}>
        <RichTextContent content={brief.body} />
      </div>

      {/* Discussion */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem', marginTop: '2rem' }}>
        <DiscussionSection assetType="briefs" assetId={brief.id} />
      </div>
    </div>
  )
}
