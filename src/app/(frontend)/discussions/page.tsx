import { getPayload } from 'payload'
import config from '@payload-config'
import React from 'react'
import { RichTextContent } from '@/components/ui/RichTextContent'

export const metadata = { title: 'Discussions | WFM Labs Hub' }
export const dynamic = 'force-dynamic'

const assetTypeLabels: Record<string, string> = {
  papers: 'Research',
  articles: 'Article',
  tools: 'Tool',
  'newsletter-issues': 'Newsletter',
  'wiki-entries': 'Wiki',
}

const assetTypeColors: Record<string, string> = {
  papers: '#3b82f6',
  articles: '#10b981',
  tools: '#f59e0b',
  'newsletter-issues': '#8b5cf6',
  'wiki-entries': '#6366f1',
}

const filterOptions = [
  { value: 'all', label: 'All' },
  { value: 'papers', label: 'Research' },
  { value: 'articles', label: 'Articles' },
  { value: 'tools', label: 'Tools' },
  { value: 'newsletter-issues', label: 'Newsletter' },
  { value: 'wiki-entries', label: 'Wiki' },
]

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

function extractPlainText(content: unknown): string {
  if (!content || typeof content !== 'object') return ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root = (content as any)?.root
  if (!root?.children) return ''

  function walk(nodes: unknown[]): string {
    return nodes
      .map((node) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const n = node as any
        if (n.type === 'text') return n.text || ''
        if (n.children) return walk(n.children)
        return ''
      })
      .join(' ')
  }

  return walk(root.children).trim()
}

export default async function DiscussionsBrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const resolvedParams = await searchParams
  const activeType = resolvedParams.type || 'all'
  const payload = await getPayload({ config })

  // Build where clause — only top-level discussions (no replies)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {
    parentDiscussion: { exists: false },
  }

  if (activeType !== 'all') {
    where['asset.relationTo'] = { equals: activeType }
  }

  const result = await payload
    .find({
      collection: 'discussions',
      where,
      limit: 50,
      sort: '-createdAt',
      depth: 2,
      overrideAccess: true,
    })
    .catch(() => ({ docs: [], totalDocs: 0 }))

  // For each discussion, count replies
  const discussionsWithReplies = await Promise.all(
    result.docs.map(async (discussion) => {
      const replies = await payload
        .find({
          collection: 'discussions',
          where: { parentDiscussion: { equals: discussion.id } },
          limit: 0,
          overrideAccess: true,
        })
        .catch(() => ({ totalDocs: 0 }))
      return { ...discussion, replyCount: replies.totalDocs }
    }),
  )

  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            Discussions
          </h1>
          <p style={{ color: 'var(--fg-muted)', fontSize: '0.875rem' }}>
            Community conversations across tools, research, articles, and more.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select
            className="input"
            style={{ width: 'auto', fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
          >
            <option>Sort: Recent</option>
            <option>Sort: Most Replied</option>
          </select>
        </div>
      </div>

      {/* Asset type filter chips */}
      <div className="category-chips-row">
        {filterOptions.map((opt) => (
          <a
            key={opt.value}
            href={opt.value === 'all' ? '/discussions' : `/discussions?type=${opt.value}`}
            className={`category-chip ${opt.value === activeType ? 'category-chip-active' : ''}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            {opt.label}
          </a>
        ))}
      </div>

      {/* Count header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
        }}
      >
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
          {activeType === 'all'
            ? 'Recent Discussions'
            : `${filterOptions.find((f) => f.value === activeType)?.label || ''} Discussions`}
        </h2>
        <span style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>
          {result.totalDocs} {result.totalDocs === 1 ? 'discussion' : 'discussions'}
        </span>
      </div>

      {/* Discussion list */}
      {discussionsWithReplies.length === 0 ? (
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
            No discussions yet
          </p>
          <p style={{ fontSize: '0.875rem' }}>
            Start a conversation on any tool, paper, or article page.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {discussionsWithReplies.map((discussion: any) => {
            const author =
              typeof discussion.author === 'object' && discussion.author !== null
                ? discussion.author
                : null
            const displayName = author?.displayName || 'Anonymous'
            const initial = displayName.charAt(0).toUpperCase()

            const assetRelation = discussion.asset?.relationTo || ''
            const assetValue =
              typeof discussion.asset?.value === 'object'
                ? discussion.asset.value
                : null
            const assetTitle = assetValue?.title || assetValue?.name || ''
            const assetSlug = assetValue?.slug || ''
            const assetTypeLabel = assetTypeLabels[assetRelation] || assetRelation
            const assetColor = assetTypeColors[assetRelation] || '#6b7280'

            // Build link to the asset detail page
            const assetPathMap: Record<string, string> = {
              papers: '/research',
              articles: '/articles',
              tools: '/tools',
              'newsletter-issues': '/compass',
              'wiki-entries': '/wiki',
            }
            const assetHref = assetSlug
              ? `${assetPathMap[assetRelation] || ''}/${assetSlug}`
              : null

            const bodyPreview = extractPlainText(discussion.body)
            const truncated =
              bodyPreview.length > 200 ? bodyPreview.slice(0, 200) + '...' : bodyPreview

            return (
              <div
                key={discussion.id}
                style={{
                  padding: '1rem 1.25rem',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  transition: 'border-color 0.15s',
                }}
                className="discussion-list-item"
              >
                {/* Top row: asset badge + timestamp */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {assetTypeLabel && (
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: assetColor,
                          background: `${assetColor}15`,
                          padding: '0.125rem 0.5rem',
                          borderRadius: '0.25rem',
                        }}
                      >
                        {assetTypeLabel}
                      </span>
                    )}
                    {assetHref && assetTitle && (
                      <a
                        href={assetHref}
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--fg-muted)',
                          textDecoration: 'none',
                          fontWeight: 500,
                        }}
                      >
                        {assetTitle}
                      </a>
                    )}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)' }}>
                    {timeAgo(discussion.createdAt)}
                  </span>
                </div>

                {/* Author + body */}
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '2rem',
                      height: '2rem',
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      color: 'var(--accent-text)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {initial}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.25rem',
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{displayName}</span>
                    </div>
                    <p
                      style={{
                        fontSize: '0.875rem',
                        color: 'var(--fg-muted)',
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      {truncated || <em style={{ color: 'var(--fg-faint)' }}>No content</em>}
                    </p>

                    {/* Footer: reply count + reactions */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        marginTop: '0.5rem',
                        fontSize: '0.75rem',
                        color: 'var(--fg-faint)',
                      }}
                    >
                      {discussion.replyCount > 0 && (
                        <span>
                          {discussion.replyCount}{' '}
                          {discussion.replyCount === 1 ? 'reply' : 'replies'}
                        </span>
                      )}
                      {(discussion.reactionCount || 0) > 0 && (
                        <span>
                          &#9829; {discussion.reactionCount}
                        </span>
                      )}
                      {discussion.isResolved && (
                        <span style={{ color: '#10b981', fontWeight: 500 }}>Resolved</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
