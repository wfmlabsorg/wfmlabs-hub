import React from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ROC — Resource Optimization Center | WFM Labs',
  description:
    'Live operational command center for workforce management. Real-time intelligence, OVIX monitoring, and embedded WFM tools.',
}

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

const rocViews = [
  {
    title: 'Globe',
    icon: '\uD83C\uDF0D',
    description:
      'CesiumJS globe with live Operational Volatility Index overlay. Semantic zoom from global to metro-level operational detail.',
    route: '/roc/globe',
    status: 'Coming Soon',
    active: false,
  },
  {
    title: 'Signals',
    icon: '\uD83D\uDCE1',
    description:
      'Real-time signal feed — automated intelligence from weather, cyber, financial, and infrastructure sources mixed with community insights.',
    route: '/roc/signals',
    status: 'Coming Soon',
    active: false,
  },
  {
    title: 'Tools',
    icon: '\u2699\uFE0F',
    description:
      'Embedded WFM tools — variance analyzers, Monte Carlo simulators, Erlang calculators, and maturity assessments.',
    route: '/roc/tools',
    status: 'Coming Soon',
    active: false,
  },
  {
    title: 'Dashboard',
    icon: '\uD83D\uDCCA',
    description:
      'OVIX time-series dashboard with domain breakdowns, trend analysis, and operational state monitoring across all nine domains.',
    route: '/roc/dashboard',
    status: 'Coming Soon',
    active: false,
  },
]

async function OvixLiveWidget() {
  const data = await fetch('https://ovix-api.tedlango.workers.dev/api/ovix/feed-health', {
    next: { revalidate: 300 },
  })
    .then((r) => r.json())
    .catch(() => null)

  const totalFeeds = data?.totalFeeds || 0
  const healthy = data?.healthy || 0
  const stale = totalFeeds - healthy

  return (
    <div className="roc-ovix-section">
      <div className="roc-section-label">Live Status</div>
      <a
        href="/data-sources"
        className="roc-ovix-card"
        style={{ textDecoration: 'none', color: 'inherit' }}
      >
        <div>
          <div className="roc-ovix-label">OVIX Feed Status</div>
          <div className="roc-ovix-stats">
            {data
              ? `${totalFeeds} feeds \u00B7 ${healthy} healthy \u00B7 ${stale} stale`
              : 'Connecting to feed network\u2026'}
          </div>
        </div>
        <div className="roc-ovix-domains">
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
                boxShadow: `0 0 4px ${d.color}60`,
              }}
            />
          ))}
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--roc-fg-faint)',
              marginLeft: '0.5rem',
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            }}
          >
            View feeds &rarr;
          </span>
        </div>
      </a>
    </div>
  )
}

export default function RocPage() {
  return (
    <div className="roc-page">
      {/* Header */}
      <header className="roc-header">
        <h1 className="roc-title">
          <span className="roc-title-accent">ROC</span>
        </h1>
        <p
          style={{
            fontSize: '0.8125rem',
            color: 'var(--roc-fg-faint)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: '1rem',
          }}
        >
          Resource Optimization Center
        </p>
        <p className="roc-subtitle">
          Bloomberg Terminal meets NASA Mission Control &mdash; purpose-built for workforce
          management. Real-time intelligence, live OVIX monitoring, and embedded operational tools.
        </p>
      </header>

      {/* OVIX Live Status */}
      <OvixLiveWidget />

      {/* Divider */}
      <div className="roc-divider">
        <hr />
      </div>

      {/* View Cards */}
      <div className="roc-section-label">Command Views</div>
      <div className="roc-grid">
        {rocViews.map((view) => (
          <div key={view.title} className="roc-card">
            <span className="roc-card-icon">{view.icon}</span>
            <div className="roc-card-title">{view.title}</div>
            <div className="roc-card-desc">{view.description}</div>
            <div className="roc-card-status">
              <span
                className={`roc-card-status-dot ${view.active ? 'roc-card-status-dot-active' : ''}`}
              />
              {view.status}
            </div>
          </div>
        ))}
      </div>

      {/* ROC Beta Link */}
      <div
        style={{
          textAlign: 'center',
          padding: '1rem 1rem 3rem',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        }}
      >
        <a
          href="https://roc-beta.wfmlabs.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '0.8125rem',
            color: 'var(--roc-fg-faint)',
            textDecoration: 'none',
            borderBottom: '1px solid var(--roc-border)',
            paddingBottom: '0.125rem',
          }}
        >
          Visit ROC Beta at roc-beta.wfmlabs.com &rarr;
        </a>
      </div>
    </div>
  )
}
