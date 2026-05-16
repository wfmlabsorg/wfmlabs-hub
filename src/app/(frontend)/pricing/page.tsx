import React from 'react'

export const metadata = { title: 'Pricing — WFM Labs Hub' }

const tiers = [
  {
    slug: 'individual',
    name: 'Individual',
    tagline: 'For solo practitioners and consultants.',
    price: '$199',
    period: '/year',
    perUnit: 'About $17/month, billed annually',
    seats: '1 named seat',
    cta: 'Start individual',
    ctaHref: '#',
    featured: false,
  },
  {
    slug: 'team',
    name: 'Team',
    tagline: 'For small ops and mid-market WFM teams.',
    price: '$899',
    period: '/year',
    perUnit: '$180/seat, billed annually',
    seats: 'Up to 5 named seats',
    cta: 'Start team',
    ctaHref: '#',
    featured: true,
  },
  {
    slug: 'organization',
    name: 'Organization',
    tagline: 'For WFM departments, BPOs, and enterprises.',
    price: '$4,995',
    period: '/year',
    perUnit: 'Flat fee, no seat cap',
    seats: 'Unlimited seats (domain-verified)',
    cta: 'Talk to us',
    ctaHref: 'mailto:ted@wfmlabs.com?subject=WFM%20Labs%20Organization%20Tier',
    featured: false,
  },
]

const included = [
  'ROC operational intelligence',
  'Beacon research librarian',
  'WFM tools and calculators',
  'Signals and daily briefs',
  'Member discussion',
  'Articles and research',
  'APIs and data sources',
  'Sign in with Google or GitHub',
]

export default function PricingPage() {
  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '4rem 1rem 6rem' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{
          fontSize: '0.6875rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--fg-muted)',
          marginBottom: '0.75rem',
        }}>
          Membership
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.15 }}>
          One platform. Pick your seats.
        </h1>
        <p style={{
          fontSize: '1.0625rem',
          color: 'var(--fg-muted)',
          maxWidth: '40rem',
          margin: '0 auto',
          lineHeight: 1.6,
        }}>
          Every tier gets the full Hub — ROC, Tools, Research, Agents.
          The only thing that changes is how many people from your team can access it.
        </p>
      </div>

      {/* Tier cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1.5rem',
        alignItems: 'start',
        marginBottom: '3rem',
      }}>
        {tiers.map((tier) => (
          <div
            key={tier.slug}
            style={{
              background: 'var(--bg-card)',
              border: tier.featured ? '2px solid var(--accent)' : '0.5px solid var(--border)',
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
                whiteSpace: 'nowrap',
              }}>
                Most popular
              </div>
            )}

            <div style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                {tier.name}
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', margin: 0 }}>
                {tier.tagline}
              </p>
            </div>

            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800 }}>{tier.price}</span>
              <span style={{ fontSize: '0.875rem', color: 'var(--fg-muted)' }}>{tier.period}</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', marginBottom: '1.25rem' }}>
              {tier.perUnit}
            </div>

            <a
              href={tier.ctaHref}
              style={{
                display: 'block',
                width: '100%',
                padding: '0.75rem',
                background: tier.featured ? 'var(--accent)' : 'var(--bg-secondary)',
                color: tier.featured ? '#060610' : 'var(--fg)',
                border: tier.featured ? 'none' : '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                fontWeight: 700,
                fontSize: '0.875rem',
                textAlign: 'center',
                textDecoration: 'none',
                cursor: 'pointer',
                marginBottom: '1.25rem',
                boxSizing: 'border-box',
              }}
            >
              {tier.cta}
            </a>

            <div style={{
              padding: '0.75rem',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius)',
              textAlign: 'center',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--fg)',
            }}>
              {tier.seats}
            </div>
          </div>
        ))}
      </div>

      {/* What's included */}
      <div style={{
        padding: '2.5rem',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        marginBottom: '2rem',
      }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, textAlign: 'center', marginBottom: '1.5rem' }}>
          What&apos;s included at every tier
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '0.75rem 3rem',
          maxWidth: '36rem',
          margin: '0 auto',
        }}>
          {included.map((item) => (
            <div
              key={item}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.875rem',
                color: 'var(--fg)',
              }}
            >
              <span style={{ color: 'var(--accent)', flexShrink: 0, fontSize: '0.875rem' }}>{'\u2713'}</span>
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Footer line */}
      <p style={{
        textAlign: 'center',
        fontSize: '0.8125rem',
        color: 'var(--fg-faint)',
      }}>
        All plans billed annually &middot; 14-day trial &middot; Cancel anytime
      </p>

      {/* Responsive */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: repeat(3"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="grid-template-columns: repeat(2"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
