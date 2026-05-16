import { getPayload } from 'payload'
import type { Where } from 'payload'
import config from '@payload-config'
import React from 'react'
import { AssetCard } from '@/components/cards/AssetCard'

export const metadata = { title: 'Tools — WFM Labs' }
export const dynamic = 'force-dynamic'

const categories = [
  { value: 'all', label: 'All Tools', icon: '🔮' },
  { value: 'calculator', label: 'Calculators', icon: '🧮' },
  { value: 'analyzer', label: 'Analyzers', icon: '📊' },
  { value: 'simulator', label: 'Simulators', icon: '🎲' },
  { value: 'model', label: 'Models', icon: '🏗️' },
  { value: 'methodology', label: 'Methodology', icon: '📐' },
]

const categoryDescriptions: Record<string, string> = {
  all: 'Interactive tools for workforce management professionals — from quick calculations to strategic planning models.',
  calculator: 'Plug in your numbers, get an answer. Erlang staffing, capacity planning, shrinkage, attrition — the daily tools of WFM.',
  analyzer: 'Upload your interval data and get back insight. Forecast accuracy, variance decomposition, statistical confidence bands.',
  simulator: 'Model scenarios before you commit. Monte Carlo distributions, campaign ROI curves, AI automation tipping points.',
  model: 'Strategic frameworks that connect operational decisions to business outcomes. Value chains, service model comparisons.',
  methodology: 'Sharpen your practice. Calibrated estimation, composite metrics, and measurement techniques for WFM professionals.',
}

export default async function ToolsBrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const resolvedParams = await searchParams
  const activeCategory = resolvedParams.category || 'all'
  const payload = await getPayload({ config })

  const whereClause: Where | undefined = activeCategory !== 'all'
    ? { category: { equals: activeCategory } }
    : undefined

  const tools = await payload
    .find({ collection: 'tools', limit: 50, sort: '-updatedAt', depth: 1, overrideAccess: true, ...(whereClause ? { where: whereClause } : {}) })
    .catch(() => ({ docs: [] }))

  const activeCat = categories.find(c => c.value === activeCategory)

  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Page header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          WFM Tools
        </h1>
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.9rem', lineHeight: 1.6, maxWidth: '48rem' }}>
          {categoryDescriptions[activeCategory] || categoryDescriptions.all}
        </p>
      </div>

      {/* Category filter chips */}
      <div className="category-chips-row">
        {categories.map((cat) => (
          <a
            key={cat.value}
            href={cat.value === 'all' ? '/tools' : `/tools?category=${cat.value}`}
            className={`category-chip ${cat.value === activeCategory ? 'category-chip-active' : ''}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <span className="category-chip-icon">{cat.icon}</span>
            {cat.label}
          </a>
        ))}
      </div>

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
          {activeCat?.icon || '🔮'} {activeCat?.label || 'All Tools'}
        </h2>
        <span style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>
          {tools.docs.length} {tools.docs.length === 1 ? 'Tool' : 'Tools'}
        </span>
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
            No tools in this category
          </p>
          <p style={{ fontSize: '0.875rem' }}>
            Check back soon — we&apos;re building new tools regularly.
          </p>
        </div>
      ) : (
        <div className="tools-grid">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {tools.docs.map((tool: any) => (
            <AssetCard
              key={tool.id}
              title={tool.title}
              description={tool.description}
              slug={tool.slug}
              assetType="tool"
              category={tool.category || null}
              domain={tool.domain || null}
              status={tool.status}
              tier={tool.tier}
              stats={tool.stats}
              primaryContributor={tool.primaryContributor}
              isFeatured={tool.isFeatured}
              updatedAt={tool.updatedAt}
              createdAt={tool.createdAt}
              href={`/tools/${tool.slug}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
