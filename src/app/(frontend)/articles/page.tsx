import { getPayload } from 'payload'
import config from '@payload-config'
import React from 'react'

export const metadata = { title: 'Articles | WFM Labs Hub' }
export const dynamic = 'force-dynamic'

const categoryGradients: Record<string, string> = {
  'think-tank': 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  'topic-surface': 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
  'wiki-highlight': 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
  'research-finding': 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
  'opinion': 'linear-gradient(135deg, #eab308 0%, #f59e0b 100%)',
  'tutorial': 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
  'industry-analysis': 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)',
}

const categoryLabels: Record<string, string> = {
  'think-tank': 'Think Tank',
  'topic-surface': 'Topic Surface',
  'wiki-highlight': 'Wiki Highlight',
  'research-finding': 'Research Finding',
  'opinion': 'Opinion',
  'tutorial': 'Tutorial',
  'industry-analysis': 'Industry Analysis',
}

const categoryIcons: Record<string, string> = {
  'think-tank': '\uD83E\uDDE0',
  'topic-surface': '\uD83D\uDD2D',
  'wiki-highlight': '\u2728',
  'research-finding': '\uD83D\uDCCA',
  'opinion': '\uD83D\uDCAC',
  'tutorial': '\uD83D\uDCD6',
  'industry-analysis': '\uD83C\uDFED',
}

const defaultGradient = 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  const days = Math.floor(seconds / 86400)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function estimateReadTime(excerpt?: string, description?: string): string {
  const text = excerpt || description || ''
  const words = text.split(/\s+/).length
  // Rough estimate: articles are typically 3-8x longer than their excerpt
  const estimatedWords = Math.max(words * 5, 200)
  const minutes = Math.max(1, Math.round(estimatedWords / 250))
  return `${minutes} min read`
}

const categories = [
  { value: 'all', label: 'All', icon: '\uD83D\uDCDD' },
  { value: 'think-tank', label: 'Think Tank', icon: '\uD83E\uDDE0' },
  { value: 'opinion', label: 'Opinion', icon: '\uD83D\uDCAC' },
  { value: 'tutorial', label: 'Tutorial', icon: '\uD83D\uDCD6' },
  { value: 'topic-surface', label: 'Topic Surface', icon: '\uD83D\uDD2D' },
  { value: 'research-finding', label: 'Research Finding', icon: '\uD83D\uDCCA' },
  { value: 'wiki-highlight', label: 'Wiki Highlight', icon: '\u2728' },
  { value: 'industry-analysis', label: 'Industry Analysis', icon: '\uD83C\uDFED' },
]

export default async function ArticlesBrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const params = await searchParams
  const payload = await getPayload({ config })
  const activeCategory = params.category || null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (activeCategory && activeCategory !== 'all') {
    where.category = { equals: activeCategory }
  }

  const articles = await payload
    .find({
      collection: 'articles',
      where: Object.keys(where).length > 0 ? where : undefined,
      limit: 50,
      sort: '-updatedAt',
      depth: 1,
      overrideAccess: true,
    })
    .catch(() => ({ docs: [], totalDocs: 0 }))

  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Articles
          </h1>
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.875rem' }}>
            Community perspectives, thought pieces, and practitioner insights on workforce management.
          </p>
        </div>
        <a
          href="/articles/submit"
          className="btn btn-primary"
          style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}
        >
          Submit Article
        </a>
      </div>

      {/* Category filter chips */}
      <div className="category-chips-row">
        {categories.map((cat) => {
          const isActive = activeCategory === cat.value || (!activeCategory && cat.value === 'all')
          return (
            <a
              key={cat.value}
              href={cat.value === 'all' ? '/articles' : `/articles?category=${cat.value}`}
              className={`category-chip ${isActive ? 'category-chip-active' : ''}`}
              style={{ textDecoration: 'none' }}
            >
              {cat.icon} {cat.label}
            </a>
          )
        })}
      </div>

      {/* Count */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>
          {articles.totalDocs} {articles.totalDocs === 1 ? 'Article' : 'Articles'}
        </span>
      </div>

      {/* Article cards grid */}
      {articles.docs.length === 0 ? (
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
            No articles {activeCategory ? `in ${categoryLabels[activeCategory] || activeCategory}` : 'yet'}
          </p>
          <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Community articles, thought pieces, and practitioner insights will appear here.
          </p>
          <a href="/articles/submit" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
            Be the first to submit an article {'\u2192'}
          </a>
        </div>
      ) : (
        <div className="tools-grid">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {articles.docs.map((article: any) => {
            const gradient = categoryGradients[article.category || ''] || defaultGradient
            const catLabel = categoryLabels[article.category || ''] || article.category || ''
            const catIcon = categoryIcons[article.category || ''] || '\uD83D\uDCDD'
            const contributor =
              typeof article.primaryContributor === 'object' && article.primaryContributor
                ? article.primaryContributor
                : null
            const author =
              typeof article.author === 'object' && article.author
                ? article.author
                : contributor
            const isAgent = author?.type === 'agent'
            const readTime = estimateReadTime(article.excerpt, article.description)

            return (
              <a key={article.id} href={`/articles/${article.slug}`} className="asset-card-link">
                <div className="asset-card">
                  {/* Gradient header */}
                  <div className="asset-card-gradient" style={{ background: gradient }}>
                    <div className="asset-card-badges">
                      <div className="asset-card-badges-left">
                        {catLabel && (
                          <span className="asset-card-badge">
                            {catIcon} {catLabel}
                          </span>
                        )}
                        {isAgent && (
                          <span className="asset-card-badge" style={{ background: 'rgba(24,188,156,0.5)' }}>
                            Agent
                          </span>
                        )}
                      </div>
                      <div className="asset-card-badges-right">
                        <span className="asset-card-badge">
                          {readTime}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="asset-card-content">
                    <h3 className="asset-card-title">{article.title}</h3>

                    {(article.excerpt || article.description) && (
                      <p className="asset-card-description">
                        {article.excerpt || article.description}
                      </p>
                    )}
                    {!article.excerpt && !article.description && <div style={{ flex: 1 }} />}

                    <div className="asset-card-footer">
                      <div className="asset-card-contributor">
                        <div className="asset-card-avatar">
                          {author ? (author.displayName || author.username || '?').charAt(0).toUpperCase() : '?'}
                        </div>
                        <span>{author ? (author.displayName || author.username) : 'Unknown'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {(article.stats?.discussionCount || 0) > 0 && (
                          <span style={{ fontSize: '0.6875rem' }}>
                            {'\uD83D\uDCAC'} {article.stats.discussionCount}
                          </span>
                        )}
                        {(article.stats?.reactionCount || 0) > 0 && (
                          <span style={{ fontSize: '0.6875rem' }}>
                            {'\u2665'} {article.stats.reactionCount}
                          </span>
                        )}
                        <span className="asset-card-time">
                          {article.publishedAt || article.publishDate
                            ? timeAgo(article.publishedAt || article.publishDate)
                            : article.updatedAt
                              ? timeAgo(article.updatedAt)
                              : ''}
                        </span>
                      </div>
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
