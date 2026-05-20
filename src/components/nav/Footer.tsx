import React from 'react'

const footerLinks = [
  {
    title: 'Content',
    links: [
      { href: '/wiki', label: 'Wiki' },
      { href: '/research', label: 'Research' },
      { href: '/tools', label: 'Tools' },
      // { href: '/articles', label: 'Articles' },  // Suspended
      { href: '/compass', label: 'Compass' },
    ],
  },
  {
    title: 'Community',
    links: [
      { href: '/members', label: 'Members' },
      { href: '/about', label: 'About' },
    ],
  },
  {
    title: 'WFM Labs',
    links: [
      { href: 'https://wfmlabs.com', label: 'wfmlabs.com' },
      { href: '/admin', label: 'Admin' },
    ],
  },
]

export function Footer() {
  return (
    <footer
      style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        marginTop: '4rem',
      }}
    >
      <div
        style={{
          maxWidth: '80rem',
          margin: '0 auto',
          padding: '3rem 1rem 2rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))',
          gap: '2rem',
        }}
      >
        {footerLinks.map((group) => (
          <div key={group.title}>
            <h4
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--fg-muted)',
                marginBottom: '0.75rem',
              }}
            >
              {group.title}
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {group.links.map((link) => (
                <li key={link.href} style={{ marginBottom: '0.375rem' }}>
                  <a
                    href={link.href}
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--fg-faint)',
                      textDecoration: 'none',
                    }}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div
        style={{
          maxWidth: '80rem',
          margin: '0 auto',
          padding: '1rem',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <span style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)' }}>
          &copy; {new Date().getFullYear()} WFM Labs. Built for practitioners.
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)' }}>
          Powered by Payload CMS + Next.js
        </span>
      </div>
    </footer>
  )
}
