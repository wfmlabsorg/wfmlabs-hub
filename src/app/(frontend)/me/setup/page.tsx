'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface MemberData {
  id: number
  displayName: string
  username: string
  email: string
  bio?: string
  profile?: {
    title?: string
    company?: string
    location?: string
  }
}

export default function SetupPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [member, setMember] = useState<MemberData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [usernameError, setUsernameError] = useState('')

  // Form state
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/me/setup')
      return
    }
    if (status === 'authenticated' && session?.user?.payloadMemberId) {
      fetch(`/api/members/${session.user.payloadMemberId}`)
        .then((r) => r.json())
        .then((data) => {
          setMember(data)
          setDisplayName(data.displayName || '')
          setUsername(data.username || '')
          setTitle(data.profile?.title || '')
          setCompany(data.profile?.company || '')
          setBio(data.bio || '')
          setLocation(data.profile?.location || '')
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
  }, [status, session, router])

  function validateUsername(value: string) {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setUsername(cleaned)
    if (cleaned.length < 3) {
      setUsernameError('At least 3 characters')
    } else if (cleaned.length > 30) {
      setUsernameError('Max 30 characters')
    } else if (!/^[a-z0-9-]+$/.test(cleaned)) {
      setUsernameError('Lowercase letters, numbers, hyphens only')
    } else {
      setUsernameError('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (usernameError) return
    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/members/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, username, title, company, bio, location }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        setSaving(false)
        return
      }

      router.push('/')
    } catch {
      setError('Network error. Please try again.')
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div style={{ maxWidth: '32rem', margin: '4rem auto', padding: '2rem', textAlign: 'center' }}>
        <div style={{ color: 'var(--fg-muted)', fontSize: '0.875rem' }}>Loading...</div>
      </div>
    )
  }

  const avatarInitial = (session?.user?.name || session?.user?.email || '?').charAt(0).toUpperCase()

  return (
    <div style={{ maxWidth: '36rem', margin: '3rem auto', padding: '0 1rem 3rem' }}>
      {/* Welcome header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '3.5rem',
            height: '3.5rem',
            background: 'var(--accent)',
            color: 'var(--accent-text)',
            borderRadius: '50%',
            fontSize: '1.5rem',
            fontWeight: 800,
            marginBottom: '1rem',
          }}
        >
          {session?.user?.image ? (
            <img
              src={session.user.image}
              alt=""
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            avatarInitial
          )}
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Welcome to WFM Labs Hub
        </h1>
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.9375rem', lineHeight: 1.5 }}>
          Let&apos;s set up your profile. This helps the community get to know you.
        </p>
      </div>

      {/* Progress indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '2rem',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            height: '4px',
            flex: 1,
            maxWidth: '6rem',
            background: 'var(--accent)',
            borderRadius: '2px',
          }}
        />
        <div
          style={{
            height: '4px',
            flex: 1,
            maxWidth: '6rem',
            background: displayName && username ? 'var(--accent)' : 'var(--border)',
            borderRadius: '2px',
            transition: 'background 0.3s',
          }}
        />
        <div
          style={{
            height: '4px',
            flex: 1,
            maxWidth: '6rem',
            background: title || bio ? 'var(--accent)' : 'var(--border)',
            borderRadius: '2px',
            transition: 'background 0.3s',
          }}
        />
      </div>

      {/* Form card */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '2rem',
        }}
      >
        {error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              marginBottom: '1.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius)',
              color: '#ef4444',
              fontSize: '0.8125rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Identity section */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem', color: 'var(--fg)' }}>
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--fg)',
                fontSize: '0.9375rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem', color: 'var(--fg)' }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--fg-faint)',
                  fontSize: '0.9375rem',
                  pointerEvents: 'none',
                }}
              >
                @
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => validateUsername(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem 0.625rem 1.75rem',
                  background: 'var(--bg)',
                  border: `1px solid ${usernameError ? 'var(--error)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  color: 'var(--fg)',
                  fontSize: '0.9375rem',
                  outline: 'none',
                }}
              />
            </div>
            {usernameError && (
              <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem' }}>
                {usernameError}
              </div>
            )}
            {!usernameError && username.length >= 3 && (
              <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '0.25rem' }}>
                community.wfmlabs.com/member/{username}
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border)', margin: '1.5rem 0', position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                top: '-0.625rem',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--bg-card)',
                padding: '0 0.75rem',
                fontSize: '0.75rem',
                color: 'var(--fg-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Professional
            </span>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem', color: 'var(--fg)' }}>
              Professional Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., WFM Manager, Operations Director"
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--fg)',
                fontSize: '0.9375rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem', color: 'var(--fg)' }}>
              Company
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Where you work"
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--fg)',
                fontSize: '0.9375rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem', color: 'var(--fg)' }}>
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell the community about your WFM experience..."
              rows={3}
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--fg)',
                fontSize: '0.9375rem',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem', color: 'var(--fg)' }}>
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Chicago, IL"
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem',
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--fg)',
                fontSize: '0.9375rem',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={saving || !!usernameError || !displayName || !username}
            style={{
              width: '100%',
              padding: '0.75rem 1.5rem',
              background: saving || usernameError || !displayName || !username ? 'var(--border)' : 'var(--accent)',
              color: saving || usernameError || !displayName || !username ? 'var(--fg-muted)' : 'var(--accent-text)',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: saving || usernameError || !displayName || !username ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s, transform 0.1s',
            }}
          >
            {saving ? 'Setting up...' : 'Complete Setup'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <a
              href="/"
              style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)', textDecoration: 'none' }}
            >
              Skip for now
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
