import { getPayload } from 'payload'
import config from '@payload-config'
import React from 'react'
import { AssetCard } from '@/components/cards/AssetCard'

export const metadata = { title: 'Research | WFM Labs Hub' }

const categories = [
  { value: 'all', label: 'All' },
  { value: 'queueing-theory', label: 'Queueing Theory' },
  { value: 'ai-in-operations', label: 'AI in Operations' },
  { value: 'workforce-economics', label: 'Workforce Economics' },
  { value: 'value-model', label: 'Value Model' },
  { value: 'agent-experience', label: 'Agent Experience' },
  { value: 'forecasting', label: 'Forecasting' },
]

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

export default async function ResearchBrowsePage() {
  const payload = await getPayload({ config })
  const papers = await payload
    .find({ collection: 'papers', limit: 50, sort: '-createdAt', depth: 1, overrideAccess: true })
    .catch(() => ({ docs: [] }))

  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Research
          </h1>
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.875rem' }}>
            Curated academic papers, industry reports, and vendor research with practitioner commentary.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select className="input" style={{ width: 'auto', fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}>
            <option>Sort: Recent</option>
            <option>Sort: Most Discussed</option>
            <option>Sort: Most Liked</option>
          </select>
        </div>
      </div>

      {/* Category filter chips */}
      <div className="category-chips-row">
        {categories.map((cat) => (
          <span
            key={cat.value}
            className={`category-chip ${cat.value === 'all' ? 'category-chip-active' : ''}`}
          >
            {cat.label}
          </span>
        ))}
      </div>

      {/* Featured section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
          Featured Research
        </h2>
        <span style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>
          {papers.docs.length} {papers.docs.length === 1 ? 'Paper' : 'Papers'}
        </span>
      </div>

      {/* Paper cards grid */}
      {papers.docs.length === 0 ? (
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
            No papers yet
          </p>
          <p style={{ fontSize: '0.875rem' }}>
            Research papers will appear here once published.
          </p>
        </div>
      ) : (
        <div className="tools-grid">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {papers.docs.map((paper: any) => {
            const stColor = sourceTypeColors[paper.sourceType || ''] || '#6b7280'
            const stLabel = sourceTypeLabels[paper.sourceType || ''] || paper.sourceType || ''
            const authorNames = paper.authors?.map((a: { name: string }) => a.name).join(', ')

            return (
              <a key={paper.id} href={`/research/${paper.slug}`} className="asset-card-link">
                <div className="asset-card">
                  {/* Gradient header — blue/indigo for research */}
                  <div className="asset-card-gradient" style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)' }}>
                    <div className="asset-card-badges">
                      <div className="asset-card-badges-left">
                        {stLabel && (
                          <span
                            className="asset-card-badge"
                            style={{ background: `${stColor}cc`, color: '#fff' }}
                          >
                            {stLabel}
                          </span>
                        )}
                      </div>
                      <div className="asset-card-badges-right">
                        <span className="asset-card-badge">
                          &#9829; {paper.stats?.reactionCount || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="asset-card-content">
                    <h3 className="asset-card-title">{paper.title}</h3>

                    {authorNames && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', marginBottom: '0.25rem', lineHeight: 1.4 }}>
                        {authorNames}
                      </p>
                    )}

                    {paper.description && (
                      <p className="asset-card-description">{paper.description}</p>
                    )}
                    {!paper.description && !authorNames && <div style={{ flex: 1 }} />}

                    <div className="asset-card-footer">
                      <div className="asset-card-contributor">
                        <div className="asset-card-avatar">
                          {typeof paper.primaryContributor === 'object' && paper.primaryContributor?.displayName
                            ? paper.primaryContributor.displayName.charAt(0).toUpperCase()
                            : '?'}
                        </div>
                        <span>
                          {typeof paper.primaryContributor === 'object' && paper.primaryContributor?.displayName
                            ? paper.primaryContributor.displayName
                            : 'Unknown'}
                        </span>
                      </div>
                      {paper.createdAt && (
                        <span className="asset-card-time">
                          {new Date(paper.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
