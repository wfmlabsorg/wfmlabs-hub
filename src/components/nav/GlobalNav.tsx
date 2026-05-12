'use client'

import React, { useState } from 'react'
import { UserMenu } from './UserMenu'

const navLinks = [
  { href: '/roc', label: 'ROC', accent: true, newTab: true },
  { href: '/tools', label: 'Tools' },
  { href: '/research', label: 'Research' },
  { href: '/wiki', label: 'Wiki' },
  { href: '/frameworks', label: 'Frameworks' },
  { href: '/data-sources', label: 'APIs' },
  { href: '/scenarios', label: 'Scenarios' },
  { href: '/members', label: 'Members' },
]

export function GlobalNav() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'var(--nav-bg)',
        borderBottom: '1px solid var(--nav-border)',
      }}
    >
      <div
        style={{
          maxWidth: '80rem',
          margin: '0 auto',
          padding: '0 1rem',
          display: 'flex',
          alignItems: 'center',
          height: '3.5rem',
          gap: '1.5rem',
        }}
      >
        {/* Logo — HF-style: icon + wordmark */}
        <a
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 700,
            fontSize: '1rem',
            color: 'var(--fg)',
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '1.75rem',
            height: '1.75rem',
            background: 'var(--accent)',
            color: 'var(--accent-text)',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            fontWeight: 800,
          }}>W</span>
          <span>WFM Labs</span>
        </a>

        {/* Desktop nav links */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            flex: 1,
          }}
          className="nav-desktop"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target={link.newTab ? '_blank' : undefined}
              rel={link.newTab ? 'noopener' : undefined}
              style={{
                padding: '0.375rem 0.75rem',
                fontSize: '0.875rem',
                color: link.accent ? 'var(--accent)' : 'var(--fg-muted)',
                fontWeight: link.accent ? 700 : undefined,
                borderRadius: 'var(--radius)',
                textDecoration: 'none',
                transition: 'color 0.15s, background 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = link.accent ? 'var(--accent)' : 'var(--fg)'
                e.currentTarget.style.background = 'var(--bg-secondary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--fg-muted)'
                e.currentTarget.style.background = 'transparent'
              }}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Search */}
        <div className="nav-search" style={{ flex: 1, maxWidth: '20rem' }}>
          <input
            type="text"
            placeholder="Search assets..."
            className="input"
            style={{ height: '2rem', fontSize: '0.8125rem' }}
          />
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UserMenu />
        </div>

        {/* Mobile hamburger */}
        <button
          className="nav-hamburger"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          style={{
            display: 'none',
            background: 'none',
            border: 'none',
            color: 'var(--fg)',
            fontSize: '1.5rem',
            cursor: 'pointer',
            padding: '0.25rem',
          }}
        >
          {mobileOpen ? '\u2715' : '\u2630'}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="nav-mobile-menu"
          style={{
            borderTop: '1px solid var(--border)',
            padding: '0.5rem 1rem 1rem',
            background: 'var(--bg)',
          }}
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target={link.newTab ? '_blank' : undefined}
              rel={link.newTab ? 'noopener' : undefined}
              style={{
                display: 'block',
                padding: '0.5rem 0',
                color: 'var(--fg-muted)',
                fontSize: '0.875rem',
                textDecoration: 'none',
              }}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
            <input type="text" placeholder="Search..." className="input" style={{ height: '2rem', fontSize: '0.8125rem' }} />
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .nav-desktop { display: none !important; }
          .nav-search { display: none !important; }
          .nav-hamburger { display: block !important; }
        }
      `}</style>
    </nav>
  )
}
