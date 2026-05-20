import { getPayload } from 'payload'
import config from '@payload-config'
import React from 'react'
import { AssetCard } from '@/components/cards/AssetCard'

export const metadata = { title: 'Research | WFM Labs Hub' }
export const dynamic = 'force-dynamic'

const paperTypes = [
  { value: 'all', label: 'All Research', icon: '📄' },
  { value: 'empirical-study', label: 'Empirical Studies', icon: '🔬' },
  { value: 'literature-review', label: 'Literature Reviews', icon: '📚' },
  { value: 'mathematical-model', label: 'Mathematical Models', icon: '📐' },
  { value: 'industry-report', label: 'Industry Reports', icon: '📈' },
  { value: 'framework', label: 'Frameworks', icon: '🧩' },
  { value: 'case-study', label: 'Case Studies', icon: '🏢' },
  { value: 'reference', label: 'Reference', icon: '📖' },
]

const domains = [
  { value: 'all', label: 'All Domains' },
  { value: 'employee-wellbeing', label: 'Well-Being' },
  { value: 'workforce-management', label: 'Workforce' },
  { value: 'ai-machine-learning', label: 'AI & ML' },
  { value: 'process-optimization', label: 'Optimization' },
  { value: 'analytics-forecasting', label: 'Forecasting' },
  { value: 'queuing-theory', label: 'Queuing Theory' },
  { value: 'contact-center-operations', label: 'Contact Center' },
  { value: 'customer-experience', label: 'Customer Experience' },
  { value: 'technology', label: 'Technology' },
  { value: 'operations-management', label: 'Operations' },
  { value: 'scheduling-optimization', label: 'Scheduling' },
  { value: 'economics-finance', label: 'Economics' },
]

export default async function ResearchBrowsePage() {
  const payload = await getPayload({ config })
  const papers = await payload
    .find({ collection: 'papers', limit: 200, sort: '-createdAt', depth: 1, overrideAccess: true })
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

      {/* Paper type filter chips */}
      <div className="category-chips-row">
        {paperTypes.map((pt) => (
          <span
            key={pt.value}
            className={`category-chip ${pt.value === 'all' ? 'category-chip-active' : ''}`}
          >
            {pt.icon} {pt.label}
          </span>
        ))}
      </div>

      {/* Domain filter chips (secondary row) */}
      <div className="category-chips-row" style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
        {domains.map((d) => (
          <span
            key={d.value}
            className={`category-chip ${d.value === 'all' ? 'category-chip-active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
          >
            {d.label}
          </span>
        ))}
      </div>

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
          Research Library
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
          {papers.docs.map((paper: any) => (
            <AssetCard
              key={paper.id}
              title={paper.title}
              description={paper.description}
              slug={paper.slug}
              assetType="paper"
              category={paper.category}
              paperType={paper.paperType}
              sourceType={paper.sourceType}
              sourceName={paper.sourceName}
              authors={paper.authors}
              stats={paper.stats}
              href={`/research/${paper.slug}`}
              isFeatured={paper.isFeatured}
              updatedAt={paper.updatedAt}
              createdAt={paper.createdAt}
            />
          ))}
        </div>
      )}
    </div>
  )
}
