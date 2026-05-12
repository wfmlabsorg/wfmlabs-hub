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

interface MemberData {
  id: number
  displayName: string
  username: string
  email: string
  bio?: string
  industry?: string
  workforceTypes?: string[]
  profile?: {
    title?: string
    company?: string
    location?: string
  }
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

const emptyFootprintRow: FootprintRow = {
  city: '',
  stateProvince: '',
  country: 'US',
  headcount: '',
  sourcing: '',
  workforceType: '',
  otherWorkforceType: '',
}

export default function SetupPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [member, setMember] = useState<MemberData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [step, setStep] = useState(1)

  // ── Step 1: Basic Profile ──
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [title, setTitle] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [industry, setIndustry] = useState('')
  const [workforceTypes, setWorkforceTypes] = useState<string[]>([])

  // Expertise
  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedExpertise, setSelectedExpertise] = useState<number[]>([])

  // ── Step 2: OVIX Contributor ──
  const [isOvixContributor, setIsOvixContributor] = useState(false)
  const [isBpo, setIsBpo] = useState(false)
  const [clientIndustries, setClientIndustries] = useState<string[]>([])
  const [footprint, setFootprint] = useState<FootprintRow[]>([{ ...emptyFootprintRow }])
  const [geoScope, setGeoScope] = useState('')
  const [usRegions, setUsRegions] = useState<string[]>([])
  const [usState, setUsState] = useState('')
  const [euCountries, setEuCountries] = useState('')
  const [internationalRegions, setInternationalRegions] = useState('')

  useEffect(() => {
    fetch('/api/topics?limit=100')
      .then((r) => r.json())
      .then((data) => setTopics(data.docs || []))
      .catch(() => {})
  }, [])

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
          setBio(data.bio || '')
          setLocation(data.profile?.location || '')
          setIndustry(data.industry || '')
          setWorkforceTypes(data.workforceTypes || [])
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

  function toggleWorkforceType(value: string) {
    setWorkforceTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    )
  }

  function toggleExpertise(topicId: number) {
    setSelectedExpertise((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId],
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

    try {
      const body: Record<string, unknown> = {
        displayName,
        username,
        title,
        bio,
        location,
        industry: industry || undefined,
        workforceTypes,
        expertise: selectedExpertise,
      }

      // Include OVIX data if on step 2
      if (step === 2 && isOvixContributor) {
        body.ovixProfile = {
          isOvixContributor: true,
          isBpo,
          clientIndustries: isBpo ? clientIndustries : [],
          workforceFootprint: footprint.filter((r) => r.country),
          customerGeography: {
            scope: geoScope || undefined,
            usRegions: geoScope === 'regional-us' ? usRegions : undefined,
            usState: geoScope === 'single-state' ? usState : undefined,
            euCountries: geoScope === 'eu' ? euCountries : undefined,
            internationalRegions: geoScope === 'international' ? internationalRegions : undefined,
          },
        }
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
  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: 'pointer',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.8125rem',
    fontWeight: 600,
    marginBottom: '0.375rem',
    color: 'var(--fg)',
  }
  const fieldGap = '1.5rem'

  const step1Valid = displayName && username && !usernameError

  // ── Render ──────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: '40rem', margin: '3rem auto', padding: '0 1rem 3rem' }}>
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
          {step === 1
            ? "Let's set up your profile. This helps the community get to know you."
            : 'Optional: contribute workforce data to the OVIX network.'}
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
            maxWidth: '8rem',
            background: 'var(--accent)',
            borderRadius: '2px',
          }}
        />
        <div
          style={{
            height: '4px',
            flex: 1,
            maxWidth: '8rem',
            background: step === 2 ? 'var(--accent)' : 'var(--border)',
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

        {/* ── STEP 1: Basic Profile ── */}
        {step === 1 && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setStep(2)
            }}
          >
            {/* Display Name */}
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

            {/* Username */}
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
              {!usernameError && username.length >= 3 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '0.25rem' }}>
                  community.wfmlabs.com/member/{username}
                </div>
              )}
            </div>

            {/* Professional Title */}
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

            {/* Industry */}
            <div style={{ marginBottom: fieldGap }}>
              <label style={labelStyle}>Industry</label>
              <select value={industry} onChange={(e) => setIndustry(e.target.value)} style={selectStyle}>
                <option value="">Select your industry</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind.value} value={ind.value}>
                    {ind.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Workforce Types */}
            <div style={{ marginBottom: fieldGap }}>
              <label style={labelStyle}>Workforce Types</label>
              <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', margin: '0 0 0.5rem' }}>
                What types of workforce do you manage or advise on?
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {WORKFORCE_TYPES.map((wt) => {
                  const selected = workforceTypes.includes(wt.value)
                  return (
                    <button
                      key={wt.value}
                      type="button"
                      onClick={() => toggleWorkforceType(wt.value)}
                      className="topic-pill"
                      style={{
                        cursor: 'pointer',
                        background: selected ? 'var(--accent-light)' : 'var(--bg-secondary)',
                        color: selected ? 'var(--accent)' : 'var(--fg-muted)',
                        borderColor: selected ? 'var(--accent)' : 'var(--border)',
                        fontWeight: selected ? 600 : 400,
                        padding: '0.375rem 0.75rem',
                        fontSize: '0.8125rem',
                      }}
                    >
                      {wt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Divider */}
            <div
              style={{ borderTop: '1px solid var(--border)', margin: '1.5rem 0', position: 'relative' }}
            >
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
                About You
              </span>
            </div>

            {/* Bio */}
            <div style={{ marginBottom: fieldGap }}>
              <label style={labelStyle}>Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell the community about your WFM experience..."
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              />
            </div>

            {/* Location */}
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

            {/* Expertise */}
            {topics.length > 0 && (
              <>
                <div
                  style={{ borderTop: '1px solid var(--border)', margin: '1.5rem 0', position: 'relative' }}
                >
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
                    Expertise
                  </span>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.5, margin: '0 0 0.75rem' }}>
                  Choose topics you&apos;re experienced in — this helps others find you.
                </p>
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
                </div>
              </>
            )}

            {/* Continue to Step 2 */}
            <button
              type="submit"
              disabled={!step1Valid}
              style={{
                width: '100%',
                padding: '0.75rem 1.5rem',
                background: step1Valid ? 'var(--accent)' : 'var(--border)',
                color: step1Valid ? 'var(--accent-text)' : 'var(--fg-muted)',
                border: 'none',
                borderRadius: 'var(--radius)',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: step1Valid ? 'pointer' : 'not-allowed',
                transition: 'background 0.15s',
              }}
            >
              Continue
            </button>

            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <a href="/" style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)', textDecoration: 'none' }}>
                Skip for now
              </a>
            </div>
          </form>
        )}

        {/* ── STEP 2: OVIX Contributor ── */}
        {step === 2 && (
          <form onSubmit={handleSubmit}>
            {/* Back link */}
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--link)',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                padding: 0,
                marginBottom: '1.5rem',
              }}
            >
              &larr; Back to basic profile
            </button>

            {/* Explanation card */}
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
                operations. Contributors get personalized incident notifications matched to their
                locations and can validate real-world impact for the community.
              </p>
            </div>

            {/* Opt-in checkbox */}
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
                  Your data is only used for incident correlation. You control visibility in settings.
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
                    marginBottom: '1.5rem',
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
                    <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginTop: '0.125rem' }}>
                      Lets agents distinguish first-party operations from outsourced services
                    </div>
                  </div>
                </label>

                {/* Client industries (BPO only) */}
                {isBpo && (
                  <div style={{ marginBottom: fieldGap }}>
                    <label style={labelStyle}>Client Industries</label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', margin: '0 0 0.5rem' }}>
                      Which industries do your clients operate in?
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {INDUSTRIES.filter((i) => i.value !== 'other').map((ind) => {
                        const selected = clientIndustries.includes(ind.value)
                        return (
                          <button
                            key={ind.value}
                            type="button"
                            onClick={() => toggleClientIndustry(ind.value)}
                            className="topic-pill"
                            style={{
                              cursor: 'pointer',
                              background: selected ? 'var(--accent-light)' : 'var(--bg-secondary)',
                              color: selected ? 'var(--accent)' : 'var(--fg-muted)',
                              borderColor: selected ? 'var(--accent)' : 'var(--border)',
                              fontWeight: selected ? 600 : 400,
                              padding: '0.375rem 0.75rem',
                              fontSize: '0.8125rem',
                            }}
                          >
                            {ind.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Divider: Supply Side */}
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
                  Where is your workforce located? This helps agents match incidents to your operations.
                </p>

                {/* Footprint cards */}
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
                      {/* Row 1: Location */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <div>
                          <label style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', display: 'block', marginBottom: '0.125rem' }}>Country</label>
                          <select
                            value={row.country}
                            onChange={(e) => updateFootprintRow(i, 'country', e.target.value)}
                            style={{ ...selectStyle, padding: '0.4375rem 0.5rem', fontSize: '0.8125rem' }}
                          >
                            {FOOTPRINT_COUNTRIES.map((c) => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', display: 'block', marginBottom: '0.125rem' }}>
                            {row.country === 'US' ? 'State' : 'State / Province'}
                          </label>
                          {row.country === 'US' ? (
                            <select
                              value={row.stateProvince}
                              onChange={(e) => updateFootprintRow(i, 'stateProvince', e.target.value)}
                              style={{ ...selectStyle, padding: '0.4375rem 0.5rem', fontSize: '0.8125rem' }}
                            >
                              <option value="">Select</option>
                              {US_STATES.map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              placeholder="Province / Region"
                              value={row.stateProvince}
                              onChange={(e) => updateFootprintRow(i, 'stateProvince', e.target.value)}
                              style={{ ...inputStyle, padding: '0.4375rem 0.5rem', fontSize: '0.8125rem' }}
                            />
                          )}
                        </div>
                        <div>
                          <label style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', display: 'block', marginBottom: '0.125rem' }}>City</label>
                          <input
                            type="text"
                            placeholder="City"
                            value={row.city}
                            onChange={(e) => updateFootprintRow(i, 'city', e.target.value)}
                            style={{ ...inputStyle, padding: '0.4375rem 0.5rem', fontSize: '0.8125rem' }}
                          />
                        </div>
                      </div>
                      {/* Row 2: Details */}
                      <div style={{ display: 'grid', gridTemplateColumns: '5rem 1fr 1fr auto', gap: '0.5rem', alignItems: 'end' }}>
                        <div>
                          <label style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', display: 'block', marginBottom: '0.125rem' }}>Headcount</label>
                          <input
                            type="number"
                            placeholder="HC"
                            min={1}
                            value={row.headcount}
                            onChange={(e) => updateFootprintRow(i, 'headcount', e.target.value ? Number(e.target.value) : '')}
                            style={{ ...inputStyle, padding: '0.4375rem 0.5rem', fontSize: '0.8125rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', display: 'block', marginBottom: '0.125rem' }}>Sourcing</label>
                          <select
                            value={row.sourcing}
                            onChange={(e) => updateFootprintRow(i, 'sourcing', e.target.value)}
                            style={{ ...selectStyle, padding: '0.4375rem 0.5rem', fontSize: '0.8125rem' }}
                          >
                            <option value="">Select</option>
                            {SOURCING_TYPES.map((s) => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', display: 'block', marginBottom: '0.125rem' }}>Workforce Type</label>
                          <select
                            value={row.workforceType}
                            onChange={(e) => updateFootprintRow(i, 'workforceType', e.target.value)}
                            style={{ ...selectStyle, padding: '0.4375rem 0.5rem', fontSize: '0.8125rem' }}
                          >
                            <option value="">Select</option>
                            {FOOTPRINT_WORKFORCE_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                        {footprint.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeFootprintRow(i)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--fg-faint)',
                              cursor: 'pointer',
                              fontSize: '1.125rem',
                              padding: '0.25rem 0.5rem',
                              marginBottom: '0.125rem',
                            }}
                            title="Remove location"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                      {row.workforceType === 'other' && (
                        <div style={{ marginTop: '0.5rem' }}>
                          <label style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', display: 'block', marginBottom: '0.125rem' }}>Describe workforce type</label>
                          <input
                            type="text"
                            placeholder="e.g., Underwriting, Compliance Review, Data Entry"
                            value={row.otherWorkforceType}
                            onChange={(e) => updateFootprintRow(i, 'otherWorkforceType', e.target.value)}
                            style={{ ...inputStyle, padding: '0.4375rem 0.5rem', fontSize: '0.8125rem' }}
                          />
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
                    marginBottom: '1.5rem',
                  }}
                >
                  + Add location
                </button>

                {/* Divider: Demand Side */}
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
                    {CUSTOMER_GEO_SCOPES.map((g) => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </div>

                {geoScope === 'regional-us' && (
                  <div style={{ marginBottom: fieldGap }}>
                    <label style={labelStyle}>US Regions</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {US_REGIONS.map((r) => {
                        const selected = usRegions.includes(r.value)
                        return (
                          <button
                            key={r.value}
                            type="button"
                            onClick={() => toggleUsRegion(r.value)}
                            className="topic-pill"
                            style={{
                              cursor: 'pointer',
                              background: selected ? 'var(--accent-light)' : 'var(--bg-secondary)',
                              color: selected ? 'var(--accent)' : 'var(--fg-muted)',
                              borderColor: selected ? 'var(--accent)' : 'var(--border)',
                              fontWeight: selected ? 600 : 400,
                              padding: '0.375rem 0.75rem',
                              fontSize: '0.8125rem',
                            }}
                          >
                            {r.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {geoScope === 'single-state' && (
                  <div style={{ marginBottom: fieldGap }}>
                    <label style={labelStyle}>State</label>
                    <select value={usState} onChange={(e) => setUsState(e.target.value)} style={selectStyle}>
                      <option value="">Select state</option>
                      {US_STATES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
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
                      placeholder="e.g., EU, UK, Philippines, Costa Rica"
                      style={inputStyle}
                    />
                  </div>
                )}
              </>
            )}

            {/* Submit buttons */}
            <button
              type="submit"
              disabled={saving}
              style={{
                width: '100%',
                padding: '0.75rem 1.5rem',
                background: saving ? 'var(--border)' : 'var(--accent)',
                color: saving ? 'var(--fg-muted)' : 'var(--accent-text)',
                border: 'none',
                borderRadius: 'var(--radius)',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
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
        )}
      </div>
    </div>
  )
}
