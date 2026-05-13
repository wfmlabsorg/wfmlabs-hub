import React from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { auth } from '@/lib/auth'
import { AssetCard } from '@/components/cards/AssetCard'
import { SignalFeed } from '@/components/signals/SignalFeed'

const ovixDomains = [
  { name: 'weather', color: '#3b82f6' },
  { name: 'seismic', color: '#ef4444' },
  { name: 'disaster', color: '#f97316' },
  { name: 'infrastructure', color: '#8b5cf6' },
  { name: 'cyber', color: '#22c55e' },
  { name: 'health', color: '#ec4899' },
  { name: 'financial', color: '#f59e0b' },
  { name: 'environmental', color: '#14b8a6' },
  { name: 'news', color: '#64748b' },
]

async function OvixStatusCard() {
  const data = await fetch('https://ovix-api.tedlango.workers.dev/api/ovix/feed-health', {
    next: { revalidate: 300 },
  })
    .then((r) => r.json())
    .catch(() => null)

  if (!data) return null

  const totalFeeds = data.totalFeeds || 0
  const healthy = data.healthy || 0
  const stale = totalFeeds - healthy

  return (
    <a
      href="/data-sources"
      className="card"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '1rem 1.25rem',
        textDecoration: 'none',
        color: 'inherit',
        gap: '1rem',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.25rem' }}>{'\uD83D\uDCE1'}</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>OVIX Status</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
            {totalFeeds} feeds · {healthy} healthy · {stale} stale
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
        {ovixDomains.map((d) => (
          <span
            key={d.name}
            title={d.name}
            style={{
              display: 'inline-block',
              width: '0.5rem',
              height: '0.5rem',
              borderRadius: '50%',
              background: d.color,
            }}
          />
        ))}
        <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', marginLeft: '0.5rem' }}>
          View all {'\u2192'}
        </span>
      </div>
    </a>
  )
}

const assetTypeMap: Record<string, { label: string; path: string; type: string }> = {
  'wiki-entries': { label: 'Wiki', path: '/wiki', type: 'wiki-entry' },
  papers: { label: 'Research', path: '/research', type: 'paper' },
  tools: { label: 'Tools', path: '/tools', type: 'tool' },
  articles: { label: 'Articles', path: '/articles', type: 'article' },
  'newsletter-issues': { label: 'Compass', path: '/compass', type: 'newsletter-issue' },
}

export const dynamic = 'force-dynamic'
export default async function HomePage() {
  const session = await auth()

  // Unauthenticated → landing page
  if (!session?.user) {
    return (
      <div>
        <section style={{ textAlign: 'center', padding: '6rem 1rem 4rem', borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, lineHeight: 1.15, marginBottom: '1.5rem' }}>
            Human Expertise Meets<br />
            <span style={{ color: 'var(--accent)' }}>Agent Intelligence</span>
          </h1>
          <p style={{ fontSize: '1.125rem', color: 'var(--fg-muted)', maxWidth: '40rem', margin: '0 auto 2rem', lineHeight: 1.7 }}>
            The platform where WFM practitioners and purpose-built AI agents collaborate on live operational data — creating workforce intelligence that neither could build alone.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <a href="/login" className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>
              Get Started
            </a>
            <a href="/pricing" className="btn btn-secondary" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>
              View Pricing
            </a>
          </div>
        </section>

        {/* Core pillars */}
        <section style={{ maxWidth: '72rem', margin: '0 auto', padding: '4rem 1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))', gap: '2rem' }}>
            {[
              { icon: '\u25C6', title: 'OVIX — Operational Intelligence', desc: '28 live data feeds scored every 5 minutes across 38 global regions. Weather, seismic, disaster, cyber, health, financial, infrastructure — correlated to your workforce locations.' },
              { icon: '\uD83E\uDD16', title: 'AI Agent Team', desc: 'Beacon surfaces emerging WFM topics. Sentinel monitors for operational incidents. Purpose-built agents that understand workforce management — not generic AI.' },
              { icon: '\uD83D\uDEE0', title: 'Interactive Tools & Research', desc: 'Erlang calculators, capacity planners, Monte Carlo simulations, and a curated research library. Built by practitioners, for practitioners.' },
            ].map((p) => (
              <div key={p.title} style={{ padding: '2rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{p.icon}</div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>{p.title}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', lineHeight: 1.6 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Social proof placeholder */}
        <section style={{ textAlign: 'center', padding: '3rem 1rem 4rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--fg-faint)', marginBottom: '1rem' }}>
            Built for WFM practitioners managing contact centers, back offices, and knowledge worker operations worldwide.
          </p>
          <a href="/pricing" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
            See pricing {'\u2192'}
          </a>
        </section>
      </div>
    )
  }

  // Authenticated → full dashboard
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

      {/* Signal Feed + OVIX Status — side by side */}
      <section style={{ maxWidth: '80rem', margin: '0 auto', padding: '1.5rem 1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1rem' }}>{'\u25C6'}</span>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0 }}>Signal Feed</h3>
            </div>
            <a href="/signals" style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', textDecoration: 'none' }}>
              View all {'\u2192'}
            </a>
          </div>
          <SignalFeed limit={6} compact />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <OvixStatusCard />
        </div>
      </section>

      {/* Featured / Recent content */}
      <section style={{ maxWidth: '80rem', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
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
