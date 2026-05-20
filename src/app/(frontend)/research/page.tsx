import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import React from 'react'
import { AssetCard } from '@/components/cards/AssetCard'

export const metadata = { title: 'Research | WFM Labs Hub' }
export const dynamic = 'force-dynamic'

const PAPERS_PER_PAGE = 24

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

function buildFilterUrl(type: string, domain: string, page?: number) {
  const params = new URLSearchParams()
  if (type !== 'all') params.set('type', type)
  if (domain !== 'all') params.set('domain', domain)
  if (page && page > 1) params.set('page', String(page))
  const qs = params.toString()
  return `/research${qs ? `?${qs}` : ''}`
}

export default async function ResearchBrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; domain?: string; page?: string }>
}) {
  const resolvedParams = await searchParams
  const activeType = resolvedParams.type || 'all'
  const activeDomain = resolvedParams.domain || 'all'
  const currentPage = Math.max(1, parseInt(resolvedParams.page || '1', 10))

  const payload = await getPayload({ config })

  // Build where clause
  const conditions: Where[] = []
  if (activeType !== 'all') conditions.push({ paperType: { equals: activeType } })
  if (activeDomain !== 'all') conditions.push({ category: { equals: activeDomain } })

  const whereClause: Where = conditions.length > 0
    ? { and: conditions }
    : {}

  const papers = await payload
    .find({
      collection: 'papers',
      limit: PAPERS_PER_PAGE,
      page: currentPage,
      sort: '-createdAt',
      depth: 1,
      overrideAccess: true,
      where: whereClause,
    })
    .catch(() => ({ docs: [], totalDocs: 0, totalPages: 1, page: 1 }))

  const totalDocs = (papers as any).totalDocs || papers.docs.length
  const totalPages = (papers as any).totalPages || 1

  const activeTypeInfo = paperTypes.find((t) => t.value === activeType)

  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Page header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
          Research
        </h1>
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.875rem' }}>
          Curated academic papers, industry reports, and vendor research with practitioner commentary.
        </p>
      </div>

      {/* Paper type filter chips */}
      <div className="category-chips-row" style={{ marginBottom: '0.5rem', paddingBottom: '0.75rem' }}>
        {paperTypes.map((pt) => (
          <a
            key={pt.value}
            href={buildFilterUrl(pt.value, activeDomain)}
            className={`category-chip ${pt.value === activeType ? 'category-chip-active' : ''}`}
            style={{ textDecoration: 'none', color: 'inherit', whiteSpace: 'nowrap' }}
          >
            <span className="category-chip-icon">{pt.icon}</span>
            {pt.label}
          </a>
        ))}
      </div>

      {/* Domain filter chips */}
      <div className="category-chips-row" style={{ marginBottom: '1.5rem', paddingBottom: '0.75rem' }}>
        {domains.map((d) => (
          <a
            key={d.value}
            href={buildFilterUrl(activeType, d.value)}
            className={`category-chip ${d.value === activeDomain ? 'category-chip-active' : ''}`}
            style={{
              textDecoration: 'none',
              color: 'inherit',
              fontSize: '0.75rem',
              padding: '0.25rem 0.625rem',
              whiteSpace: 'nowrap',
            }}
          >
            {d.label}
          </a>
        ))}
      </div>

      {/* Section header with count */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
          {activeTypeInfo?.icon || '📄'} {activeTypeInfo?.label || 'All Research'}
          {activeDomain !== 'all' && (
            <span style={{ fontWeight: 400, color: 'var(--fg-muted)', fontSize: '0.9375rem' }}>
              {' '}/ {domains.find((d) => d.value === activeDomain)?.label}
            </span>
          )}
        </h2>
        <span style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>
          {totalDocs} {totalDocs === 1 ? 'Paper' : 'Papers'}
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
            No papers match these filters
          </p>
          <p style={{ fontSize: '0.875rem' }}>
            Try a different combination of research type and domain.
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

      {/* Pagination */}
      {totalPages > 1 && (
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            marginTop: '2rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--border)',
          }}
        >
          {currentPage > 1 && (
            <a
              href={buildFilterUrl(activeType, activeDomain, currentPage - 1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.5rem 1rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
                textDecoration: 'none',
                background: 'var(--bg)',
              }}
            >
              Previous
            </a>
          )}

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <a
              key={pageNum}
              href={buildFilterUrl(activeType, activeDomain, pageNum)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2.25rem',
                height: '2.25rem',
                fontSize: '0.8125rem',
                fontWeight: pageNum === currentPage ? 700 : 400,
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                color: pageNum === currentPage ? '#fff' : 'var(--fg)',
                background: pageNum === currentPage ? 'var(--accent)' : 'var(--bg)',
                textDecoration: 'none',
              }}
            >
              {pageNum}
            </a>
          ))}

          {currentPage < totalPages && (
            <a
              href={buildFilterUrl(activeType, activeDomain, currentPage + 1)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.5rem 1rem',
                fontSize: '0.8125rem',
                fontWeight: 500,
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                color: 'var(--fg)',
                textDecoration: 'none',
                background: 'var(--bg)',
              }}
            >
              Next
            </a>
          )}
        </nav>
      )}
    </div>
  )
}
