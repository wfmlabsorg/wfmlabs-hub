import { getPayload } from 'payload'
import config from '@payload-config'
import React from 'react'
import { AssetCard } from '@/components/cards/AssetCard'

export const metadata = { title: 'Tools' }
export const dynamic = 'force-dynamic'

const categories = [
  { value: 'all', label: 'All', icon: '🔮' },
  { value: 'capacity-planning', label: 'Capacity Planning', icon: '📊' },
  { value: 'forecasting', label: 'Forecasting', icon: '📈' },
  { value: 'scheduling', label: 'Scheduling', icon: '📅' },
  { value: 'analytics', label: 'Analytics', icon: '🔍' },
  { value: 'value-planning', label: 'Value Planning', icon: '💰' },
  { value: 'staffing', label: 'Staffing', icon: '👥' },
]

export default async function ToolsBrowsePage() {
  const payload = await getPayload({ config })
  const tools = await payload
    .find({ collection: 'tools', limit: 50, sort: '-updatedAt', depth: 1, overrideAccess: true })
    .catch(() => ({ docs: [] }))

  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Tools
          </h1>
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.875rem' }}>
            Interactive calculators, planning tools, and analytical utilities for WFM practitioners.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" style={{ fontSize: '0.8125rem' }}>
            Filter
          </button>
          <select className="input" style={{ width: 'auto', fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}>
            <option>Sort: Trending</option>
            <option>Sort: Recent</option>
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
            <span className="category-chip-icon">{cat.icon}</span>
            {cat.label}
          </span>
        ))}
      </div>

      {/* Featured section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
          🔥 Featured Tools
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
            No tools yet
          </p>
          <p style={{ fontSize: '0.875rem' }}>
            Tools will appear here once published.
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
              assetType={tool.category || 'default'}
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
