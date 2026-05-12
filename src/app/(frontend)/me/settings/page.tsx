'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  INDUSTRIES,
  WORKFORCE_TYPES,
  SOURCING_TYPES,
  FOOTPRINT_WORKFORCE_TYPES,
  FOOTPRINT_COUNTRIES,
  CUSTOMER_GEO_SCOPES,
  US_REGIONS,
  US_STATES,
} from '@/lib/constants/taxonomies'

interface Topic {
  id: number
  name: string
  slug: string
}

interface FootprintRow {
  city: string
  stateProvince: string
  country: string
  headcount: number | ''
  sourcing: string
  workforceType: string
  otherWorkforceType: string
}

interface MemberData {
  id: number
  displayName: string
  username: string
  email: string
  bio?: string
  industry?: string
  workforceTypes?: string[]
  expertise?: number[] | { id: number }[]
  visibility?: {
    showProfessional?: boolean
    showIndustry?: boolean
    showBio?: boolean
    showLinks?: boolean
    showInDirectory?: boolean
    showEmail?: boolean
    showOvixData?: boolean
  }
  profile?: {
    title?: string
    company?: string
    location?: string
    linkedinUrl?: string
    githubUsername?: string
    websiteUrl?: string
  }
  ovixProfile?: {
    isOvixContributor?: boolean
    isBpo?: boolean
    clientIndustries?: string[]
    workforceFootprint?: FootprintRow[]
    customerGeography?: {
      scope?: string
      usRegions?: string[]
      usState?: string
      euCountries?: string
      internationalRegions?: string
    }
  }
}

const emptyFootprintRow: FootprintRow = {
  city: '',
  stateProvince: '',
  country: 'US',
  headcount: '',
  sourcing: '',
  workforceType: '',
  otherWorkforceType: '',
}

