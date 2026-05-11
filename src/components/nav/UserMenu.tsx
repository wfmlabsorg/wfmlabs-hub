'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'

export function UserMenu() {
  const { data: session, status } = useSession()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (status === 'loading') {
    return (
      <div
        style={{
          width: '2rem',
          height: '2rem',
          borderRadius: '50%',
          background: 'var(--bg-secondary)',
        }}
      />
    )
  }

  if (!session?.user) {
    return (
      <a
        href="/login"
        className="btn btn-primary"
        style={{ fontSize: '0.8125rem', padding: '0.25rem 0.75rem' }}
      >
        Sign In
      </a>
    )
  }

  const initials = (session.user.name || session.user.email || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0.25rem',
          borderRadius: 'var(--radius)',
        }}
      >
        <div
          style={{
            width: '2rem',
            height: '2rem',
            borderRadius: '50%',
            background: 'var(--accent)',
            color: 'var(--accent-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: 700,
          }}
        >
          {session.user.image ? (
            <img
              src={session.user.image}
              alt=""
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            initials
          )}
        </div>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '2.5rem',
            width: '12rem',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 100,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '0.75rem 1rem',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{session.user.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>{session.user.email}</div>
          </div>
          <a
            href="/admin"
            style={{
              display: 'block',
              padding: '0.5rem 1rem',
              fontSize: '0.8125rem',
              color: 'var(--fg)',
              textDecoration: 'none',
            }}
            onClick={() => setOpen(false)}
          >
            Admin Panel
          </a>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '0.5rem 1rem',
              fontSize: '0.8125rem',
              color: 'var(--fg)',
              background: 'none',
              border: 'none',
              borderTop: '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}
