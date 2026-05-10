import React from 'react'
import { AssetCard } from '@/components/cards/AssetCard'

interface BrowsePageLayoutProps {
  title: string
  description?: string
  assetType: string
  basePath: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[]
}

export function BrowsePageLayout({
  title,
  description,
  assetType,
  basePath,
  items,
}: BrowsePageLayoutProps) {
  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Page header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          {title}
        </h1>
        {description && (
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.9375rem' }}>{description}</p>
        )}
      </div>

      {/* Controls row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <span style={{ fontSize: '0.875rem', color: 'var(--fg-muted)' }}>
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select
            className="input"
            style={{ width: 'auto', height: '2rem', fontSize: '0.8125rem', cursor: 'pointer' }}
            defaultValue="recent"
          >
            <option value="recent">Recently updated</option>
            <option value="alpha">Alphabetical</option>
            <option value="popular">Most popular</option>
          </select>
        </div>
      </div>

      {/* Content area */}
      <div style={{ display: 'flex', gap: '2rem' }}>
        {/* Sidebar filters */}
        <aside
          className="browse-sidebar"
          style={{
            width: '14rem',
            flexShrink: 0,
          }}
        >
          <div style={{ position: 'sticky', top: '4.5rem' }}>
            <h3
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--fg-muted)',
                marginBottom: '0.75rem',
              }}
            >
              Filters
            </h3>
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Status
              </h4>
              {['published', 'draft', 'proposed', 'refined', 'mature'].map((s) => (
                <label
                  key={s}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    fontSize: '0.8125rem',
                    color: 'var(--fg-muted)',
                    padding: '0.125rem 0',
                    cursor: 'pointer',
                  }}
                >
                  <input type="checkbox" disabled style={{ accentColor: 'var(--accent)' }} />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </label>
              ))}
            </div>
            <div>
              <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Tier
              </h4>
              {['public', 'free', 'practitioner'].map((t) => (
                <label
                  key={t}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    fontSize: '0.8125rem',
                    color: 'var(--fg-muted)',
                    padding: '0.125rem 0',
                    cursor: 'pointer',
                  }}
                >
                  <input type="checkbox" disabled style={{ accentColor: 'var(--accent)' }} />
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* Card grid */}
        <div style={{ flex: 1 }}>
          {items.length === 0 ? (
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
                No items yet
              </p>
              <p style={{ fontSize: '0.875rem' }}>
                Content will appear here once published.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))',
                gap: '1rem',
              }}
            >
              {items.map((item) => (
                <AssetCard
                  key={item.id}
                  title={item.title || item.displayName || 'Untitled'}
                  description={item.description || item.abstract || item.excerpt || item.bio}
                  slug={item.slug || item.username}
                  assetType={assetType}
                  status={item.status}
                  tier={item.tier}
                  topics={item.topics}
                  primaryContributor={item.primaryContributor}
                  stats={item.stats}
                  href={`${basePath}/${item.slug || item.username}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .browse-sidebar { display: none !important; }
        }
      `}</style>
    </div>
  )
}
