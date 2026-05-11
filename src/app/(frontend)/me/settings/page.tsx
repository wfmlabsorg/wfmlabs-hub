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
    linkedinUrl?: string
    githubUsername?: string
    websiteUrl?: string
  }
}

const sidebarItems = [
  { key: 'profile', label: 'Profile' },
  { key: 'account', label: 'Account', disabled: true },
  { key: 'notifications', label: 'Notifications', disabled: true },
]

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [member, setMember] = useState<MemberData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [activeTab, setActiveTab] = useState('profile')

  // Form state
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [githubUsername, setGithubUsername] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/me/settings')
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
          setLinkedinUrl(data.profile?.linkedinUrl || '')
          setGithubUsername(data.profile?.githubUsername || '')
          setWebsiteUrl(data.profile?.websiteUrl || '')
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
    } else {
      setUsernameError('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (usernameError) return
    setSaving(true)
    setError('')
    setSaved(false)

    try {
      const res = await fetch('/api/members/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          username,
          title,
          company,
          bio,
          location,
          linkedinUrl,
          githubUsername,
          websiteUrl,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        setSaving(false)
        return
      }

      setSaved(true)
      setSaving(false)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Network error. Please try again.')
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div style={{ maxWidth: '56rem', margin: '3rem auto', padding: '0 1rem' }}>
        <div style={{ color: 'var(--fg-muted)', fontSize: '0.875rem' }}>Loading...</div>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.625rem 0.75rem',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--fg)',
    fontSize: '0.9375rem',
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: 600,
    marginBottom: '0.375rem',
    color: 'var(--fg)',
  }

  return (
    <div style={{ maxWidth: '56rem', margin: '2rem auto', padding: '0 1rem 3rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Settings</h1>
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.875rem' }}>
          Manage your profile and account preferences
        </p>
      </div>

      <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
        {/* Sidebar */}
        <nav
          style={{
            width: '12rem',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.125rem',
          }}
        >
          {sidebarItems.map((item) => (
            <button
              key={item.key}
              onClick={() => !item.disabled && setActiveTab(item.key)}
              disabled={item.disabled}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                background: activeTab === item.key ? 'var(--bg-secondary)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius)',
                fontSize: '0.875rem',
                fontWeight: activeTab === item.key ? 600 : 400,
                color: item.disabled ? 'var(--fg-faint)' : 'var(--fg)',
                cursor: item.disabled ? 'default' : 'pointer',
                textAlign: 'left',
                width: '100%',
              }}
            >
              {item.label}
              {item.disabled && (
                <span
                  style={{
                    fontSize: '0.625rem',
                    background: 'var(--bg-secondary)',
                    padding: '0.125rem 0.375rem',
                    borderRadius: '0.25rem',
                    color: 'var(--fg-faint)',
                    marginLeft: 'auto',
                  }}
                >
                  Soon
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
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

            {saved && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  marginBottom: '1.5rem',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--success)',
                  fontSize: '0.8125rem',
                }}
              >
                Profile updated successfully.
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Email (read-only) */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  value={member?.email || session?.user?.email || ''}
                  disabled
                  style={{
                    ...inputStyle,
                    opacity: 0.6,
                    cursor: 'not-allowed',
                  }}
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', marginTop: '0.25rem' }}>
                  Managed by your OAuth provider
                </div>
              </div>

              {/* Display Name */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>

              {/* Username */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Username</label>
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
                      ...inputStyle,
                      paddingLeft: '1.75rem',
                      borderColor: usernameError ? 'var(--error)' : 'var(--border)',
                    }}
                  />
                </div>
                {usernameError && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem' }}>
                    {usernameError}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px solid var(--border)', margin: '1.5rem 0' }}>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--fg-faint)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginTop: '1rem',
                  }}
                >
                  Professional Info
                </span>
              </div>

              {/* Title */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Professional Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., WFM Manager, Operations Director"
                  style={inputStyle}
                />
              </div>

              {/* Company */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Company</label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Where you work"
                  style={inputStyle}
                />
              </div>

              {/* Bio */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell the community about your WFM experience..."
                  rows={4}
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Location */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Chicago, IL"
                  style={inputStyle}
                />
              </div>

              {/* Divider */}
              <div style={{ borderTop: '1px solid var(--border)', margin: '1.5rem 0' }}>
                <span
                  style={{
                    display: 'inline-block',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--fg-faint)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginTop: '1rem',
                  }}
                >
                  Links
                </span>
              </div>

              {/* LinkedIn */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>LinkedIn URL</label>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/yourname"
                  style={inputStyle}
                />
              </div>

              {/* GitHub */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={labelStyle}>GitHub Username</label>
                <input
                  type="text"
                  value={githubUsername}
                  onChange={(e) => setGithubUsername(e.target.value)}
                  placeholder="your-github-handle"
                  style={inputStyle}
                />
              </div>

              {/* Website */}
              <div style={{ marginBottom: '2rem' }}>
                <label style={labelStyle}>Personal Website</label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://yourwebsite.com"
                  style={inputStyle}
                />
              </div>

              <button
                type="submit"
                disabled={saving || !!usernameError || !displayName || !username}
                style={{
                  padding: '0.625rem 1.5rem',
                  background: saving || usernameError || !displayName || !username ? 'var(--border)' : 'var(--accent)',
                  color: saving || usernameError || !displayName || !username ? 'var(--fg-muted)' : 'var(--accent-text)',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: saving || usernameError || !displayName || !username ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
