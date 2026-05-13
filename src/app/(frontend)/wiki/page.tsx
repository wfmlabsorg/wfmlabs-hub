import { getPayload } from 'payload'
import config from '@payload-config'
import Link from 'next/link'

export const metadata = { title: 'Docs' }
export const dynamic = 'force-dynamic'

const CATEGORY_ORDER = ['technology', 'process', 'framework', 'concept', 'metric', 'role', 'glossary'] as const
const CATEGORY_LABELS: Record<string, string> = {
  technology: 'Technology',
  process: 'Process',
  framework: 'Framework',
  concept: 'Concept',
  metric: 'Metric',
  role: 'Role',
  glossary: 'Glossary',
}
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  technology: 'Architecture, APIs, databases, and infrastructure.',
  process: 'Operational workflows, deployment, and data pipelines.',
  framework: 'Analytical frameworks and methodologies.',
  concept: 'Core concepts, overviews, and foundational knowledge.',
  metric: 'Key performance indicators and measurements.',
  role: 'Roles and responsibilities within WFM.',
  glossary: 'Terms and definitions.',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default async function DocsPage() {
  const payload = await getPayload({ config })
  const entries = await payload
    .find({
      collection: 'wiki-entries',
      limit: 200,
      sort: 'title',
      depth: 1,
      overrideAccess: true,
    })
    .catch(() => ({ docs: [] }))

  // Group by category
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grouped: Record<string, any[]> = {}
  for (const entry of entries.docs) {
    const cat = (entry.category as string) || 'concept'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(entry)
  }

  // Build ordered categories (only those with entries)
  const categories = CATEGORY_ORDER.filter((c) => grouped[c]?.length)

  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Page header */}
      <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.375rem' }}>Docs</h1>
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.9375rem', margin: 0 }}>
          WFM knowledge base — concepts, processes, metrics, frameworks, and glossary terms.
        </p>
        <p style={{ color: 'var(--fg-faint)', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
          {entries.docs.length} entries across {categories.length} categories
        </p>
      </div>

      <div style={{ display: 'flex', gap: '3rem', alignItems: 'flex-start' }}>
        {/* Sidebar — Table of Contents */}
        <nav
          className="docs-sidebar"
          style={{
            width: '14rem',
            flexShrink: 0,
            position: 'sticky',
            top: '4.5rem',
            alignSelf: 'flex-start',
          }}
        >
          {/* Changelog quick link */}
          <Link
            href="/wiki/roc-changelog"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 0.625rem',
              marginBottom: '1rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--accent)',
              textDecoration: 'none',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              transition: 'background 0.15s',
            }}
            className="changelog-link"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Latest Changes
          </Link>

          <h2
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--fg-faint)',
              marginBottom: '0.75rem',
            }}
          >
            Table of Contents
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {categories.map((cat) => (
              <li key={cat}>
                <a
                  href={`#${cat}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.375rem 0.5rem',
                    fontSize: '0.8125rem',
                    color: 'var(--fg-muted)',
                    textDecoration: 'none',
                    borderRadius: 'var(--radius)',
                    transition: 'background 0.15s',
                  }}
                >
                  <span>{CATEGORY_LABELS[cat] || cat}</span>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      color: 'var(--fg-faint)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {grouped[cat].length}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Main content — categorized doc list */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {categories.map((cat) => (
            <section key={cat} id={cat} style={{ marginBottom: '2.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <h2
                  style={{
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    marginBottom: '0.25rem',
                    scrollMarginTop: '5rem',
                  }}
                >
                  {CATEGORY_LABELS[cat] || cat}
                </h2>
                {CATEGORY_DESCRIPTIONS[cat] && (
                  <p
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--fg-muted)',
                      margin: 0,
                    }}
                  >
                    {CATEGORY_DESCRIPTIONS[cat]}
                  </p>
                )}
              </div>

              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                }}
              >
                {grouped[cat].map((entry, i) => (
                  <Link
                    key={entry.id}
                    href={`/wiki/${entry.slug}`}
                    style={{
                      display: 'block',
                      padding: '0.875rem 1rem',
                      textDecoration: 'none',
                      color: 'inherit',
                      borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '1rem',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '0.9375rem',
                            fontWeight: 600,
                            marginBottom: '0.25rem',
                            color: 'var(--fg)',
                          }}
                        >
                          {entry.title}
                        </div>
                        {entry.description && (
                          <div
                            style={{
                              fontSize: '0.8125rem',
                              color: 'var(--fg-muted)',
                              lineHeight: 1.5,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {entry.description.length > 160
                              ? entry.description.slice(0, 160).trim() + '...'
                              : entry.description}
                          </div>
                        )}
                      </div>
                      {entry.updatedAt && (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            color: 'var(--fg-faint)',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            marginTop: '0.125rem',
                          }}
                        >
                          {formatDate(entry.updatedAt)}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}

          {entries.docs.length === 0 && (
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
                No documentation yet
              </p>
              <p style={{ fontSize: '0.875rem' }}>
                Content will appear here once published.
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .docs-sidebar a:hover {
          background: var(--bg-surface) !important;
          color: var(--fg) !important;
        }
        .changelog-link:hover {
          background: var(--bg-surface) !important;
        }
        .docs-sidebar {
          border-right: 1px solid var(--border);
          padding-right: 1.5rem;
        }
        @media (max-width: 768px) {
          .docs-sidebar { display: none !important; }
        }
      `}</style>
    </div>
  )
}
