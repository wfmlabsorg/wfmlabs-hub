import React from 'react'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import config from '@payload-config'
import { auth } from '@/lib/auth'
import { SignalFeed } from '@/components/signals/SignalFeed'
import { AssetCard } from '@/components/cards/AssetCard'

// ── Score → color ──
function sevColor(s: number): string {
  if (s >= 8) return '#ef4444'
  if (s >= 6) return '#f97316'
  if (s >= 4) return '#eab308'
  if (s >= 2) return '#22d3ee'
  return '#10b981'
}

function levelColor(l: string): string {
  switch (l) {
    case 'CRITICAL': return '#ef4444'
    case 'SEVERE': return '#f97316'
    case 'SIGNIFICANT': return '#eab308'
    case 'ELEVATED': return '#22d3ee'
    default: return '#10b981'
  }
}

const trajectoryArrows: Record<string, string> = {
  escalating: '↑', peak: '⬆', steady: '→', declining: '↓', emerging: '↗', resolved: '✓',
}

export const dynamic = 'force-dynamic'
export default async function HomePage() {
  const session = await auth()

  // ── Unauthenticated → marketing landing ──
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
            <a href="/login" className="btn btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>Get Started</a>
            <a href="/pricing" className="btn btn-secondary" style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}>View Pricing</a>
          </div>
        </section>
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
        <section style={{ textAlign: 'center', padding: '3rem 1rem 4rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--fg-faint)', marginBottom: '1rem' }}>
            Built for WFM practitioners managing contact centers, back offices, and knowledge worker operations worldwide.
          </p>
          <a href="/pricing" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>See pricing {'\u2192'}</a>
        </section>
      </div>
    )
  }

  // ── Authenticated → Mission Control Dashboard ──
  const userAgent = (await headers()).get('user-agent') || ''
  const isMobile = /iPhone|iPad|Android|Mobile|webOS|BlackBerry|Opera Mini/i.test(userAgent)

  const payload = await getPayload({ config })

  // Parallel data fetches
  const [feedHealth, travelScores, newsStories, signalsResult, toolsResult] = await Promise.all([
    fetch('https://ovix-api.tedlango.workers.dev/api/ovix/feed-health', { next: { revalidate: 300 } })
      .then(r => r.json()).catch(() => null),
    fetch('https://travel-intel.tedlango.workers.dev/api/travel/scores', { next: { revalidate: 300 } })
      .then(r => r.json()).catch(() => null),
    fetch('https://news-intel.tedlango.workers.dev/stories', { next: { revalidate: 300 } })
      .then(r => r.json()).catch(() => null),
    payload.find({ collection: 'signals', limit: 5, sort: '-createdAt', overrideAccess: true }).catch(() => ({ docs: [], totalDocs: 0 })),
    payload.find({ collection: 'tools', limit: 8, sort: '-updatedAt', depth: 1, overrideAccess: true, where: { publishedAt: { exists: true } } }).catch(() => ({ docs: [] })),
  ])

  // Extract data
  const healthy = feedHealth?.healthy || 0
  const totalFeeds = feedHealth?.totalFeeds || 0
  const travelComposite = travelScores?.composite || 0
  const travelLevel = travelScores?.level || 'NOMINAL'
  const travelDomains = travelScores?.domains || []
  const travelEvents = travelScores?.events || []
  const stories = (newsStories?.stories || []).slice(0, 4)
  const highSevStories = stories.filter((s: { severity: number }) => s.severity >= 7).length
  const signals = signalsResult?.docs || []
  const totalSignals = signalsResult?.totalDocs || 0
  const tools = toolsResult?.docs || []

  // Shuffle tools for variety
  const shuffled = [...tools]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const featuredTools = shuffled.slice(0, 6)

  // ── Mobile View ──
  if (isMobile) {
    return (
      <div style={{ padding: '0.75rem' }}>
        {/* Status header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', padding: '0.5rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)' }}>Mission Control</span>
            <span style={{ width: '0.375rem', height: '0.375rem', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
          </div>
          <span style={{ fontSize: '0.5625rem', color: 'var(--fg-faint)' }}>
            {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* OVIX + Travel composite scores */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.75rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.5625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: healthy === totalFeeds ? '#22c55e' : '#f59e0b', marginBottom: '0.25rem' }}>OVIX Feeds</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{healthy}/{totalFeeds}</div>
            <div style={{ fontSize: '0.5625rem', color: 'var(--fg-faint)' }}>healthy</div>
          </div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.75rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.5625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: levelColor(travelLevel), marginBottom: '0.25rem' }}>Travel</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: levelColor(travelLevel) }}>{travelComposite.toFixed(1)}</div>
            <div style={{ fontSize: '0.5625rem', color: levelColor(travelLevel) }}>{travelLevel}</div>
          </div>
        </div>

        {/* Travel domain bars — compact */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, marginBottom: '0.5rem' }}>Travel Disruption Index</div>
          {travelDomains.map((d: { domain: string; score: number }) => (
            <div key={d.domain} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem', fontSize: '0.6875rem' }}>
              <span style={{ width: '4rem', color: 'var(--fg-muted)', textTransform: 'capitalize' }}>{d.domain}</span>
              <div style={{ flex: 1, height: '0.3rem', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(d.score * 10, 100)}%`, background: sevColor(d.score), borderRadius: '2px' }} />
              </div>
              <span style={{ width: '1.5rem', textAlign: 'right', fontWeight: 600, color: sevColor(d.score), fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.625rem' }}>{d.score.toFixed(1)}</span>
            </div>
          ))}
        </div>

        {/* Signals — compact list */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700 }}>Latest Signals</span>
            <a href="/signals" style={{ fontSize: '0.625rem', color: 'var(--fg-faint)', textDecoration: 'none' }}>All →</a>
          </div>
          <SignalFeed limit={4} compact />
        </div>

        {/* Intel stories — compact */}
        {stories.length > 0 && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 700 }}>Geopolitical Intel</span>
              <a href="/signals" style={{ fontSize: '0.625rem', color: 'var(--fg-faint)', textDecoration: 'none' }}>All →</a>
            </div>
            {stories.slice(0, 3).map((s: { title: string; severity: number; trajectory: string }, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none', fontSize: '0.6875rem' }}>
                <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#fff', background: sevColor(s.severity), padding: '0.0625rem 0.25rem', borderRadius: '3px', flexShrink: 0 }}>{s.severity}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                <span style={{ color: 'var(--fg-faint)', flexShrink: 0 }}>{trajectoryArrows[s.trajectory] || '→'}</span>
              </div>
            ))}
          </div>
        )}

        {/* OVIX dashboards — 2-col tap grid */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.75rem', marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, marginBottom: '0.5rem' }}>Dashboards</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.375rem' }}>
            {[
              { icon: '⛈', label: 'Weather', path: 'weather', color: '#3b82f6' },
              { icon: '🌋', label: 'Seismic', path: 'seismic', color: '#ef4444' },
              { icon: '🔥', label: 'Disaster', path: 'disaster', color: '#f97316' },
              { icon: '🛡', label: 'Cyber', path: 'cyber', color: '#22c55e' },
              { icon: '🏥', label: 'Health', path: 'health', color: '#ec4899' },
              { icon: '📈', label: 'Financial', path: 'financial-markets', color: '#f59e0b' },
              { icon: '🌐', label: 'Geopolitical', path: 'geopolitical', color: '#6366f1' },
              { icon: '✈', label: 'Travel', path: 'travel', color: '#06b6d4' },
            ].map(d => (
              <a key={d.path} href={`/roc#/browse/roc-dashboards:root/roc-dashboards:${d.path}`} target="_blank" rel="noopener"
                style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', borderLeft: `2px solid ${d.color}`, textDecoration: 'none', color: 'inherit', fontSize: '0.6875rem', fontWeight: 600 }}>
                <span>{d.icon}</span>
                <span>{d.label}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Quick nav */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.375rem' }}>
          {[
            { label: 'Tools', href: '/tools', icon: '🛠' },
            { label: 'Research', href: '/research', icon: '🔬' },
            { label: 'Discuss', href: '/discussions', icon: '💬' },
            { label: 'Docs', href: '/wiki', icon: '📖' },
          ].map(l => (
            <a key={l.href} href={l.href} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', padding: '0.625rem', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', textDecoration: 'none', color: 'inherit', fontSize: '0.625rem', fontWeight: 600 }}>
              <span style={{ fontSize: '1.25rem' }}>{l.icon}</span>
              {l.label}
            </a>
          ))}
        </div>
      </div>
    )
  }

  // ── Desktop View ──
  return (
    <div>
      {/* ── Status Bar ── */}
      <div style={{
        background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)',
        padding: '0.625rem 1rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--accent)' }}>
            Mission Control
          </span>
          <span style={{ width: '0.375rem', height: '0.375rem', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', animation: 'pulse 2s infinite' }} />
          <span style={{ fontSize: '0.625rem', color: '#22c55e', fontWeight: 600 }}>LIVE</span>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* OVIX feeds */}
          <span style={{ fontSize: '0.6875rem', color: 'var(--fg-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.1875rem 0.625rem' }}>
            <span style={{ color: healthy === totalFeeds ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>OVIX</span> {healthy}/{totalFeeds} feeds
          </span>
          {/* Travel */}
          <span style={{ fontSize: '0.6875rem', color: 'var(--fg-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.1875rem 0.625rem' }}>
            <span style={{ color: levelColor(travelLevel), fontWeight: 600 }}>TRAVEL</span> {travelComposite.toFixed(1)} {travelLevel}
          </span>
          {/* Intel */}
          <span style={{ fontSize: '0.6875rem', color: 'var(--fg-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.1875rem 0.625rem' }}>
            <span style={{ color: highSevStories > 0 ? '#ef4444' : 'var(--accent)', fontWeight: 600 }}>INTEL</span> {stories.length} stories {highSevStories > 0 && `| ${highSevStories} critical`}
          </span>
          {/* Signals */}
          <span style={{ fontSize: '0.6875rem', color: 'var(--fg-muted)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.1875rem 0.625rem' }}>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>SIGNALS</span> {totalSignals.toLocaleString()} total
          </span>
        </div>

        <span style={{ fontSize: '0.5625rem', color: 'var(--fg-faint)' }}>
          {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} UTC
        </span>
      </div>

      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '1.25rem 1rem' }}>

        {/* ── Live Panels ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>

          {/* Panel A: Operations (scrolling signals) */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', borderTop: '2px solid #ef4444', overflow: 'hidden' }}>
            <div style={{ padding: '0.875rem 1rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.875rem' }}>{'\u25C6'}</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Operational Risk</span>
              </div>
              <a href="/signals" style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', textDecoration: 'none' }}>View all →</a>
            </div>
            <div style={{ padding: '0 1rem 1rem' }}>
              <SignalFeed limit={6} compact />
            </div>
          </div>

          {/* Panel B: Dashboard Rotator (rotating OVIX domains) */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', borderTop: '2px solid #22d3ee', padding: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.875rem' }}>📊</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>OVIX Dashboards</span>
              <a href="/roc" target="_blank" rel="noopener" style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: 'var(--fg-faint)', textDecoration: 'none' }}>Open ROC →</a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
              {[
                { icon: '⛈', label: 'Weather', path: 'weather', color: '#3b82f6' },
                { icon: '🌋', label: 'Seismic', path: 'seismic', color: '#ef4444' },
                { icon: '🔥', label: 'Disaster', path: 'disaster', color: '#f97316' },
                { icon: '🛡', label: 'Cyber', path: 'cyber', color: '#22c55e' },
                { icon: '🏥', label: 'Health', path: 'health', color: '#ec4899' },
                { icon: '🏗', label: 'Infrastructure', path: 'infrastructure', color: '#8b5cf6' },
                { icon: '📈', label: 'Financial', path: 'financial-markets', color: '#f59e0b' },
                { icon: '🌿', label: 'Environmental', path: 'environmental', color: '#14b8a6' },
                { icon: '🌐', label: 'Geopolitical', path: 'geopolitical', color: '#6366f1' },
                { icon: '✈', label: 'Travel', path: 'travel', color: '#06b6d4' },
              ].map(d => (
                <a key={d.path} href={`/roc#/browse/roc-dashboards:root/roc-dashboards:${d.path}`} target="_blank" rel="noopener"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', borderLeft: `3px solid ${d.color}`, textDecoration: 'none', color: 'inherit', fontSize: '0.75rem', fontWeight: 600, transition: 'border-color 0.2s' }}>
                  <span>{d.icon}</span>
                  <span>{d.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ── Intelligence Panel (full width below) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          {/* Panel C: Intelligence */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', borderTop: '2px solid #f59e0b', overflow: 'hidden' }}>
            <div style={{ padding: '0.875rem 1rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <span style={{ fontSize: '0.875rem' }}>{'\uD83C\uDF10'}</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Geopolitical Intel</span>
              </div>
              <a href="/signals" style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', textDecoration: 'none' }}>All stories →</a>
            </div>
            <div style={{ padding: '0 1rem 1rem' }}>
              {stories.length === 0 ? (
                <div style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)', padding: '1rem 0', textAlign: 'center' }}>No active stories</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))', gap: '0.5rem' }}>
                  {stories.map((s: { title: string; severity: number; trajectory: string; affected_regions: string | string[]; slug?: string }, i: number) => (
                    <div key={i} style={{ padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', borderLeft: `3px solid ${sevColor(s.severity)}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#fff', background: sevColor(s.severity), padding: '0.0625rem 0.375rem', borderRadius: '3px' }}>{s.severity}</span>
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

        {/* ── Tools Strip ── */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem' }}>{'\uD83D\uDEE0'}</span>
              <span style={{ fontSize: '0.9375rem', fontWeight: 700 }}>WFM Tools</span>
              <span style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '999px', padding: '0.0625rem 0.5rem' }}>{tools.length}</span>
            </div>
            <a href="/tools" style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', textDecoration: 'none' }}>Browse all →</a>
          </div>
          <div className="tools-grid">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {featuredTools.map((tool: any) => (
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
        </div>

        {/* ── Quick Links ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
          {[
            { title: 'Research', desc: 'Curated papers and analysis', href: '/research', icon: '\uD83D\uDD2C' },
            { title: 'APIs', desc: 'Live data feeds', href: '/data-sources', icon: '\uD83D\uDCE1' },
            { title: 'Discussions', desc: 'Community Q&A', href: '/discussions', icon: '\uD83D\uDCAC' },
            { title: 'Docs', desc: 'Wiki & guides', href: '/wiki', icon: '\uD83D\uDCD6' },
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
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @media (max-width: 768px) {
          div[style*="grid-template-columns: repeat(3"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
