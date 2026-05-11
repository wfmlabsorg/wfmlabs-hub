import React from 'react'

const categoryGradients: Record<string, string> = {
  'capacity-planning': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'forecasting': 'linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)',
  'analytics': 'linear-gradient(135deg, #ec4899 0%, #f97316 100%)',
  'value-planning': 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
  'scheduling': 'linear-gradient(135deg, #10b981 0%, #0891b2 100%)',
  'staffing': 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)',
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
  status,
  primaryContributor,
  stats,
  href,
  isFeatured,
  updatedAt,
  createdAt,
}: AssetCardProps) {
  const gradient =
    (category ? categoryGradients[category] : undefined) ||
    assetTypeGradients[assetType] ||
    defaultGradient
  const contributor =
    typeof primaryContributor === 'object' &&
    primaryContributor !== null &&
    'displayName' in primaryContributor
      ? primaryContributor
      : null
  const dateStr = updatedAt || createdAt

  return (
    <a href={href} className="asset-card-link">
      <div className="asset-card">
        {/* Gradient header band */}
        <div className="asset-card-gradient" style={{ background: gradient }}>
          {/* Badges on gradient */}
          <div className="asset-card-badges">
            <div className="asset-card-badges-left">
              {status === 'published' && (
                <span className="asset-card-badge">Running</span>
              )}
              {isFeatured && (
                <span className="asset-card-badge asset-card-badge-featured">Featured</span>
              )}
            </div>
            <div className="asset-card-badges-right">
              <span className="asset-card-badge">
                ♥ {stats?.reactionCount || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Content below gradient */}
        <div className="asset-card-content">
          {/* Title */}
          <h3 className="asset-card-title">{title}</h3>

          {/* Description */}
          {description && (
            <p className="asset-card-description">{description}</p>
          )}
          {!description && <div style={{ flex: 1 }} />}

          {/* Footer */}
          <div className="asset-card-footer">
            <div className="asset-card-contributor">
              <div className="asset-card-avatar">
                {contributor ? contributor.displayName.charAt(0).toUpperCase() : '?'}
              </div>
              <span>{contributor ? contributor.displayName : 'Unknown'}</span>
            </div>
            {dateStr && (
              <span className="asset-card-time">{timeAgo(dateStr)}</span>
            )}
          </div>
        </div>
      </div>
    </a>
  )
}