const sidebarItems = [
  { key: 'profile', label: 'Profile' },
  { key: 'expertise', label: 'Expertise' },
  { key: 'ovix', label: 'ROC Contributor' },
  { key: 'privacy', label: 'Privacy' },
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

  // Profile fields
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [githubUsername, setGithubUsername] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [industry, setIndustry] = useState('')
  const [workforceTypes, setWorkforceTypes] = useState<string[]>([])

  // Expertise
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedExpertise, setSelectedExpertise] = useState<number[]>([])

  // OVIX Contributor
  const [isOvixContributor, setIsOvixContributor] = useState(false)
  const [isBpo, setIsBpo] = useState(false)
  const [clientIndustries, setClientIndustries] = useState<string[]>([])
  const [footprint, setFootprint] = useState<FootprintRow[]>([{ ...emptyFootprintRow }])
  const [geoScope, setGeoScope] = useState('')
  const [usRegions, setUsRegions] = useState<string[]>([])
  const [usState, setUsState] = useState('')
  const [euCountries, setEuCountries] = useState('')
  const [internationalRegions, setInternationalRegions] = useState('')

  // Visibility
  const [showProfessional, setShowProfessional] = useState(true)
  const [showIndustry, setShowIndustry] = useState(true)
  const [showBio, setShowBio] = useState(true)
  const [showLinks, setShowLinks] = useState(true)
  const [showInDirectory, setShowInDirectory] = useState(true)
  const [showEmail, setShowEmail] = useState(false)
  const [showOvixData, setShowOvixData] = useState(false)

  useEffect(() => {
    fetch('/api/topics?limit=100')
      .then((r) => r.json())
      .then((data) => setTopics(data.docs || []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/me/settings')
      return
    }
    if (status === 'authenticated' && session?.user?.payloadMemberId) {
      fetch(`/api/members/${session.user.payloadMemberId}?depth=1`)
        .then((r) => r.json())
        .then((data: MemberData) => {
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
          setIndustry(data.industry || '')
          setWorkforceTypes(data.workforceTypes || [])

          // Expertise
          if (data.expertise) {
            const ids = data.expertise.map((e: number | { id: number }) =>
              typeof e === 'object' ? e.id : e,
            )
            setSelectedExpertise(ids)
          }

          // OVIX profile
          if (data.ovixProfile) {
            setIsOvixContributor(data.ovixProfile.isOvixContributor || false)
            setIsBpo(data.ovixProfile.isBpo || false)
            setClientIndustries(data.ovixProfile.clientIndustries || [])
            if (data.ovixProfile.workforceFootprint?.length) {
              setFootprint(data.ovixProfile.workforceFootprint)
            }
            if (data.ovixProfile.customerGeography) {
              setGeoScope(data.ovixProfile.customerGeography.scope || '')
              setUsRegions(data.ovixProfile.customerGeography.usRegions || [])
              setUsState(data.ovixProfile.customerGeography.usState || '')
              setEuCountries(data.ovixProfile.customerGeography.euCountries || '')
              setInternationalRegions(data.ovixProfile.customerGeography.internationalRegions || '')
            }
          }

          // Visibility
          if (data.visibility) {
            setShowProfessional(data.visibility.showProfessional !== false)
            setShowIndustry(data.visibility.showIndustry !== false)
            setShowBio(data.visibility.showBio !== false)
            setShowLinks(data.visibility.showLinks !== false)
            setShowInDirectory(data.visibility.showInDirectory !== false)
            setShowEmail(data.visibility.showEmail === true)
            setShowOvixData(data.visibility.showOvixData === true)
          }

          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
  }, [status, session, router])

  function validateUsername(value: string) {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
    setUsername(cleaned)
    if (cleaned.length < 3) setUsernameError('At least 3 characters')
    else if (cleaned.length > 30) setUsernameError('Max 30 characters')
    else setUsernameError('')
  }

  function toggleExpertise(topicId: number) {
    setSelectedExpertise((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId],
    )
  }

  function toggleWorkforceType(value: string) {
    setWorkforceTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    )
  }

  function toggleClientIndustry(value: string) {
    setClientIndustries((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    )
  }

  function toggleUsRegion(value: string) {
    setUsRegions((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    )
  }

  function updateFootprintRow(index: number, field: keyof FootprintRow, value: string | number) {
    setFootprint((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    )
  }

  function addFootprintRow() {
    setFootprint((prev) => [...prev, { ...emptyFootprintRow }])
  }

  function removeFootprintRow(index: number) {
    setFootprint((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (usernameError) return
    setSaving(true)
    setError('')
    setSaved(false)

    try {
      const body: Record<string, unknown> = {
        displayName,
        username,
        title,
        company,
        bio,
        location,
        linkedinUrl,
        githubUsername,
        websiteUrl,
        industry: industry || undefined,
        workforceTypes,
        expertise: selectedExpertise,
        visibility: {
          showProfessional,
          showIndustry,
          showBio,
          showLinks,
          showInDirectory,
          showEmail,
          showOvixData,
        },
        ovixProfile: {
          isOvixContributor,
          isBpo,
          clientIndustries: isBpo ? clientIndustries : [],
          workforceFootprint: isOvixContributor ? footprint.filter((r) => r.country) : [],
          customerGeography: isOvixContributor
            ? {
                scope: geoScope || undefined,
                usRegions: geoScope === 'regional-us' ? usRegions : undefined,
                usState: geoScope === 'single-state' ? usState : undefined,
                euCountries: geoScope === 'eu' ? euCountries : undefined,
                internationalRegions: geoScope === 'international' ? internationalRegions : undefined,
              }
            : {},
        },
      }

      const res = await fetch('/api/members/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: 600,
    marginBottom: '0.375rem',
    color: 'var(--fg)',
  }
  const checkboxRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    padding: '0.75rem 0',
    borderBottom: '1px solid var(--border)',
  }
  const fieldGap = '1.5rem'

  function PillSelect({
    options,
    selected,
    onToggle,
  }: {
    options: readonly { label: string; value: string }[]
    selected: string[]
    onToggle: (value: string) => void
  }) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {options.map((opt) => {
          const isSelected = selected.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              className="topic-pill"
              style={{
                cursor: 'pointer',
                background: isSelected ? 'var(--accent-light)' : 'var(--bg-secondary)',
                color: isSelected ? 'var(--accent)' : 'var(--fg-muted)',
                borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                fontWeight: isSelected ? 600 : 400,
                padding: '0.375rem 0.75rem',
                fontSize: '0.8125rem',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '56rem', margin: '2rem auto', padding: '0 1rem 3rem' }}>
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

          {/* Admin Panel link — only visible to admins */}
          {session?.user?.role === 'admin' && (
            <>
              <div
                style={{
                  borderTop: '1px solid var(--border)',
                  margin: '0.5rem 0',
                }}
              />
              <a
                href="/api/admin/auth"
                target="_blank"
                rel="noopener"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.875rem',
                  fontWeight: 400,
                  color: 'var(--accent)',
                  textDecoration: 'none',
                  width: '100%',
                }}
              >
                Admin Panel
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.6 }}>&#8599;</span>
              </a>
            </>
          )}
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
              {/* ── Profile Tab ── */}
              {activeTab === 'profile' && (
                <>
                  <div style={{ marginBottom: fieldGap }}>
                    <label style={labelStyle}>Email</label>
                    <input
                      type="email"
                      value={member?.email || session?.user?.email || ''}
                      disabled
                      style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }}
                    />
                    <div style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', marginTop: '0.25rem' }}>
                      Managed by your OAuth provider
                    </div>
                  </div>

                  <div style={{ marginBottom: fieldGap }}>
                    <label style={labelStyle}>Display Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      required
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ marginBottom: fieldGap }}>
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

                  <div style={{ marginBottom: fieldGap }}>
                    <label style={labelStyle}>Professional Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., WFM Manager, Operations Director"
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ marginBottom: fieldGap }}>
                    <label style={labelStyle}>Industry</label>
                    <select value={industry} onChange={(e) => setIndustry(e.target.value)} style={selectStyle}>
                      <option value="">Select your industry</option>
                      {INDUSTRIES.map((ind) => (
                        <option key={ind.value} value={ind.value}>{ind.label}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: fieldGap }}>
                    <label style={labelStyle}>Workforce Types</label>
                    <PillSelect options={WORKFORCE_TYPES} selected={workforceTypes} onToggle={toggleWorkforceType} />
                  </div>

                  <div style={{ marginBottom: fieldGap }}>
                    <label style={labelStyle}>Bio</label>
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Tell the community about your WFM experience..."
                      rows={4}
                      style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                    />
                  </div>

                  <div style={{ marginBottom: fieldGap }}>
                    <label style={labelStyle}>Location</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g., Chicago, IL"
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ marginBottom: fieldGap }}>
                    <label style={{ ...labelStyle, color: 'var(--fg-faint)' }}>
                      Company <span style={{ fontWeight: 400 }}>(optional, not displayed publicly)</span>
                    </label>
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Where you work"
                      style={inputStyle}
                    />
                  </div>

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

                  <div style={{ marginBottom: fieldGap }}>
                    <label style={labelStyle}>LinkedIn URL</label>
                    <input
                      type="url"
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="https://linkedin.com/in/yourname"
                      style={inputStyle}
                    />
                  </div>

                  <div style={{ marginBottom: fieldGap }}>
                    <label style={labelStyle}>GitHub Username</label>
                    <input
                      type="text"
                      value={githubUsername}
                      onChange={(e) => setGithubUsername(e.target.value)}
                      placeholder="your-github-handle"
                      style={inputStyle}
                    />
                  </div>

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
                </>
              )}

              {/* ── Expertise Tab ── */}
              {activeTab === 'expertise' && (
                <>
                  <div style={{ marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Expertise
                    </h2>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
                      Select topics you&apos;re experienced in. These appear on your profile and help
                      others find you in the directory.
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '2rem' }}>
                    {topics.map((topic) => {
                      const isSelected = selectedExpertise.includes(topic.id)
                      return (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => toggleExpertise(topic.id)}
                          className="topic-pill"
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? 'var(--accent-light)' : 'var(--bg-secondary)',
                            color: isSelected ? 'var(--accent)' : 'var(--fg-muted)',
                            borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                            fontWeight: isSelected ? 600 : 400,
                            padding: '0.375rem 0.75rem',
                            fontSize: '0.8125rem',
                          }}
                        >
                          {topic.name}
                        </button>
                      )
                    })}
                    {topics.length === 0 && (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)', padding: '1rem' }}>
                        No topics available yet.
                      </div>
                    )}
                  </div>

                  {selectedExpertise.length > 0 && (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', marginBottom: '1.5rem' }}>
                      {selectedExpertise.length} topic{selectedExpertise.length !== 1 ? 's' : ''} selected
                    </div>
                  )}
                </>
              )}

              {/* ── OVIX Contributor Tab ── */}
              {activeTab === 'ovix' && (
                <>
                  <div
                    style={{
                      padding: '1.25rem',
                      marginBottom: '1.5rem',
                      background: 'rgba(24, 188, 156, 0.08)',
                      border: '1px solid rgba(24, 188, 156, 0.25)',
                      borderRadius: 'var(--radius-lg)',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.5rem', color: 'var(--fg)' }}>
                      ROC Contributor Network
                    </div>
                    <p style={{ fontSize: '0.8125rem', lineHeight: 1.6, margin: 0, color: 'var(--fg-muted)' }}>
                      Share your workforce footprint and customer geography so ROC agents can alert you
                      when incidents — power outages, network disruptions, severe weather — affect your
                      operations. Contributors get personalized incident notifications matched to their locations.
                    </p>
                  </div>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                      padding: '1rem',
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius)',
                      cursor: 'pointer',
                      marginBottom: '1.5rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isOvixContributor}
                      onChange={(e) => setIsOvixContributor(e.target.checked)}
                      style={{ marginTop: '0.15rem', accentColor: 'var(--accent)' }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                        I&apos;d like to participate as an ROC contributor
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginTop: '0.25rem' }}>
                        Your data is only used for incident correlation. Control visibility in the Privacy tab.
                      </div>
                    </div>
                  </label>

                  {isOvixContributor && (
                    <>
                      {/* BPO flag */}
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.75rem',
                          padding: '0.75rem 1rem',
                          cursor: 'pointer',
                          marginBottom: fieldGap,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isBpo}
                          onChange={(e) => setIsBpo(e.target.checked)}
                          style={{ marginTop: '0.15rem', accentColor: 'var(--accent)' }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                            I am a BPO / outsourcer serving multiple clients
                          </div>
                        </div>
                      </label>

                      {isBpo && (
                        <div style={{ marginBottom: fieldGap }}>
                          <label style={labelStyle}>Client Industries</label>
                          <PillSelect
                            options={INDUSTRIES.filter((i) => i.value !== 'other')}
                            selected={clientIndustries}
                            onToggle={toggleClientIndustry}
                          />
                        </div>
                      )}

                      {/* Workforce Footprint */}
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
                          Workforce Footprint
                        </span>
                      </div>

                      <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.5, margin: '0 0 1rem' }}>
                        Where is your workforce located?
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                        {footprint.map((row, i) => (
                          <div
                            key={i}
                            style={{
                              padding: '0.75rem',
                              background: 'var(--bg-secondary)',
                              borderRadius: 'var(--radius)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <div>
                                <label style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', display: 'block', marginBottom: '0.125rem' }}>Country</label>
                                <select value={row.country} onChange={(e) => updateFootprintRow(i, 'country', e.target.value)} style={{ ...selectStyle, padding: '0.4375rem 0.5rem', fontSize: '0.8125rem' }}>
                                  {FOOTPRINT_COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                                </select>
                              </div>
                              <div>
                                <label style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', display: 'block', marginBottom: '0.125rem' }}>{row.country === 'US' ? 'State' : 'State / Province'}</label>
                                {row.country === 'US' ? (
                                  <select value={row.stateProvince} onChange={(e) => updateFootprintRow(i, 'stateProvince', e.target.value)} style={{ ...selectStyle, padding: '0.4375rem 0.5rem', fontSize: '0.8125rem' }}>
                                    <option value="">Select</option>
                                    {US_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                  </select>
                                ) : (
                                  <input type="text" placeholder="Province / Region" value={row.stateProvince} onChange={(e) => updateFootprintRow(i, 'stateProvince', e.target.value)} style={{ ...inputStyle, padding: '0.4375rem 0.5rem', fontSize: '0.8125rem' }} />
                                )}
                              </div>
                              <div>
                                <label style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', display: 'block', marginBottom: '0.125rem' }}>City</label>
                                <input type="text" placeholder="City" value={row.city} onChange={(e) => updateFootprintRow(i, 'city', e.target.value)} style={{ ...inputStyle, padding: '0.4375rem 0.5rem', fontSize: '0.8125rem' }} />
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '5rem 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
                              <div>
                                <label style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', display: 'block', marginBottom: '0.125rem' }}>Headcount</label>
                                <input type="number" placeholder="HC" min={1} value={row.headcount} onChange={(e) => updateFootprintRow(i, 'headcount', e.target.value ? Number(e.target.value) : '')} style={{ ...inputStyle, padding: '0.4375rem 0.5rem', fontSize: '0.8125rem' }} />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', display: 'block', marginBottom: '0.125rem' }}>Sourcing</label>
                                <select value={row.sourcing} onChange={(e) => updateFootprintRow(i, 'sourcing', e.target.value)} style={{ ...selectStyle, padding: '0.4375rem 0.5rem', fontSize: '0.8125rem' }}>
                                  <option value="">Select</option>
                                  {SOURCING_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                              </div>
                              <div>
                                <label style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', display: 'block', marginBottom: '0.125rem' }}>Workforce Type</label>
                                <select value={row.workforceType} onChange={(e) => updateFootprintRow(i, 'workforceType', e.target.value)} style={{ ...selectStyle, padding: '0.4375rem 0.5rem', fontSize: '0.8125rem' }}>
                                  <option value="">Select</option>
                                  {FOOTPRINT_WORKFORCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                              </div>
                              {footprint.length > 1 && (
                                <button type="button" onClick={() => removeFootprintRow(i)} style={{ background: 'none', border: 'none', color: 'var(--fg-faint)', cursor: 'pointer', fontSize: '1.125rem', padding: '0.25rem 0.5rem', marginBottom: '0.125rem' }} title="Remove">&times;</button>
                              )}
                            </div>
                            {row.workforceType === 'other' && (
                              <div style={{ marginTop: '0.5rem' }}>
                                <label style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', display: 'block', marginBottom: '0.125rem' }}>Describe workforce type</label>
                                <input type="text" placeholder="e.g., Underwriting, Compliance Review, Data Entry" value={row.otherWorkforceType} onChange={(e) => updateFootprintRow(i, 'otherWorkforceType', e.target.value)} style={{ ...inputStyle, padding: '0.4375rem 0.5rem', fontSize: '0.8125rem' }} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={addFootprintRow}
                        style={{
                          background: 'none',
                          border: '1px dashed var(--border)',
                          borderRadius: 'var(--radius)',
                          padding: '0.5rem 1rem',
                          color: 'var(--fg-muted)',
                          fontSize: '0.8125rem',
                          cursor: 'pointer',
                          width: '100%',
                          marginBottom: fieldGap,
                        }}
                      >
                        + Add location
                      </button>

                      {/* Customer Geography */}
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
                          Customer Geography
                        </span>
                      </div>

                      <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.5, margin: '0 0 1rem' }}>
                        Where are your customers or clients located?
                      </p>

                      <div style={{ marginBottom: fieldGap }}>
                        <label style={labelStyle}>Geographic Scope</label>
                        <select value={geoScope} onChange={(e) => setGeoScope(e.target.value)} style={selectStyle}>
                          <option value="">Select scope</option>
                          {CUSTOMER_GEO_SCOPES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                        </select>
                      </div>

                      {geoScope === 'regional-us' && (
                        <div style={{ marginBottom: fieldGap }}>
                          <label style={labelStyle}>US Regions</label>
                          <PillSelect options={US_REGIONS} selected={usRegions} onToggle={toggleUsRegion} />
                        </div>
                      )}

                      {geoScope === 'single-state' && (
                        <div style={{ marginBottom: fieldGap }}>
                          <label style={labelStyle}>State</label>
                          <select value={usState} onChange={(e) => setUsState(e.target.value)} style={selectStyle}>
                            <option value="">Select state</option>
                            {US_STATES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </div>
                      )}

                      {geoScope === 'eu' && (
                        <div style={{ marginBottom: fieldGap }}>
                          <label style={labelStyle}>EU Countries</label>
                          <input
                            type="text"
                            value={euCountries}
                            onChange={(e) => setEuCountries(e.target.value)}
                            placeholder="e.g., DE, FR, ES, NL"
                            style={inputStyle}
                          />
                        </div>
                      )}

                      {geoScope === 'international' && (
                        <div style={{ marginBottom: fieldGap }}>
                          <label style={labelStyle}>International Regions</label>
                          <input
                            type="text"
                            value={internationalRegions}
                            onChange={(e) => setInternationalRegions(e.target.value)}
                            placeholder="e.g., UK, Philippines, Costa Rica"
                            style={inputStyle}
                          />
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* ── Privacy Tab ── */}
              {activeTab === 'privacy' && (
                <>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.25rem' }}>Privacy</h2>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
                      Control what other members can see on your profile.
                    </p>
                  </div>

                  <div style={checkboxRowStyle}>
                    <input type="checkbox" id="showProfessional" checked={showProfessional} onChange={(e) => setShowProfessional(e.target.checked)} style={{ marginTop: '0.125rem' }} />
                    <label htmlFor="showProfessional" style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>Show professional info</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Title and location</div>
                    </label>
                  </div>

                  <div style={checkboxRowStyle}>
                    <input type="checkbox" id="showIndustry" checked={showIndustry} onChange={(e) => setShowIndustry(e.target.checked)} style={{ marginTop: '0.125rem' }} />
                    <label htmlFor="showIndustry" style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>Show industry and workforce types</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Your industry badge and workforce type pills on your profile</div>
                    </label>
                  </div>

                  <div style={checkboxRowStyle}>
                    <input type="checkbox" id="showBio" checked={showBio} onChange={(e) => setShowBio(e.target.checked)} style={{ marginTop: '0.125rem' }} />
                    <label htmlFor="showBio" style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>Show bio</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Your bio text on your profile page</div>
                    </label>
                  </div>

                  <div style={checkboxRowStyle}>
                    <input type="checkbox" id="showLinks" checked={showLinks} onChange={(e) => setShowLinks(e.target.checked)} style={{ marginTop: '0.125rem' }} />
                    <label htmlFor="showLinks" style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>Show links</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>LinkedIn, GitHub, and website URLs</div>
                    </label>
                  </div>

                  <div style={checkboxRowStyle}>
                    <input type="checkbox" id="showInDirectory" checked={showInDirectory} onChange={(e) => setShowInDirectory(e.target.checked)} style={{ marginTop: '0.125rem' }} />
                    <label htmlFor="showInDirectory" style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>Appear in member directory</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Show your card in the public member listing</div>
                    </label>
                  </div>

                  <div style={checkboxRowStyle}>
                    <input type="checkbox" id="showEmail" checked={showEmail} onChange={(e) => setShowEmail(e.target.checked)} style={{ marginTop: '0.125rem' }} />
                    <label htmlFor="showEmail" style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>Show email to members</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Let other logged-in members see your email address</div>
                    </label>
                  </div>

                  <div style={{ ...checkboxRowStyle, borderBottom: 'none' }}>
                    <input type="checkbox" id="showOvixData" checked={showOvixData} onChange={(e) => setShowOvixData(e.target.checked)} style={{ marginTop: '0.125rem' }} />
                    <label htmlFor="showOvixData" style={{ cursor: 'pointer' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>Show ROC contributor data</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)' }}>Display your workforce footprint and customer geography to other members</div>
                    </label>
                  </div>

                  <div style={{ height: '1.5rem' }} />
                </>
              )}

              <button
                type="submit"
                disabled={saving || !!usernameError || !displayName || !username}
                style={{
                  padding: '0.625rem 1.5rem',
                  background:
                    saving || usernameError || !displayName || !username
                      ? 'var(--border)'
                      : 'var(--accent)',
                  color:
                    saving || usernameError || !displayName || !username
                      ? 'var(--fg-muted)'
                      : 'var(--accent-text)',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor:
                    saving || usernameError || !displayName || !username ? 'not-allowed' : 'pointer',
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
