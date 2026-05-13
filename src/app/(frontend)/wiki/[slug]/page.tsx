import { getPayload } from 'payload'
import config from '@payload-config'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { RichTextContent } from '@/components/ui/RichTextContent'
import { DiscussionSection } from '@/components/discussion/DiscussionSection'
import React from 'react'

const CATEGORY_LABELS: Record<string, string> = {
  technology: 'Technology',
  process: 'Process',
  framework: 'Framework',
  concept: 'Concept',
  metric: 'Metric',
  role: 'Role',
  glossary: 'Glossary',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default async function WikiDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'wiki-entries',
    where: { slug: { equals: slug } },
    depth: 2,
    limit: 1,
    overrideAccess: true,
  })

  const entry = result.docs[0]
  if (!entry) notFound()

  const contributor =
    typeof entry.primaryContributor === 'object' &&
    entry.primaryContributor !== null &&
    'displayName' in entry.primaryContributor
      ? entry.primaryContributor
      : null

  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '1.5rem 1rem' }}>
      {/* Breadcrumbs */}
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          fontSize: '0.8125rem',
          color: 'var(--fg-faint)',
          marginBottom: '1.5rem',
        }}
      >
        <Link href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>
          Home
        </Link>
        <span>/</span>
        <Link href="/wiki" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>
          Docs
        </Link>
        {entry.category && (
          <>
            <span>/</span>
            <Link
              href={`/wiki#${entry.category}`}
              style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}
            >
              {CATEGORY_LABELS[entry.category] || entry.category}
            </Link>
          </>
        )}
        <span>/</span>
        <span style={{ color: 'var(--fg)' }}>{entry.title}</span>
      </nav>

      <div style={{ display: 'flex', gap: '3rem', alignItems: 'flex-start' }}>
        {/* Main article */}
        <article className="doc-article" style={{ flex: 1, minWidth: 0 }}>
          {/* Article header */}
          <header style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
            {entry.category && (
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--accent)',
                  marginBottom: '0.5rem',
                }}
              >
                {CATEGORY_LABELS[entry.category] || entry.category}
              </span>
            )}
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.3, marginBottom: '0.75rem' }}>
              {entry.title}
            </h1>

            {/* Meta row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                fontSize: '0.8125rem',
                color: 'var(--fg-muted)',
                flexWrap: 'wrap',
              }}
            >
              {contributor && (
                <Link
                  href={`/member/${contributor.username}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    color: 'var(--fg-muted)',
                    textDecoration: 'none',
                  }}
                >
                  <div
                    style={{
                      width: '1.25rem',
                      height: '1.25rem',
                      borderRadius: '50%',
                      background: 'var(--accent-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.625rem',
                      fontWeight: 600,
                      color: 'var(--accent)',
                    }}
                  >
                    {contributor.displayName.charAt(0).toUpperCase()}
                  </div>
                  {contributor.displayName}
                </Link>
              )}
              {entry.updatedAt && <span>Updated {formatDate(entry.updatedAt)}</span>}
              {entry.publishedAt && <span>Published {formatDate(entry.publishedAt)}</span>}
            </div>
          </header>

          {/* Description / lead paragraph */}
          {entry.description && (
            <p
              style={{
                fontSize: '1.0625rem',
                color: 'var(--fg-muted)',
                lineHeight: 1.7,
                marginBottom: '1.5rem',
              }}
            >
              {entry.description}
            </p>
          )}

          {/* Article body */}
          <div
            className="doc-body"
            style={{
              fontSize: '0.9375rem',
              lineHeight: 1.75,
              color: 'var(--fg)',
            }}
          >
            <RichTextContent content={entry.body} />
          </div>

          {/* Discussion */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '2rem', marginTop: '2.5rem' }}>
            <DiscussionSection assetType="wiki-entries" assetId={entry.id} />
          </div>
        </article>

        {/* Right sidebar — metadata */}
        <aside
          className="doc-sidebar"
          style={{
            width: '15rem',
            flexShrink: 0,
            position: 'sticky',
            top: '4.5rem',
            alignSelf: 'flex-start',
          }}
        >
          <div
            style={{
              borderLeft: '1px solid var(--border)',
              paddingLeft: '1.25rem',
            }}
          >
            {/* Defined terms */}
            {entry.definedTerms && entry.definedTerms.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--fg-faint)',
                    marginBottom: '0.625rem',
                  }}
                >
                  Defined Terms
                </h3>
                {entry.definedTerms.map((dt, i) => (
                  <div key={i} style={{ marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--fg)' }}>
                      {dt.term}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
                      {dt.definition}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Topics */}
            {entry.topics && (entry.topics as Array<unknown>).length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--fg-faint)',
                    marginBottom: '0.625rem',
                  }}
                >
                  Topics
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                  {(entry.topics as Array<{ name?: string }>).map((topic, i) => {
                    const name =
                      typeof topic === 'object' && topic !== null && 'name' in topic
                        ? topic.name
                        : String(topic)
                    return (
                      <span key={i} className="topic-pill">
                        {name}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Sources */}
            {entry.sources && entry.sources.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h3
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--fg-faint)',
                    marginBottom: '0.625rem',
                  }}
                >
                  Sources
                </h3>
                {entry.sources.map((src, i) => (
                  <div key={i} style={{ marginBottom: '0.375rem', fontSize: '0.8125rem' }}>
                    {src.url ? (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--accent)', textDecoration: 'none' }}
                      >
                        {src.label}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--fg-muted)' }}>{src.label}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Stats */}
            {entry.stats && (
              <div>
                <h3
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--fg-faint)',
                    marginBottom: '0.625rem',
                  }}
                >
                  Stats
                </h3>
                <div style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>
                  {[
                    { label: 'Views', value: entry.stats.viewCount },
                    { label: 'Discussions', value: entry.stats.discussionCount },
                    { label: 'Reactions', value: entry.stats.reactionCount },
                  ]
                    .filter((s) => s.value != null)
                    .map((s) => (
                      <div
                        key={s.label}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '0.125rem 0',
                        }}
                      >
                        <span>{s.label}</span>
                        <span style={{ fontWeight: 500, color: 'var(--fg)' }}>{s.value}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      <style>{`
        .doc-body h2 {
          font-size: 1.25rem;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
          padding-bottom: 0.375rem;
          border-bottom: 1px solid var(--border);
        }
        .doc-body h3 {
          font-size: 1.0625rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
        }
        .doc-body p {
          margin-bottom: 1rem;
        }
        .doc-body code {
          font-size: 0.875em;
          background: var(--bg-surface);
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
        }
        .doc-body pre {
          background: var(--bg-surface);
          padding: 1rem;
          border-radius: var(--radius);
          overflow-x: auto;
          margin-bottom: 1rem;
          font-size: 0.8125rem;
          line-height: 1.6;
        }
        .doc-body ul, .doc-body ol {
          padding-left: 1.5rem;
          margin-bottom: 1rem;
        }
        .doc-body li {
          margin-bottom: 0.25rem;
        }
        @media (max-width: 768px) {
          .doc-sidebar { display: none !important; }
        }
      `}</style>
    </div>
  )
}
