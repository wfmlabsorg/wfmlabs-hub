import React from 'react'

const categoryGradients: Record<string, string> = {
  // New tool type categories
  'calculator': 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  'analyzer': 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
  'simulator': 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
  'model': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  'methodology': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  // Legacy (keep for backwards compat during migration)
  'capacity-planning': 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
  'forecasting': 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
  'analytics': 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
  'value-planning': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  'scheduling': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  'staffing': 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
}

const categoryLabels: Record<string, string> = {
  'calculator': 'Calculator',
  'analyzer': 'Analyzer',
  'simulator': 'Simulator',
  'model': 'Model',
  'methodology': 'Methodology',
}

const domainLabels: Record<string, string> = {
  'staffing-capacity': 'Staffing & Capacity',
  'forecasting-accuracy': 'Forecasting',
  'workforce-economics': 'Workforce Economics',
  'operations-routing': 'Operations',
  'measurement-analytics': 'Measurement',
}

const assetTypeGradients: Record<string, string> = {
  'tool': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'paper': 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
  'article': 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
  'wiki-entry': 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
  'newsletter-issue': 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
  'framework': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  'scenario': 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
}

const defaultGradient = 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

const sourceTypeGradientOverrides: Record<string, string> = {
  arxiv: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
  ssrn: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
  journal: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
  'industry-report': 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
  blog: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
  'vendor-research': 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
  manual: 'linear-gradient(135deg, #4b5563 0%, #6b7280 100%)',
}

interface AssetCardProps {
  title: string
  description?: string | null
  slug: string
  assetType: string
  category?: string | null
  status?: string | null
  tier?: string | null
  topics?: Array<{ name: string; slug: string } | string | number> | null
  primaryContributor?: { displayName: string; username: string } | string | number | null
  /** Tool-specific: WFM domain */
  domain?: string | null
  /** Paper-specific: publication name */
  sourceName?: string | null
  /** Paper-specific: source type key */
  sourceType?: string | null
  /** Paper-specific: authors array */
  authors?: Array<{ name: string }> | null
  stats?: {
    discussionCount?: number | null
    reactionCount?: number | null
    viewCount?: number | null
  } | null
  href: string
  isFeatured?: boolean
  updatedAt?: string | null
  createdAt?: string | null
}

export function AssetCard({
  title,
  description,
  assetType,
  category,
  domain,
  status,
  primaryContributor,
  sourceName,
  sourceType,
  authors,
  stats,
  href,
  isFeatured,
  updatedAt,
  createdAt,
}: AssetCardProps) {
  const isPaper = assetType === 'paper'
  const gradient = isPaper
    ? (sourceType ? sourceTypeGradientOverrides[sourceType] : undefined) ||
      assetTypeGradients['paper'] ||
      defaultGradient
    : (category ? categoryGradients[category] : undefined) ||
      assetTypeGradients[assetType] ||
      defaultGradient
  const contributor =
    typeof primaryContributor === 'object' &&
    primaryContributor !== null &&
    'displayName' in primaryContributor
      ? primaryContributor
      : null
  const dateStr = updatedAt || createdAt

  // Paper attribution: sourceName or sourceType label
  const sourceTypeLabels: Record<string, string> = {
    arxiv: 'arXiv',
    ssrn: 'SSRN',
    journal: 'Journal',
    'industry-report': 'Industry Report',
    blog: 'Blog',
    'vendor-research': 'Vendor Research',
    manual: 'Manual',
  }
  const paperAttribution = isPaper
    ? sourceName || (sourceType ? sourceTypeLabels[sourceType] || sourceType : null)
    : null
  const paperAuthorsLine = isPaper && authors && authors.length > 0
    ? authors.length === 1
      ? authors[0].name
      : `${authors[0].name} et al.`
    : null

  return (
    <a href={href} className="asset-card-link">
      <div className="asset-card">
        {/* Gradient header band */}
        <div className="asset-card-gradient" style={{ background: gradient }}>
          {/* Badges on gradient */}
          <div className="asset-card-badges">
            <div className="asset-card-badges-left">
              {category && categoryLabels[category] && (
                <span className="asset-card-badge">{categoryLabels[category]}</span>
              )}
              {domain && domainLabels[domain] && (
                <span className="asset-card-badge">{domainLabels[domain]}</span>
              )}
              {isFeatured && (
                <span className="asset-card-badge asset-card-badge-featured">Featured</span>
              )}
            </div>
            <div className="asset-card-badges-right">
              {(stats?.reactionCount || 0) > 0 && (
                <span className="asset-card-badge">
                  ♥ {stats?.reactionCount || 0}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content below gradient */}
        <div className="asset-card-content">
          {/* Title */}
          <h3 className="asset-card-title">{title}</h3>

          {/* Authors line (papers only) */}
          {paperAuthorsLine && (
            <p style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', marginBottom: '0.25rem', lineHeight: 1.4 }}>
              {paperAuthorsLine}
            </p>
          )}

          {/* Description */}
          {description && (
            <p className="asset-card-description">{description}</p>
          )}
          {!description && !paperAuthorsLine && <div style={{ flex: 1 }} />}

          {/* Footer */}
          <div className="asset-card-footer">
            {isPaper && paperAttribution ? (
              <div className="asset-card-contributor">
                <div className="asset-card-avatar" style={{ fontSize: '0.5rem' }}>
                  {paperAttribution.charAt(0).toUpperCase()}
                </div>
                <span>{paperAttribution}</span>
              </div>
            ) : (
              <div className="asset-card-contributor">
                <div className="asset-card-avatar">
                  {contributor ? contributor.displayName.charAt(0).toUpperCase() : '?'}
                </div>
                <span>{contributor ? contributor.displayName : 'Unknown'}</span>
              </div>
            )}
            {dateStr && (
              <span className="asset-card-time">{timeAgo(dateStr)}</span>
            )}
          </div>
        </div>
      </div>
    </a>
  )
}
