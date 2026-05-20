'use client'

import React, { useState } from 'react'
import { usePathname } from 'next/navigation'
import { UserMenu } from './UserMenu'

const navLinks = [
  { href: '/roc', label: 'ROC' },
  { href: '/incidents', label: 'Incidents' },
  { href: '/briefs', label: 'Briefs' },
  { href: '/signals', label: 'Signals' },
  { href: '/tools', label: 'Tools' },
  { href: '/research', label: 'Research' },
  { href: '/chat', label: 'Chat' },
  { href: '/data-sources', label: 'APIs' },
  { href: '/members', label: 'Members' },
  { href: '/discussions', label: 'Discussions' },
  { href: '/wiki', label: 'Docs' },
  { href: '/pricing', label: 'Pricing' },
  // Suspended: { href: '/debates', label: 'Debates' }
  // Suspended: { href: '/articles', label: 'Articles' }
]

export function GlobalNav() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(20px)',
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
            width: '2rem',
            height: '2rem',
            background: 'transparent',
            color: 'var(--accent)',
            border: '2px solid var(--accent)',
            borderRadius: '6px',
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
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
            return (
              <a
                key={link.href}
                href={link.href}
                target={link.href === '/roc' ? '_blank' : undefined}
                rel={link.href === '/roc' ? 'noopener' : undefined}
                style={{
                  padding: '0.375rem 0.75rem',
                  fontSize: '0.875rem',
                  color: isActive ? 'var(--accent)' : 'var(--fg-muted)',
                  fontWeight: isActive ? 700 : undefined,
                  borderRadius: 'var(--radius)',
                  textDecoration: 'none',
                  transition: 'color 0.15s, background 0.15s',
                  background: isActive ? 'var(--bg-secondary)' : 'transparent',
                  borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--fg)'
                    e.currentTarget.style.background = 'var(--bg-secondary)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--fg-muted)'
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                {link.label}
              </a>
            )
          })}
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
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
            return (
              <a
                key={link.href}
                href={link.href}
                target={link.href === '/roc' ? '_blank' : undefined}
                rel={link.href === '/roc' ? 'noopener' : undefined}
                style={{
                  display: 'block',
                  padding: '0.5rem 0',
                  color: isActive ? 'var(--accent)' : 'var(--fg-muted)',
                  fontWeight: isActive ? 700 : undefined,
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                }}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            )
          })}
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
