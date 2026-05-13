import React from 'react'
import { getPayload } from 'payload'
import config from '@payload-config'
import { auth } from '@/lib/auth'
import { SignalFeed } from '@/components/signals/SignalFeed'

async function OvixStatusBadge() {
  const data = await fetch('https://ovix-api.tedlango.workers.dev/api/ovix/feed-health', {
    next: { revalidate: 300 },
  })
    .then((r) => r.json())
    .catch(() => null)

  if (!data) return null

  const totalFeeds = data.totalFeeds || 0
  const healthy = data.healthy || 0

  return (
    <a
      href="/data-sources"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.375rem',
        fontSize: '0.6875rem',
        color: 'var(--fg-muted)',
        textDecoration: 'none',
        padding: '0.25rem 0.5rem',
        borderRadius: '999px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: '0.375rem',
          height: '0.375rem',
          borderRadius: '50%',
          background: healthy === totalFeeds ? '#22c55e' : '#f59e0b',
        }}
      />
      OVIX {healthy}/{totalFeeds}
    </a>
  )
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

  // Fetch featured tools (4 random)
  const toolsResult = await payload
    .find({
      collection: 'tools',
      limit: 20,
      sort: '-updatedAt',
      depth: 1,
      overrideAccess: true,
    })
    .catch(() => ({ docs: [], totalDocs: 0 }))

  // Shuffle and pick 4
  const allTools = [...toolsResult.docs]
  for (let i = allTools.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[allTools[i], allTools[j]] = [allTools[j], allTools[i]]
  }
  const featuredTools = allTools.slice(0, 4)

  // Get counts for stats bar
  const collections = ['wiki-entries', 'papers', 'tools', 'articles', 'newsletter-issues'] as const
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
      {/* Section 1: Hero Actions */}
      <section
        style={{
          padding: '2.5rem 1rem 1rem',
          maxWidth: '80rem',
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <a
            href="/roc"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
          >
            Explore the ROC
          </a>
          <a href="/tools" className="btn btn-secondary" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>
            Try the Tools
          </a>
          <a href="/signals" className="btn btn-secondary" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>
            Live Signals
          </a>
        </div>

        {/* Stats — subtle, below hero actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '2rem',
            marginTop: '1.25rem',
            flexWrap: 'wrap',
          }}
        >
          {[
            { label: 'Assets', value: totalAssets },
            { label: 'Members', value: totalMembers },
            { label: 'Topics', value: totalTopics },
          ].map((stat) => (
            <span key={stat.label} style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
              <span style={{ fontWeight: 600, color: 'var(--fg)' }}>{stat.value}</span>{' '}
              {stat.label}
            </span>
          ))}
        </div>
      </section>

      {/* Section 2: Interactive OVIX Globe */}
      <section style={{ maxWidth: '80rem', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <div
          style={{
            position: 'relative',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            background: '#060610',
            border: '1px solid var(--border)',
          }}
        >
          <iframe
            src="/globe-home.html"
            title="OVIX Globe"
            style={{
              width: '100%',
              height: '480px',
              border: 'none',
              display: 'block',
            }}
            allow="accelerometer"
          />
        </div>
      </section>

      {/* Section 3: Live Signal Feed */}
      <section style={{ maxWidth: '80rem', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1rem' }}>{'\u25C6'}</span>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0 }}>Live Signals</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <OvixStatusBadge />
              <a href="/signals" style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', textDecoration: 'none' }}>
                View all {'\u2192'}
              </a>
            </div>
          </div>
          <SignalFeed limit={10} compact />
        </div>
      </section>

      {/* Section 4: Featured Tools */}
      <section style={{ maxWidth: '80rem', margin: '0 auto', padding: '1.5rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>Featured Tools</h2>
          <a href="/tools" style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', textDecoration: 'none' }}>
            Browse all {'\u2192'}
          </a>
        </div>
        {featuredTools.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(16rem, 1fr))',
              gap: '1rem',
            }}
          >
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {featuredTools.map((tool: any) => (
              <a
                key={tool.id}
                href={`/tools/${tool.slug}`}
                className="card"
                style={{ padding: '1.25rem', textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', marginBottom: '0.375rem' }}>
                  {tool.title}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
                  {tool.description
                    ? tool.description.length > 120
                      ? tool.description.slice(0, 120) + '...'
                      : tool.description
                    : 'Interactive tool'}
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '2rem',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--fg-muted)',
              fontSize: '0.875rem',
            }}
          >
            Tools will appear here once created.
          </div>
        )}
      </section>

      {/* Section 5: Quick Links */}
      <section style={{ maxWidth: '80rem', margin: '0 auto', padding: '1.5rem 1rem 3rem' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
            gap: '1rem',
          }}
        >
          {[
            { title: 'Research', desc: 'Curated papers and industry research', href: '/research', icon: '\uD83D\uDD2C' },
            { title: 'APIs', desc: 'Live data feeds and integrations', href: '/data-sources', icon: '\uD83D\uDCE1' },
            { title: 'Discussions', desc: 'Community conversations and Q&A', href: '/discussions', icon: '\uD83D\uDCAC' },
            { title: 'Docs', desc: 'Platform documentation and guides', href: '/wiki', icon: '\uD83D\uDCD6' },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="card"
              style={{ padding: '1.25rem', textDecoration: 'none', color: 'inherit' }}
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
