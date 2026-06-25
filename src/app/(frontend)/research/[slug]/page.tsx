import { getPayload } from 'payload'
import config from '@payload-config'
import { notFound } from 'next/navigation'
import { RichTextContent } from '@/components/ui/RichTextContent'
import { DiscussionSection } from '@/components/discussion/DiscussionSection'
import { ReactionBar } from '@/components/ui/ReactionBar'
import React from 'react'

const sourceTypeLabels: Record<string, string> = {
  arxiv: 'arXiv',
  ssrn: 'SSRN',
  journal: 'Journal',
  'industry-report': 'Industry Report',
  blog: 'Blog',
  'vendor-research': 'Vendor Research',
  manual: 'Manual',
}

const sourceTypeColors: Record<string, string> = {
  arxiv: '#ef4444',
  ssrn: '#f59e0b',
  journal: '#3b82f6',
  'industry-report': '#8b5cf6',
  blog: '#10b981',
  'vendor-research': '#6366f1',
  manual: '#6b7280',
}

const paperTypeLabels: Record<string, string> = {
  'empirical-study': 'Empirical Study',
  'literature-review': 'Literature Review',
  'mathematical-model': 'Mathematical Model',
  'industry-report': 'Industry Report',
  'framework': 'Framework',
  'case-study': 'Case Study',
  'reference': 'Reference',
}

const paperTypeIcons: Record<string, string> = {
  'empirical-study': '🔬',
  'literature-review': '📚',
  'mathematical-model': '📐',
  'industry-report': '📈',
  'framework': '🧩',
  'case-study': '🏢',
  'reference': '📖',
}

const paperTypeColors: Record<string, string> = {
  'empirical-study': '#22d3ee',
  'literature-review': '#8b5cf6',
  'mathematical-model': '#3b82f6',
  'industry-report': '#f59e0b',
  'framework': '#10b981',
  'case-study': '#f43f5e',
  'reference': '#64748b',
}

const paperDomainLabels: Record<string, string> = {
  'queuing-theory': 'Queuing Theory',
  'ai-machine-learning': 'AI & ML',
  'operations-management': 'Operations',
  'workforce-management': 'Workforce',
  'customer-experience': 'Customer Experience',
  'analytics-forecasting': 'Forecasting',
  'process-optimization': 'Optimization',
  'technology': 'Technology',
  'economics-finance': 'Economics',
  'employee-wellbeing': 'Well-Being',
  'contact-center-operations': 'Contact Center',
  'scheduling-optimization': 'Scheduling',
}

