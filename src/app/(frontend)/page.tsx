import React from 'react'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { auth } from '@/lib/auth'
import { neonQuery } from '@/lib/neon'
import { SignalFeed } from '@/components/signals/SignalFeed'
import { AssetCard } from '@/components/cards/AssetCard'
import { MemberAvatar } from '@/components/MemberAvatar'
import SignalGlobeHero from '@/components/globe/SignalGlobeHero'
import LiveIncidentCard from '@/components/globe/LiveIncidentCard'

export const dynamic = 'force-dynamic'

// ── Color helpers ──
function sevColor(s: number): string {
  if (s >= 8) return '#ef4444'
  if (s >= 6) return '#f59e0b'
  if (s >= 4) return '#eab308'
  if (s >= 2) return '#22d3ee'
  return '#10b981'
}

function levelColor(l: string): string {
  switch (l) {
    case 'CRITICAL': return '#ef4444'
    case 'SEVERE': return '#f59e0b'
    case 'SIGNIFICANT': return '#eab308'
    case 'ELEVATED': return '#22d3ee'
    default: return '#10b981'
  }
}

const trajectoryArrows: Record<string, string> = {
  escalating: '↑', peak: '⬆', steady: '→', declining: '↓', emerging: '↗', resolved: '✓',
}

// ── Incident design tokens (mirrors /incidents/page.tsx) ──
const sevConfig: Record<string, { label: string; color: string; bg: string; borderColor: string; pulse?: boolean }> = {
  SEV1: { label: 'SEV1', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', borderColor: '#ef4444', pulse: true },
  SEV2: { label: 'SEV2', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', borderColor: '#f59e0b' },
  SEV3: { label: 'SEV3', color: '#eab308', bg: 'transparent', borderColor: '#eab308' },
  SEV4: { label: 'SEV4', color: '#64748b', bg: 'transparent', borderColor: '#475569' },
}

// Domain colors + labels now come from the canonical map (hub-017): the Live
// Incident card (LiveIncidentCard) resolves them via domainBadge()/domainLabel().

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function briefDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

interface HomeIncident {
  id: number
  title: string
  slug: string
  domain: string
  severity: number
  sev_level: string
  status: string
  declared_at: string
  affected_regions: string[] | null
  location_name: string | null
  location_country: string | null
  location_lat: number | string | null
  location_lon: number | string | null
  event_count: number | null
}

async function fetchOpenIncidents(): Promise<HomeIncident[]> {
  if (!process.env.DATABASE_URI) return []
  try {
    const { rows } = await neonQuery<HomeIncident>(
      `SELECT id, title, slug, domain, severity, sev_level, status, declared_at, affected_regions, location_name, location_country, location_lat, location_lon, event_count
       FROM incidents
       WHERE status NOT IN ('closed','resolved')
       ORDER BY CASE sev_level WHEN 'SEV1' THEN 1 WHEN 'SEV2' THEN 2 WHEN 'SEV3' THEN 3 WHEN 'SEV4' THEN 4 ELSE 5 END, declared_at DESC
       LIMIT 6`,
      [],
      { next: { revalidate: 300 } },
    )
    return rows
  } catch {
    return []
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  Section components (shared across auth states + desktop/mobile)
// ──────────────────────────────────────────────────────────────────────────

// 1 — HERO: OVIX Volatility Tape (iframe, eager)
function HeroTape({ mobile }: { mobile: boolean }) {
  return (
    <section
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderTop: '3px solid #22d3ee',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        marginBottom: '1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: mobile ? '0.625rem 0.75rem' : '0.75rem 1.125rem',
          borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          <span style={{ width: '0.4rem', height: '0.4rem', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', animation: 'pulse 2s infinite', flexShrink: 0 }} />
          <span style={{ fontSize: mobile ? '0.6875rem' : '0.8125rem', fontWeight: 700, color: 'var(--fg)' }}>
            Operational Volatility Index
          </span>
          {!mobile && (
            <span style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)' }}>
              — live · 28 feeds · updates ~5 min
            </span>
          )}
        </div>
        <a href="/roc" style={{ fontSize: mobile ? '0.6875rem' : '0.75rem', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
          Open full ROC ↗
        </a>
      </div>
      <iframe
        src="/roc/dashboards/scores.html"
        title="OVIX Volatility Tape"
        loading="eager"
        allow="clipboard-write"
        style={{
          display: 'block',
          width: '100%',
          height: mobile ? '520px' : '750px',
          border: 'none',
          background: 'var(--bg)',
        }}
      />
    </section>
  )
}

// Section header helper
function SectionHead({ icon, title, count, href, linkLabel }: { icon?: string; title: string; count?: number | string; href?: string; linkLabel?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '0.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
        {icon && <span style={{ fontSize: '0.9375rem' }}>{icon}</span>}
        <span style={{ fontSize: '0.9375rem', fontWeight: 700 }}>{title}</span>
        {count !== undefined && (
          <span style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.0625rem 0.5rem' }}>{count}</span>
        )}
      </div>
      {href && (
        <a href={href} style={{ fontSize: '0.75rem', color: 'var(--accent)', textDecoration: 'none', flexShrink: 0, fontWeight: 600 }}>
          {linkLabel || 'View all →'}
        </a>
      )}
    </div>
  )
}

// 3 — Live Incidents
function IncidentsSection({ incidents }: { incidents: HomeIncident[] }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <SectionHead icon="🚨" title="Live Incidents" count={incidents.length || undefined} href="/incidents" linkLabel="View all incidents →" />
      {incidents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1.75rem 1rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', color: 'var(--fg-muted)' }}>
          <p style={{ fontSize: '0.9375rem', fontWeight: 500, margin: '0 0 0.25rem' }}>No active incidents</p>
          <p style={{ fontSize: '0.8125rem', margin: 0, color: 'var(--fg-faint)' }}>Watchkeeper will declare incidents when severity thresholds are met.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
          {incidents.map((inc) => {
            const sc = sevConfig[inc.sev_level] || sevConfig.SEV4
            const regions = Array.isArray(inc.affected_regions) && inc.affected_regions.length > 0
              ? inc.affected_regions.join(', ')
              : [inc.location_name, inc.location_country].filter(Boolean).join(', ') || 'Global'
            const lat = inc.location_lat == null ? NaN : Number(inc.location_lat)
            const lon = inc.location_lon == null ? NaN : Number(inc.location_lon)
            const hasCoords = !Number.isNaN(lat) && !Number.isNaN(lon)
            return (
              <LiveIncidentCard
                key={inc.id}
                slug={inc.slug}
                title={inc.title}
                domain={inc.domain}
                regions={regions}
                time={timeAgo(inc.declared_at)}
                lat={lat}
                lon={lon}
                hasCoords={hasCoords}
                sev={sc}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

// 4 — Latest Compass Brief
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BriefSection({ brief }: { brief: any | null }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <SectionHead icon="🧭" title="Latest Compass Brief" href="/briefs" linkLabel="All briefs →" />
      {!brief ? (
        <div style={{ textAlign: 'center', padding: '1.75rem 1rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', color: 'var(--fg-muted)' }}>
          <p style={{ fontSize: '0.9375rem', fontWeight: 500, margin: '0 0 0.25rem' }}>No briefs published yet</p>
          <p style={{ fontSize: '0.8125rem', margin: 0, color: 'var(--fg-faint)' }}>Compass publishes operational briefs as events develop.</p>
        </div>
      ) : (() => {
        const excerptRaw: string = brief.excerpt || brief.summary || brief.description || ''
        const excerpt = excerptRaw.length > 180 ? excerptRaw.slice(0, 180) + '…' : excerptRaw
        const dateStr = brief.publishedAt || brief.publishDate || brief.createdAt
        return (
          <a
            href={`/briefs/${brief.slug}`}
            className="card"
            style={{ display: 'block', padding: '1.25rem 1.5rem', textDecoration: 'none', color: 'inherit', borderTop: '2px solid #14b8a6' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.625rem', fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0.125rem 0.5rem', borderRadius: '4px', background: 'rgba(20,184,166,0.1)', color: '#2dd4bf', border: '1px solid rgba(20,184,166,0.2)' }}>
                Compass{brief.issueNumber ? ` · Issue #${brief.issueNumber}` : ''}
              </span>
              {dateStr && <span style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)' }}>{briefDate(dateStr)}</span>}
            </div>
            <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, lineHeight: 1.3, margin: '0 0 0.5rem' }}>{brief.title}</h3>
            {excerpt && <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', lineHeight: 1.6, margin: '0 0 0.625rem' }}>{excerpt}</p>}
            <span style={{ fontSize: '0.8125rem', color: 'var(--accent)', fontWeight: 600 }}>Read full →</span>
          </a>
        )
      })()}
    </div>
  )
}

// 6 — Live Signals + Geopolitical Intel (keeps the SignalFeed)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function IntelSection({ stories }: { stories: any[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
      {/* Live Signals (SignalFeed) */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', borderTop: '2px solid #22d3ee', overflow: 'hidden' }}>
        <div style={{ padding: '0.875rem 1rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span style={{ fontSize: '0.875rem' }}>{'◆'}</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Live Signals</span>
          </div>
          <a href="/signals" style={{ fontSize: '0.6875rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>View all →</a>
        </div>
        <div style={{ padding: '0 1rem 1rem' }}>
          <SignalFeed limit={6} compact />
        </div>
      </div>

      {/* Geopolitical Intel */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', borderTop: '2px solid #f59e0b', overflow: 'hidden' }}>
        <div style={{ padding: '0.875rem 1rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span style={{ fontSize: '0.875rem' }}>{'🌐'}</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Geopolitical Intel</span>
          </div>
          <a href="/signals" style={{ fontSize: '0.6875rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>All stories →</a>
        </div>
        <div style={{ padding: '0 1rem 1rem' }}>
          {stories.length === 0 ? (
            <div style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)', padding: '1rem 0', textAlign: 'center' }}>No active stories</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {stories.map((s: { title: string; severity: number; trajectory: string; affected_regions?: string | string[] }, i: number) => (
                <div key={i} style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', borderLeft: `3px solid ${sevColor(s.severity)}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.1875rem' }}>
                    <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#fff', background: sevColor(s.severity), padding: '0.0625rem 0.375rem', borderRadius: '3px', flexShrink: 0 }}>{s.severity}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)' }}>{trajectoryArrows[s.trajectory] || '→'}</span>
                  </div>
                  <div style={{ fontSize: '0.5625rem', color: 'var(--fg-faint)' }}>
                    {Array.isArray(s.affected_regions) ? s.affected_regions.join(', ') : s.affected_regions || 'Global'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 7 — Tools strip
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ToolsSection({ tools }: { tools: any[] }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <SectionHead icon={'🛠'} title="WFM Tools" count={tools.length || undefined} href="/tools" linkLabel="Browse all →" />
      {tools.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '1.75rem 1rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)', color: 'var(--fg-muted)', fontSize: '0.875rem' }}>
          Tools coming soon.
        </div>
      ) : (
        <div className="tools-grid">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {tools.map((tool: any) => (
            <AssetCard
              key={tool.id}
              title={tool.title}
              description={tool.description}
              slug={tool.slug}
              assetType="tool"
              category={tool.category || null}
              status={tool.status}
              tier={tool.tier}
              stats={tool.stats}
              primaryContributor={tool.primaryContributor}
              isFeatured={tool.isFeatured}
              updatedAt={tool.updatedAt}
              createdAt={tool.createdAt}
              href={`/tools/${tool.slug}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// 8 — Community & Research band
function CommunitySection({
  papers, members, memberTotal, discussions,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  papers: any[]; members: any[]; memberTotal: number; discussions: any[]
}) {
  const assetPathMap: Record<string, string> = {
    papers: '/research', articles: '/articles', tools: '/tools', 'newsletter-issues': '/compass', 'wiki-entries': '/wiki',
  }
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <SectionHead icon="🤝" title="Community & Research" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))', gap: '1rem' }}>

        {/* Latest Research */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>🔬 Latest Research</span>
            <a href="/research" style={{ fontSize: '0.6875rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>All →</a>
          </div>
          {papers.length === 0 ? (
            <div style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)', padding: '0.75rem 0', textAlign: 'center' }}>No papers yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {papers.map((p: any) => (
                <a key={p.id} href={`/research/${p.slug}`} style={{ display: 'block', padding: '0.625rem 0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.35, marginBottom: '0.25rem' }}>{p.title}</div>
                  <div style={{ fontSize: '0.625rem', color: 'var(--fg-faint)' }}>
                    {p.sourceName || (p.authors && p.authors[0]?.name) || 'Research'}{p.createdAt ? ` · ${timeAgo(p.createdAt)}` : ''}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Builder Members */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>👥 Builder Members</span>
            <a href="/members" style={{ fontSize: '0.6875rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>All →</a>
          </div>
          {members.length === 0 ? (
            <div style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)', padding: '0.75rem 0', textAlign: 'center' }}>No members yet</div>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {members.map((m: any) => (
                  <a key={m.id} href={`/member/${m.username}`} title={m.displayName} style={{ textDecoration: 'none' }}>
                    <MemberAvatar member={m} size="2.5rem" fontSize="1rem" />
                  </a>
                ))}
              </div>
              <a href="/members" style={{ fontSize: '0.8125rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>
                {memberTotal.toLocaleString()} member{memberTotal === 1 ? '' : 's'} in the community →
              </a>
            </>
          )}
        </div>

        {/* Hot Discussions */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>💬 Hot Discussions</span>
            <a href="/discussions" style={{ fontSize: '0.6875rem', color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}>All →</a>
          </div>
          {discussions.length === 0 ? (
            <div style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)', padding: '0.75rem 0', textAlign: 'center' }}>No discussions yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {discussions.map((d: any) => {
                const author = typeof d.author === 'object' && d.author !== null ? d.author : null
                const rel = d.asset?.relationTo || ''
                const assetVal = typeof d.asset?.value === 'object' ? d.asset.value : null
                const assetSlug = assetVal?.slug || ''
                const href = assetSlug ? `${assetPathMap[rel] || ''}/${assetSlug}` : '/discussions'
                const title = assetVal?.title || assetVal?.name || 'Community discussion'
                return (
                  <a key={d.id} href={href} style={{ display: 'block', padding: '0.625rem 0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.35, marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</div>
                    <div style={{ fontSize: '0.625rem', color: 'var(--fg-faint)' }}>
                      {author?.displayName || 'Member'}{d.createdAt ? ` · ${timeAgo(d.createdAt)}` : ''}
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// 9 — Join CTA (pricing page removed 2026-07-15, hub-032 — CTAs point at the community)
function JoinCTA({ authed }: { authed: boolean }) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(34,211,238,0.08) 0%, rgba(34,211,238,0.02) 100%)',
        border: '1px solid rgba(34,211,238,0.25)',
        borderRadius: 'var(--radius-lg)',
        padding: '2rem 1.5rem',
        textAlign: 'center',
        marginBottom: '1.5rem',
      }}
    >
      <h2 style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', fontWeight: 800, margin: '0 0 0.5rem' }}>
        {authed ? 'Unlock the full builder community' : 'Join the builder community'}
      </h2>
      <p style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', maxWidth: '36rem', margin: '0 auto 1.25rem', lineHeight: 1.6 }}>
        Where WFM practitioners and purpose-built AI agents collaborate on live operational data — tools, research, and intelligence built by practitioners, for practitioners.
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        {authed ? (
          <a href="/members" className="btn btn-primary" style={{ padding: '0.625rem 1.75rem', fontSize: '0.9375rem' }}>Explore the community</a>
        ) : (
          <>
            <a href="/login" className="btn btn-primary" style={{ padding: '0.625rem 1.75rem', fontSize: '0.9375rem' }}>Get started</a>
            <a href="/members" className="btn btn-secondary" style={{ padding: '0.625rem 1.75rem', fontSize: '0.9375rem' }}>Meet the members</a>
          </>
        )}
      </div>
    </div>
  )
}

// 10 — Quick links footer
function QuickLinks() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
      {[
        { title: 'Research', desc: 'Curated papers and analysis', href: '/research', icon: '🔬' },
        { title: 'APIs', desc: 'Live data feeds', href: '/data-sources', icon: '📡' },
        { title: 'Discussions', desc: 'Community Q&A', href: '/discussions', icon: '💬' },
        { title: 'Docs', desc: 'Wiki & guides', href: '/wiki', icon: '📖' },
      ].map((link) => (
        <a key={link.href} href={link.href} className="card" style={{ padding: '1rem', textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem' }}>{link.icon}</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{link.title}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>{link.desc}</div>
          </div>
        </a>
      ))}
    </div>
  )
}

// Compact status strip (2)
function StatusStrip({
  healthy, totalFeeds, travelComposite, travelLevel, storiesCount, highSevStories, totalSignals,
}: {
  healthy: number; totalFeeds: number; travelComposite: number; travelLevel: string; storiesCount: number; highSevStories: number; totalSignals: number
}) {
  return (
    <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.5rem 0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)' }}>Mission Control</span>
        <span style={{ width: '0.375rem', height: '0.375rem', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', animation: 'pulse 2s infinite' }} />
        <span style={{ fontSize: '0.625rem', color: '#22c55e', fontWeight: 600 }}>LIVE</span>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.6875rem', color: 'var(--fg-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.1875rem 0.625rem' }}>
          <span style={{ color: totalFeeds > 0 && healthy === totalFeeds ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>OVIX</span> {healthy}/{totalFeeds} feeds
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--fg-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.1875rem 0.625rem' }}>
          <span style={{ color: levelColor(travelLevel), fontWeight: 600 }}>TRAVEL</span> {travelComposite.toFixed(1)} {travelLevel}
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--fg-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.1875rem 0.625rem' }}>
          <span style={{ color: highSevStories > 0 ? '#ef4444' : 'var(--accent)', fontWeight: 600 }}>INTEL</span> {storiesCount} stories{highSevStories > 0 ? ` | ${highSevStories} critical` : ''}
        </span>
        <span style={{ fontSize: '0.6875rem', color: 'var(--fg-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.1875rem 0.625rem' }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>SIGNALS</span> {totalSignals.toLocaleString()} total
        </span>
      </div>
      <span style={{ fontSize: '0.5625rem', color: 'var(--fg-faint)' }}>
        {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} UTC
      </span>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
//  Page
// ──────────────────────────────────────────────────────────────────────────
export default async function HomePage() {
  const session = await auth()
  const isAuthed = !!session?.user
  const userAgent = (await headers()).get('user-agent') || ''
  const isMobile = /iPhone|iPad|Android|Mobile|webOS|BlackBerry|Opera Mini/i.test(userAgent)

  const payload = await getPayload({ config })

  // All fetches run in parallel; every one degrades to an empty/null fallback.
  const [
    feedHealth, travelScores, newsStories, signalsResult, toolsResult,
    incidents, briefResult, papersResult, membersResult, discussionsResult,
  ] = await Promise.all([
    fetch('https://ovix-api.tedlango.workers.dev/api/ovix/feed-health', { next: { revalidate: 300 } }).then(r => r.json()).catch(() => null),
    fetch('https://travel-intel.tedlango.workers.dev/api/travel/scores', { next: { revalidate: 300 } }).then(r => r.json()).catch(() => null),
    fetch('https://news-intel.tedlango.workers.dev/stories', { next: { revalidate: 300 } }).then(r => r.json()).catch(() => null),
    payload.find({ collection: 'signals', limit: 1, sort: '-createdAt', overrideAccess: true }).catch(() => ({ docs: [], totalDocs: 0 })),
    payload.find({ collection: 'tools', limit: 8, sort: '-updatedAt', depth: 1, overrideAccess: true, where: { publishedAt: { exists: true } } }).catch(() => ({ docs: [] })),
    fetchOpenIncidents(),
    // Compass daily briefs live in `briefs` (briefType=summary) — `newsletter-issues` is empty (reserved for a future newsletter).
    payload.find({ collection: 'briefs', limit: 1, sort: '-publishedAt', depth: 0, overrideAccess: true, where: { and: [{ briefType: { equals: 'summary' } }, { status: { equals: 'published' } }] } }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'papers', limit: 3, sort: '-createdAt', depth: 1, overrideAccess: true }).catch(() => ({ docs: [] })),
    payload.find({ collection: 'members', limit: 6, sort: '-createdAt', depth: 1, overrideAccess: true, where: { and: [{ 'visibility.showInDirectory': { not_equals: false } }, { type: { not_equals: 'agent' } }] } }).catch(() => ({ docs: [], totalDocs: 0 })),
    payload.find({ collection: 'discussions', limit: 3, sort: '-createdAt', depth: 2, overrideAccess: true, where: { parentDiscussion: { exists: false } } }).catch(() => ({ docs: [] })),
  ])

  // Derive status-strip data
  const healthy = feedHealth?.healthy || 0
  const totalFeeds = feedHealth?.totalFeeds || 0
  const travelComposite = travelScores?.composite || 0
  const travelLevel = travelScores?.level || 'NOMINAL'
  const stories = (newsStories?.stories || []).slice(0, 6)
  const highSevStories = stories.filter((s: { severity: number }) => s.severity >= 7).length
  const totalSignals = signalsResult?.totalDocs || 0

  // Tools — shuffle for variety, feature 6
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allTools = (toolsResult?.docs || []) as any[]
  const shuffled = [...allTools]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const featuredTools = shuffled.slice(0, 6)

  const latestBrief = briefResult?.docs?.[0] || null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const papers = (papersResult?.docs || []) as any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const members = (membersResult?.docs || []) as any[]
  const memberTotal = membersResult?.totalDocs || members.length
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const discussions = (discussionsResult?.docs || []) as any[]

  const statusProps = { healthy, totalFeeds, travelComposite, travelLevel, storiesCount: stories.length, highSevStories, totalSignals }

  const sharedSections = () => (
    <>
      <IncidentsSection incidents={incidents} />
      <BriefSection brief={latestBrief} />
      <IntelSection stories={stories} />
      <ToolsSection tools={featuredTools} />
      <CommunitySection papers={papers} members={members} memberTotal={memberTotal} discussions={discussions} />
      <JoinCTA authed={isAuthed} />
      <QuickLinks />
    </>
  )

  // ── Mobile ──
  if (isMobile) {
    return (
      <>
        <SignalGlobeHero mobile />
        <div style={{ padding: '0.75rem' }}>
          <HeroTape mobile />
          <StatusStrip {...statusProps} />
          {!isAuthed && (
            <div style={{ textAlign: 'center', padding: '0 0.25rem 1rem' }}>
              <a href="/login" className="btn btn-primary" style={{ padding: '0.5rem 1.5rem', fontSize: '0.875rem' }}>Get started</a>
            </div>
          )}
          {sharedSections()}
          <PulseStyle />
        </div>
      </>
    )
  }

  // ── Desktop ──
  return (
    <>
      <SignalGlobeHero mobile={false} />
      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '1.25rem 1rem' }}>
        <HeroTape mobile={false} />
        <StatusStrip {...statusProps} />
        {sharedSections()}
        <PulseStyle />
      </div>
    </>
  )
}

function PulseStyle() {
  return (
    <style>{`
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    `}</style>
  )
}
