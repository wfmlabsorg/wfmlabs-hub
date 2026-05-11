import React from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { AssetCard } from '@/components/cards/AssetCard'

const assetTypeMap: Record<string, { label: string; path: string; type: string }> = {
  'wiki-entries': { label: 'Wiki', path: '/wiki', type: 'wiki-entry' },
  papers: { label: 'Research', path: '/research', type: 'paper' },
  tools: { label: 'Tools', path: '/tools', type: 'tool' },
  articles: { label: 'Articles', path: '/articles', type: 'article' },
  'newsletter-issues': { label: 'Compass', path: '/compass', type: 'newsletter-issue' },
}

export const dynamic = 'force-dynamic'
export default async function HomePage() {
  const payload = await getPayload({ config })

  // Fetch featured items across collections
  const collections = ['wiki-entries', 'papers', 'tools', 'articles', 'newsletter-issues'] as const
  const results = await Promise.all(
    collections.map((slug) =>
      payload
        .find({
          collection: slug,
          limit: 3,
          where: { isFeatured: { equals: true } },
          sort: '-updatedAt',
          depth: 1,
          overrideAccess: true,
        })
        .catch(() => ({ docs: [], totalDocs: 0 })),
    ),
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const featured: Array<{ item: any; collection: string }> = []
  results.forEach((result, i) => {
    result.docs.forEach((doc) => {
      featured.push({ item: doc, collection: collections[i] })
    })
  })

  // If no featured items, get recent items instead
  let displayItems = featured
  if (displayItems.length === 0) {
    const recentResults = await Promise.all(
      collections.map((slug) =>
        payload
          .find({
            collection: slug,
            limit: 2,
            sort: '-updatedAt',
            depth: 1,
            overrideAccess: true,
          })
          .catch(() => ({ docs: [], totalDocs: 0 })),
      ),
    )
    recentResults.forEach((result, i) => {
      result.docs.forEach((doc) => {
        displayItems.push({ item: doc, collection: collections[i] })
      })
    })
  }

  // Get counts for stats bar
  const counts = await Promise.all([
    ...collections.map((slug) =>
      payload
        .find({ collection: slug, limit: 0, overrideAccess: true })
        .then((r) => r.totalDocs)
        .catch(() => 0),
    ),
    payload
      .find({ collection: 'members', limit: 0, overrideAccess: true })
      .then((r) => r.totalDocs)
      .catch(() => 0),
    payload
      .find({ collection: 'topics', limit: 0, overrideAccess: true })
      .then((r) => r.totalDocs)
      .catch(() => 0),
  ])

  const totalAssets = counts.slice(0, 5).reduce((a, b) => a + b, 0)
  const totalMembers = counts[5]
  const totalTopics = counts[6]

  return (
    <div>
      {/* Hero */}
      <section
        style={{
          textAlign: 'center',
          padding: '5rem 1rem 4rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 800,
            lineHeight: 1.2,
            marginBottom: '1rem',
          }}
        >
          <span style={{ color: 'var(--accent)' }}>WFM Labs</span> Hub
        </h1>
        <p
          style={{
            fontSize: '1.125rem',
            color: 'var(--fg-muted)',
            maxWidth: '36rem',
            margin: '0 auto 2rem',
            lineHeight: 1.6,
          }}
        >
          The practitioner workspace for workforce management. Research papers,
          interactive tools, wiki knowledge, and a builder community.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <a href="/wiki" className="btn btn-primary" style={{ padding: '0.625rem 1.5rem' }}>
            Explore Wiki
          </a>
          <a href="/research" className="btn btn-secondary" style={{ padding: '0.625rem 1.5rem' }}>
            Browse Research
          </a>
          <a href="/tools" className="btn btn-secondary" style={{ padding: '0.625rem 1.5rem' }}>
            Try Tools
          </a>
        </div>
      </section>

      {/* Stats bar */}
      <section
        style={{
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
          padding: '1rem',
        }}
      >
        <div
          style={{
            maxWidth: '40rem',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'center',
            gap: '3rem',
            flexWrap: 'wrap',
          }}
        >
          {[
            { label: 'Assets', value: totalAssets },
            { label: 'Members', value: totalMembers },
            { label: 'Topics', value: totalTopics },
          ].map((stat) => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured / Recent content */}
      <section style={{ maxWidth: '80rem', margin: '0 auto', padding: '3rem 1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem' }}>
          {featured.length > 0 ? 'Featured' : 'Recent Activity'}
        </h2>

        {displayItems.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))',
              gap: '1rem',
            }}
          >
            {displayItems.slice(0, 6).map(({ item, collection }) => {
              const meta = assetTypeMap[collection]
              return (
                <AssetCard
                  key={`${collection}-${item.id}`}
                  title={item.title}
                  description={item.description || item.abstract || item.excerpt}
                  slug={item.slug}
                  assetType={meta.type}
                  category={item.category || null}
                  status={item.status}
                  tier={item.tier}
                  topics={item.topics}
                  primaryContributor={item.primaryContributor}
                  stats={item.stats}
                  href={`${meta.path}/${item.slug}`}
                />
              )
            })}
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem 2rem',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--fg-muted)',
            }}
          >
            <p style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '0.5rem' }}>
              No content yet
            </p>
            <p style={{ fontSize: '0.875rem' }}>
              Assets will appear here once they are created in the admin panel.
            </p>
          </div>
        )}
      </section>

      {/* Quick links */}
      <section
        style={{
          maxWidth: '80rem',
          margin: '0 auto',
          padding: '0 1rem 3rem',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
            gap: '1rem',
          }}
        >
          {[
            { title: 'Wiki', desc: 'WFM knowledge base — concepts, processes, metrics', href: '/wiki', icon: '\uD83D\uDCD6' },
            { title: 'Research', desc: 'Curated papers and industry research', href: '/research', icon: '\uD83D\uDD2C' },
            { title: 'Tools', desc: 'Interactive calculators and planning tools', href: '/tools', icon: '\uD83D\uDEE0\uFE0F' },
            { title: 'Articles', desc: 'Community articles and thought pieces', href: '/articles', icon: '\uD83D\uDCDD' },
            { title: 'Compass', desc: 'Contact Center Compass newsletter archive', href: '/compass', icon: '\uD83E\uDDED' },
            { title: 'Members', desc: 'Community practitioners and builders', href: '/members', icon: '\uD83D\uDC65' },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="card"
              style={{
                padding: '1.25rem',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{link.icon}</div>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.25rem' }}>
                {link.title}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.4 }}>
                {link.desc}
              </div>
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