const statusColors: Record<string, string> = {
  published: '#10b981',
  draft: '#6b7280',
  proposed: '#f59e0b',
  refined: '#3b82f6',
  mature: '#8b5cf6',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default async function ResearchDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'papers',
    where: { slug: { equals: slug } },
    depth: 2,
    limit: 1,
    overrideAccess: true,
  })

  const paper = result.docs[0]
  if (!paper) notFound()
  // Corpus visibility (research-029): in-review papers (draft/proposed, e.g. a just-published Beacon
  // paper) stay member-private until a curator ratifies them — 404 on direct slug access too.
  if (paper.status === 'draft' || paper.status === 'proposed') notFound()

  // Fetch reaction counts
  const reactionTypes = ['like', 'insightful', 'practical', 'question'] as const
  const reactionCounts: Record<string, number> = { like: 0, insightful: 0, practical: 0, question: 0 }
  for (const rType of reactionTypes) {
    const r = await payload.find({
      collection: 'reactions',
      where: {
        'target.relationTo': { equals: 'papers' },
        'target.value': { equals: paper.id },
        type: { equals: rType },
      },
      limit: 0,
      overrideAccess: true,
    })
    reactionCounts[rType] = r.totalDocs
  }

  const contributor =
    typeof paper.primaryContributor === 'object' &&
    paper.primaryContributor !== null &&
    'displayName' in paper.primaryContributor
      ? (paper.primaryContributor as { displayName: string; username: string })
      : null

  const stColor = sourceTypeColors[paper.sourceType || ''] || '#6b7280'
  const stLabel = sourceTypeLabels[paper.sourceType || ''] || paper.sourceType || ''
  const sColor = statusColors[paper.status || ''] || '#6b7280'
  const ptColor = paperTypeColors[paper.paperType || ''] || '#6b7280'
  const ptLabel = paper.paperType ? paperTypeLabels[paper.paperType] : null
  const ptIcon = paper.paperType ? paperTypeIcons[paper.paperType] : null
  const domainLabel = paper.category ? paperDomainLabels[paper.category] : null

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
        <a href="/research" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Research</a>
        <span>/</span>
        <span style={{ color: 'var(--fg)' }}>{paper.title}</span>
      </nav>

      {/* Header badges */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1rem',
          flexWrap: 'wrap',
        }}
      >
        {ptLabel && (
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
              background: `${ptColor}20`,
              color: ptColor,
            }}
          >
            {ptIcon} {ptLabel}
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
              background: 'var(--bg-subtle)',
              color: 'var(--fg-muted)',
              border: '1px solid var(--border)',
            }}
          >
            {domainLabel}
          </span>
        )}
        {stLabel && (
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
              background: `${stColor}20`,
              color: stColor,
            }}
          >
            {stLabel}
          </span>
        )}
        {paper.status && (
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
            {paper.status}
          </span>
        )}
      </div>

      {/* Title */}
      <h1 style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.2, marginBottom: '0.75rem' }}>
        {paper.title}
      </h1>

      {/* Authors list */}
      {paper.authors && paper.authors.length > 0 && (
        <div style={{ marginBottom: '0.75rem', fontSize: '0.9375rem', color: 'var(--fg-muted)' }}>
          {paper.authors.map((a, i) => (
            <span key={i}>
              {i > 0 && ', '}
              <span style={{ fontWeight: 500, color: 'var(--fg)' }}>{a.name}</span>
              {a.affiliation && <span style={{ color: 'var(--fg-faint)' }}> ({a.affiliation})</span>}
            </span>
          ))}
        </div>
      )}

      {/* Meta row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          fontSize: '0.8125rem',
          color: 'var(--fg-muted)',
          marginBottom: '1rem',
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
            Curated by {contributor.displayName}
          </a>
        )}
        {paper.publishedAt && <span>Published {formatDate(paper.publishedAt)}</span>}
        {paper.updatedAt && <span>Updated {formatDate(paper.updatedAt)}</span>}
      </div>

      {/* Source link + actions */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {paper.sourceUrl && (
          <a
            href={paper.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ fontSize: '0.8125rem' }}
          >
            Read Original &#8599;
          </a>
        )}
        {paper.pdfFile && typeof paper.pdfFile === 'object' && 'url' in paper.pdfFile && (
          <a
            href={(paper.pdfFile as { url: string }).url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ fontSize: '0.8125rem' }}
          >
            Download PDF
          </a>
        )}
      </div>

      {/* Reaction bar */}
      <div style={{ marginBottom: '1.5rem' }}>
        <ReactionBar targetType="papers" targetId={paper.id} counts={reactionCounts as { like: number; insightful: number; practical: number; question: number }} />
      </div>

      {/* Main layout: content + sidebar */}
      <div style={{ display: 'flex', gap: '2.5rem' }}>
        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Abstract */}
          {paper.abstract && (
            <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '0.75rem' }}>Abstract</h2>
              <p style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', lineHeight: 1.7 }}>{paper.abstract}</p>
            </div>
          )}

          {/* Curator Summary */}
          {paper.curatorSummary && (
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: 'var(--accent)' }}>&#9733;</span> Curator Summary
              </h2>
              <div style={{ padding: '1rem 1.25rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', borderLeft: '3px solid var(--accent)' }}>
                <RichTextContent content={paper.curatorSummary} />
              </div>
            </div>
          )}

          {/* Why It Matters */}
          {paper.whyItMatters && (
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>Why It Matters</h2>
              <RichTextContent content={paper.whyItMatters} />
            </div>
          )}

          {/* Caveats */}
          {paper.caveats && (
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>Caveats</h2>
              <div style={{ padding: '1rem 1.25rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', borderLeft: '3px solid #f59e0b' }}>
                <RichTextContent content={paper.caveats} />
              </div>
            </div>
          )}

          {/* Discussion section */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem', marginTop: '1rem' }}>
            <DiscussionSection assetType="papers" assetId={paper.id} />
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
            {/* Source info */}
            {paper.sourceType && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>
                  Source
                </h3>
                <span
                  style={{
                    display: 'inline-flex',
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: 'var(--radius)',
                    background: `${stColor}15`,
                    color: stColor,
                  }}
                >
                  {stLabel}
                </span>
                {paper.sourceName && (
                  <div style={{ marginTop: '0.375rem', fontSize: '0.8125rem', color: 'var(--fg)', fontWeight: 500 }}>
                    {paper.sourceName}
                  </div>
                )}
                {paper.sourceUrl && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <a href={paper.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', color: 'var(--accent)' }}>
                      View original &#8599;
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Category */}
            {paper.category && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>
                  Category
                </h3>
                <span className="topic-pill">
                  {paper.category.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </span>
              </div>
            )}

            {/* Authors */}
            {paper.authors && paper.authors.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>
                  Authors
                </h3>
                {paper.authors.map((a, i) => (
                  <div key={i} style={{ fontSize: '0.8125rem', marginBottom: '0.375rem' }}>
                    <span style={{ fontWeight: 500 }}>{a.name}</span>
                    {a.affiliation && <div style={{ color: 'var(--fg-faint)', fontSize: '0.75rem' }}>{a.affiliation}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Topics */}
            {paper.topics && Array.isArray(paper.topics) && paper.topics.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>
                  Topics
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                  {paper.topics.map((topic: unknown, i: number) => {
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
            {paper.stats && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>
                  Stats
                </h3>
                <div style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>
                  {[
                    { label: 'Views', value: paper.stats.viewCount },
                    { label: 'Discussions', value: paper.stats.discussionCount },
                    { label: 'Reactions', value: paper.stats.reactionCount },
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

            {/* Contributor */}
            {contributor && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>
                  Curator
                </h3>
                <a
                  href={`/member/${contributor.username}`}
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
                    {contributor.displayName.charAt(0).toUpperCase()}
                  </div>
                  {contributor.displayName}
                </a>
              </div>
            )}

            {/* Related papers placeholder */}
            <div>
              <h3 style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>
                Related Papers
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
          .detail-sidebar { display: none !important; }
        }
      `}</style>
    </div>
  )
}
