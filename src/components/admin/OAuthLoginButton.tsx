'use client'

import React, { useEffect } from 'react'

/**
 * Custom Payload admin login component.
 * Renders BEFORE the default login form and hides it via CSS.
 * Auto-redirects to /api/admin/auth which handles Google/GitHub OAuth.
 */
export function OAuthLoginButton() {
  useEffect(() => {
    // Hide the default Payload login form
    const style = document.createElement('style')
    style.textContent = `
      .login__form { display: none !important; }
      .login__forgot-password { display: none !important; }
    `
    document.head.appendChild(style)

    // Check if we already have a payload-token cookie
    const hasToken = document.cookie.includes('payload-token')
    if (hasToken) return

    // Auto-redirect to OAuth bridge
    const timer = setTimeout(() => {
      window.location.href = '/api/admin/auth'
    }, 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{ textAlign: 'center', padding: '1.5rem 0 1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>
          WFM Labs Admin
        </div>
        <p style={{ color: '#999', fontSize: '0.8125rem', margin: 0 }}>
          Admin access requires Google or GitHub authentication
        </p>
      </div>
      <a
        href="/api/admin/auth"
        style={{
          display: 'inline-block',
          padding: '0.75rem 2rem',
          background: '#18BC9C',
          color: '#060610',
          fontWeight: 700,
          borderRadius: '4px',
          textDecoration: 'none',
          fontSize: '0.875rem',
          letterSpacing: '0.02em',
        }}
      >
        Sign in with Google / GitHub
      </a>
      <p style={{ marginTop: '1rem', color: '#555', fontSize: '0.6875rem' }}>
        Redirecting automatically...
      </p>
    </div>
  )
}

export default OAuthLoginButton
