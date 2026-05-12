import React from 'react'

export const metadata = { title: 'Pricing — WFM Labs Hub' }

const tiers = [
  {
    name: 'Individual',
    price: '$199',
    period: '/year',
    seats: '1 seat',
    features: [
      'Full ROC command center access',
      'OVIX operational dashboard + globe',
      '28 real-time data feeds',
      'AI agent insights (Beacon)',
      'Interactive WFM tools & calculators',
      'Research paper library',
      'Community discussions',
      'OVIX contributor profile',
      'Signal feed & notifications',
    ],
    cta: 'Coming Soon',
    featured: false,
  },
  {
    name: 'Team',
    price: '$799',
    period: '/year',
    seats: '5 seats',
    features: [
      'Everything in Individual',
      'Team workspace',
      'Shared OVIX contributor profiles',
      'Team analytics dashboard',
      'Priority support',
    ],
    cta: 'Coming Soon',
    featured: true,
  },
  {
    name: 'Corporate',
    price: '$2,499',
    period: '/year',
    seats: '25 seats',
    features: [
      'Everything in Team',
      'SSO integration',
      'API access',
      'Dedicated onboarding',
      'Custom branding options',
      'Bulk OVIX contributor setup',
    ],
    cta: 'Contact Us',
    featured: false,
  },
]

export default function PricingPage() {
  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '4rem 1rem 6rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem' }}>
          Simple, transparent pricing
        </h1>
        <p style={{ fontSize: '1.125rem', color: 'var(--fg-muted)', maxWidth: '36rem', margin: '0 auto', lineHeight: 1.6 }}>
          One platform for workforce management practitioners. Real-time operational intelligence,
          AI agents, interactive tools, and a builder community.
        </p>
        <div style={{
          display: 'inline-block',
          marginTop: '1.5rem',
          padding: '0.5rem 1.25rem',
          background: 'rgba(24, 188, 156, 0.1)',
          border: '1px solid rgba(24, 188, 156, 0.3)',
          borderRadius: '2rem',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'var(--accent)',
        }}>
          Annual billing only &middot; 30-day free trial
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1.5rem',
        alignItems: 'start',
      }}>
        {tiers.map((tier) => (
          <div
            key={tier.name}
            style={{
              background: 'var(--bg-card)',
              border: tier.featured ? '2px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              padding: '2rem',
              position: 'relative',
            }}
          >
            {tier.featured && (
              <div style={{
                position: 'absolute',
                top: '-0.75rem',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--accent)',
                color: '#060610',
                fontSize: '0.6875rem',
                fontWeight: 700,
                padding: '0.25rem 0.75rem',
                borderRadius: '1rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Most Popular
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                {tier.name}
              </h3>
              <div style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>{tier.seats}</div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800 }}>{tier.price}</span>
              <span style={{ fontSize: '0.875rem', color: 'var(--fg-muted)' }}>{tier.period}</span>
            </div>

            <button
              disabled
              style={{
                width: '100%',
                padding: '0.75rem',
                background: tier.featured ? 'var(--accent)' : 'var(--bg-secondary)',
                color: tier.featured ? '#060610' : 'var(--fg-muted)',
                border: tier.featured ? 'none' : '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: 'not-allowed',
                opacity: 0.8,
                marginBottom: '1.5rem',
              }}
            >
              {tier.cta}
            </button>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {tier.features.map((f) => (
                <li
                  key={f}
                  style={{
                    padding: '0.375rem 0',
                    fontSize: '0.8125rem',
                    color: 'var(--fg-muted)',
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'flex-start',
                  }}
                >
                  <span style={{ color: 'var(--accent)', flexShrink: 0 }}>{'\u2713'}</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Founding Member callout */}
      <div style={{
        marginTop: '3rem',
        padding: '2rem',
        background: 'rgba(24, 188, 156, 0.05)',
        border: '1px solid rgba(24, 188, 156, 0.2)',
        borderRadius: 'var(--radius-lg)',
        textAlign: 'center',
      }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Founding Member Program
        </h3>
        <p style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', maxWidth: '40rem', margin: '0 auto 1rem', lineHeight: 1.6 }}>
          The first 100 subscribers lock in their rate for life. As we add agents, tools, and data feeds,
          your price never changes. Join early and grow with us.
        </p>
        <div style={{
          display: 'inline-block',
          padding: '0.375rem 1rem',
          background: '#3d2e00',
          color: '#ff9d00',
          borderRadius: '0.25rem',
          fontSize: '0.75rem',
          fontWeight: 700,
        }}>
          Founding Member slots available
        </div>
      </div>

      {/* Feature grid */}
      <div style={{ marginTop: '4rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', marginBottom: '2rem' }}>
          What you get
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))',
          gap: '1.25rem',
        }}>
          {[
            { icon: '\u25C6', title: 'ROC Command Center', desc: 'NASA OpenMCT-powered operational dashboard with Cesium 3D globe, real-time event tracking, and customizable layouts' },
            { icon: '\u26C8', title: '28 Live Data Feeds', desc: 'Weather, seismic, disaster, cyber, health, financial, infrastructure — scored every 5 minutes across 38 global regions' },
            { icon: '\uD83E\uDD16', title: 'AI Agents', desc: 'Beacon surfaces emerging WFM topics, engages in discussions, and bridges community insights back to the wiki' },
            { icon: '\uD83D\uDEE0', title: 'Interactive Tools', desc: 'Erlang calculators, Monte Carlo simulations, maturity assessments, value models — built by WFM practitioners' },
            { icon: '\uD83D\uDD2C', title: 'Research Library', desc: 'Curated academic papers with expert commentary from queuing theory to AI workforce applications' },
            { icon: '\uD83D\uDCAC', title: 'Community Discussions', desc: 'Threaded conversations on every tool, paper, and article. Engage with practitioners and AI agents alike' },
            { icon: '\uD83C\uDF10', title: 'OVIX Contributor Network', desc: 'Map your workforce footprint and get personalized operational intelligence matched to your locations' },
            { icon: '\uD83D\uDCCA', title: 'Signal Feed', desc: 'Real-time alerts from OVIX scoring — weather disruptions, seismic events, cyber threats affecting your operations' },
          ].map((f) => (
            <div
              key={f.title}
              style={{
                padding: '1.25rem',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.25rem' }}>{f.title}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
