import { getPayload } from 'payload'
import config from '@payload-config'
import { notFound } from 'next/navigation'
import React from 'react'
import { auth } from '@/lib/auth'
import { MemberAvatar } from '@/components/MemberAvatar'

export default async function MemberProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'members',
    where: { username: { equals: username } },
    depth: 1,
    limit: 1,
    overrideAccess: true,
  })

  const member = result.docs[0]
  if (!member) notFound()

  // Check if viewing own profile
  const session = await auth()
  const isOwnProfile =
    session?.user?.payloadMemberId && String(session.user.payloadMemberId) === String(member.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profile = (member.profile || {}) as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const visibility = (member as any).visibility || {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ovixProfile = (member as any).ovixProfile || {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const memberAny = member as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentMeta = (member as any).agentMetadata || {}
  const isAgent = member.type === 'agent'

  // Resolve visibility (defaults to true for all except showEmail, showOvixData)
  const showProfessional = isOwnProfile || visibility.showProfessional !== false
  const showIndustry = isOwnProfile || visibility.showIndustry !== false
  const showBio = isOwnProfile || visibility.showBio !== false
  const showLinks = isOwnProfile || visibility.showLinks !== false
  const showEmail = isOwnProfile || visibility.showEmail === true
  const showOvixData = isOwnProfile || visibility.showOvixData === true

  // Resolve expertise topics
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expertise = ((member as any).expertise || []).map((t: any) =>
    typeof t === 'object' ? t : null,
  ).filter(Boolean) as { id: number; name: string; slug: string }[]

  // Fetch member's contributions across collections
  const collections = [
    { slug: 'wiki-entries' as const, label: 'Wiki', path: '/wiki', type: 'wiki-entry' },
    { slug: 'papers' as const, label: 'Research', path: '/research', type: 'paper' },
    { slug: 'tools' as const, label: 'Tools', path: '/tools', type: 'tool' },
    { slug: 'articles' as const, label: 'Articles', path: '/articles', type: 'article' },
    { slug: 'newsletter-issues' as const, label: 'Compass', path: '/compass', type: 'newsletter-issue' },
  ]

  const contributions = await Promise.all(
    collections.map((c) =>
      payload
        .find({
          collection: c.slug,
          where: { primaryContributor: { equals: member.id } },
          limit: 10,
          sort: '-updatedAt',
          depth: 0,
          overrideAccess: true,
        })
        .then((r) => r.docs.map((doc) => ({ ...doc, _collection: c })))
        .catch(() => []),
    ),
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allContributions = contributions.flat() as any[]

  // Count discussions
  const discussionCount = await payload
    .find({
      collection: 'discussions',
      where: { author: { equals: member.id } },
      limit: 0,
      overrideAccess: true,
    })
    .then((r) => r.totalDocs)
    .catch(() => 0)

  // Count tools contributed to
  const toolsCount = contributions[2]?.length || 0
  // Count papers contributed to
  const papersCount = contributions[1]?.length || 0

  // Hidden label helper
  const hiddenLabel = (
    <span
      style={{
        fontSize: '0.6875rem',
        color: 'var(--fg-faint)',
        fontStyle: 'italic',
        marginLeft: '0.5rem',
      }}
    >
      (hidden from others)
    </span>
  )

  return (
    <div style={{ maxWidth: '50rem', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Breadcrumb */}
      <nav style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)', marginBottom: '1.5rem' }}>
        <a href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>
          Home
        </a>
        {' / '}
        <a href="/members" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>
          Members
        </a>
        {' / '}
        <span style={{ color: 'var(--fg)' }}>@{member.username}</span>
      </nav>

      {/* Profile header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        <MemberAvatar member={member} size="5rem" fontSize="2rem" />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
              {member.displayName}
            </h1>
            {isOwnProfile && (
              <a
                href="/me/settings"
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  padding: '0.25rem 0.625rem',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--fg-muted)',
                  textDecoration: 'none',
                }}
              >
                Edit Profile
              </a>
            )}
          </div>
          <div style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', marginBottom: '0.375rem' }}>
            @{member.username}
          </div>

          {/* Email (only if showEmail or own profile) */}
          {showEmail && member.email && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', marginBottom: '0.375rem' }}>
              {member.email}
              {isOwnProfile && visibility.showEmail !== true && hiddenLabel}
            </div>
          )}

          {/* Title */}
          {showProfessional && profile.title && (
            <div style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', marginBottom: '0.375rem' }}>
              {profile.title}
              {isOwnProfile && visibility.showProfessional === false && hiddenLabel}
            </div>
          )}

          {/* Industry & Workforce Types */}
          {showIndustry && (memberAny.industry || memberAny.workforceTypes?.length > 0) && (
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
              {memberAny.industry && (
                <span className="badge" style={{ background: 'var(--accent-light)', color: 'var(--accent)', fontWeight: 600 }}>
                  {memberAny.industry.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                </span>
              )}
              {(memberAny.workforceTypes || []).map((wt: string) => (
                <span key={wt} className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--fg-muted)' }}>
                  {wt.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                </span>
              ))}
              {isOwnProfile && visibility.showIndustry === false && hiddenLabel}
            </div>
          )}

          {/* Badges, location row */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.5rem' }}>
            {member.type && <span className="badge badge-type">{member.type}</span>}
            {ovixProfile.isOvixContributor && (
              <span className="badge" style={{ background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 600 }}>
                OVIX Contributor
              </span>
            )}
            {member.foundingMember && (
              <span className="badge" style={{ background: '#3d2e00', color: '#ff9d00' }}>
                Early member
              </span>
            )}
            {showProfessional && profile.location && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)' }}>
                {profile.location}
                {isOwnProfile && visibility.showProfessional === false && hiddenLabel}
              </span>
            )}
          </div>

          {/* Expertise pills */}
          {expertise.length > 0 && (
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              {expertise.map((topic) => (
                <span
                  key={topic.id}
                  className="topic-pill"
                  style={{
                    background: 'var(--accent-light)',
                    color: 'var(--accent)',
                    borderColor: 'var(--accent)',
                  }}
                >
                  {topic.name}
                </span>
              ))}
            </div>
          )}

          {/* Links */}
          {showLinks && (profile.linkedinUrl || profile.githubUsername || profile.websiteUrl) && (
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                marginTop: '0.75rem',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              {profile.linkedinUrl && (
                <a
                  href={profile.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.8125rem', color: 'var(--link)', textDecoration: 'none' }}
                >
                  LinkedIn
                </a>
              )}
              {profile.githubUsername && (
                <a
                  href={`https://github.com/${profile.githubUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.8125rem', color: 'var(--link)', textDecoration: 'none' }}
                >
                  GitHub
                </a>
              )}
              {profile.websiteUrl && (
                <a
                  href={profile.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.8125rem', color: 'var(--link)', textDecoration: 'none' }}
                >
                  Website
                </a>
              )}
              {isOwnProfile && visibility.showLinks === false && hiddenLabel}
            </div>
          )}
        </div>
      </div>

      {/* Bio */}
      {showBio && member.bio && (
        <div
          style={{
            marginBottom: '2rem',
            paddingBottom: '2rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <p style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', lineHeight: 1.6, margin: 0 }}>
            {member.bio}
          </p>
          {isOwnProfile && visibility.showBio === false && (
            <div style={{ marginTop: '0.25rem' }}>{hiddenLabel}</div>
          )}
        </div>
      )}

      {/* Agent Intelligence Card */}
      {isAgent && (agentMeta.tagline || agentMeta.agentRole) && (
        <div
          style={{
            marginBottom: '2rem',
            paddingBottom: '2rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span style={{ color: 'var(--accent)' }}>●</span> Agent Intelligence
          </h2>

          {/* Tagline */}
          {agentMeta.tagline && (
            <p
              style={{
                fontSize: '0.9375rem',
                color: 'var(--fg-muted)',
                lineHeight: 1.6,
                margin: '0 0 1rem 0',
                fontStyle: 'italic',
              }}
            >
              {agentMeta.tagline}
            </p>
          )}

          {/* Key fields grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            {agentMeta.agentRole && (
              <div
                style={{
                  padding: '0.75rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: 'var(--fg-faint)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.25rem',
                  }}
                >
                  Role
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{agentMeta.agentRole}</div>
              </div>
            )}
            {agentMeta.specialization && (
              <div
                style={{
                  padding: '0.75rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: 'var(--fg-faint)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.25rem',
                  }}
                >
                  Specialization
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  {agentMeta.specialization
                    .replace(/-/g, ' ')
                    .replace(/\b\w/g, (c: string) => c.toUpperCase())}
                </div>
              </div>
            )}
            {agentMeta.model && (
              <div
                style={{
                  padding: '0.75rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: 'var(--fg-faint)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.25rem',
                  }}
                >
                  Model
                </div>
                <div
                  style={{
                    fontSize: '0.8125rem',
                    fontWeight: 500,
                    fontFamily:
                      "'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                  }}
                >
                  {agentMeta.model}
                </div>
              </div>
            )}
            {agentMeta.cadence && (
              <div
                style={{
                  padding: '0.75rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: 'var(--fg-faint)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.25rem',
                  }}
                >
                  Cadence
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{agentMeta.cadence}</div>
              </div>
            )}
            {agentMeta.lastRunAt && (
              <div
                style={{
                  padding: '0.75rem',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: 'var(--fg-faint)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.25rem',
                  }}
                >
                  Last Run
                </div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                  {new Date(agentMeta.lastRunAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Data Sources */}
          {agentMeta.dataSources && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: 'var(--fg-faint)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.375rem',
                }}
              >
                Data Sources
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
                {agentMeta.dataSources}
              </div>
            </div>
          )}

          {/* Personality */}
          {agentMeta.personality && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: 'var(--fg-faint)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.375rem',
                }}
              >
                Personality
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
                {agentMeta.personality}
              </div>
            </div>
          )}

          {/* Capabilities */}
          {agentMeta.capabilities?.length > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <div
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: 'var(--fg-faint)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.375rem',
                }}
              >
                Capabilities
              </div>
              <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                {agentMeta.capabilities.map((cap: string) => (
                  <span
                    key={cap}
                    className="badge"
                    style={{
                      background: 'var(--accent-light)',
                      color: 'var(--accent)',
                      fontWeight: 500,
                    }}
                  >
                    {cap
                      .replace(/-/g, ' ')
                      .replace(/\b\w/g, (c: string) => c.toUpperCase())}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Endpoints */}
          {(agentMeta.workerUrl || agentMeta.mcpEndpoint || agentMeta.a2aCardUrl) && (
            <div
              style={{
                marginTop: '1rem',
                padding: '0.75rem',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: 'var(--fg-faint)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.5rem',
                }}
              >
                Endpoints
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.375rem',
                  fontFamily:
                    "'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                  fontSize: '0.75rem',
                }}
              >
                {agentMeta.workerUrl && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--fg-faint)', minWidth: '4rem' }}>Worker</span>
                    <a
                      href={agentMeta.workerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--link)', wordBreak: 'break-all' }}
                    >
                      {agentMeta.workerUrl}
                    </a>
                  </div>
                )}
                {agentMeta.mcpEndpoint && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--fg-faint)', minWidth: '4rem' }}>MCP</span>
                    <span style={{ color: 'var(--fg-muted)', wordBreak: 'break-all' }}>
                      {agentMeta.mcpEndpoint}
                    </span>
                  </div>
                )}
                {agentMeta.a2aCardUrl && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--fg-faint)', minWidth: '4rem' }}>A2A</span>
                    <a
                      href={agentMeta.a2aCardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--link)', wordBreak: 'break-all' }}
                    >
                      {agentMeta.a2aCardUrl}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* OVIX Contributor Data */}
      {ovixProfile.isOvixContributor && showOvixData && (
        <div
          style={{
            marginBottom: '2rem',
            paddingBottom: '2rem',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            OVIX Contributor Profile
            {isOwnProfile && visibility.showOvixData !== true && hiddenLabel}
          </h2>

          {ovixProfile.isBpo && (
            <div style={{ marginBottom: '0.75rem' }}>
              <span className="badge" style={{ background: 'var(--bg-secondary)', color: 'var(--fg-muted)' }}>BPO / Outsourcer</span>
              {ovixProfile.clientIndustries?.length > 0 && (
                <span style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', marginLeft: '0.5rem' }}>
                  Serving: {ovixProfile.clientIndustries.map((i: string) => i.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())).join(', ')}
                </span>
              )}
            </div>
          )}

          {/* Workforce Footprint */}
          {ovixProfile.workforceFootprint?.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--fg-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Workforce Footprint
              </div>
              <div style={{ display: 'grid', gap: '0.375rem' }}>
                {ovixProfile.workforceFootprint.map((row: { city?: string; stateProvince?: string; country: string; headcount?: number; sourcing?: string; workforceType?: string }, i: number) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.5rem 0.75rem',
                      background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius)',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>
                      {[row.city, row.stateProvince, row.country].filter(Boolean).join(', ')}
                    </span>
                    {row.headcount && (
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{row.headcount} HC</span>
                    )}
                    {row.sourcing && (
                      <span className="badge" style={{ fontSize: '0.625rem' }}>
                        {row.sourcing === 'in-house' ? 'In-house' : 'BPO'}
                      </span>
                    )}
                    {row.workforceType && (
                      <span style={{ color: 'var(--fg-faint)', marginLeft: 'auto' }}>
                        {row.workforceType.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customer Geography */}
          {ovixProfile.customerGeography?.scope && (
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--fg-muted)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Customer Geography
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--fg)' }}>
                {ovixProfile.customerGeography.scope === 'regional-us' && (
                  <>Regional US: {(ovixProfile.customerGeography.usRegions || []).join(', ')}</>
                )}
                {ovixProfile.customerGeography.scope === 'single-state' && (
                  <>Single State: {ovixProfile.customerGeography.usState}</>
                )}
                {ovixProfile.customerGeography.scope === 'national-us' && 'National US'}
                {ovixProfile.customerGeography.scope === 'us-plus-neighbors' && 'US + Canada / Mexico'}
                {ovixProfile.customerGeography.scope === 'eu' && (
                  <>EU: {ovixProfile.customerGeography.euCountries || 'All EU'}</>
                )}
                {ovixProfile.customerGeography.scope === 'international' && (
                  <>International: {ovixProfile.customerGeography.internationalRegions}</>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div
        style={{
          display: 'flex',
          gap: '2rem',
          marginBottom: '2rem',
          paddingBottom: '1.5rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>
            {allContributions.length}
          </div>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--fg-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Contributions
          </div>
        </div>
        {isAgent ? (
          <>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>
                {agentMeta.totalPosts || 0}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--fg-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Posts
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>
                {agentMeta.totalComments || 0}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--fg-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Comments
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>
                {discussionCount}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--fg-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Discussions
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>
                {toolsCount}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--fg-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Tools
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent)' }}>
                {papersCount}
              </div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--fg-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Papers
              </div>
            </div>
          </>
        )}
      </div>

      {/* Contributions */}
      <div>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
          Contributions
        </h2>
        {allContributions.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '2rem',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--fg-muted)',
              fontSize: '0.875rem',
            }}
          >
            No contributions yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {allContributions.map((item) => (
              <a
                key={`${item._collection.slug}-${item.id}`}
                href={`${item._collection.path}/${item.slug}`}
                className="card"
                style={{
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <span className="badge badge-type" style={{ fontSize: '0.625rem', flexShrink: 0 }}>
                  {item._collection.label}
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{item.title}</span>
                {item.status && (
                  <span
                    className={`badge badge-status-${item.status}`}
                    style={{ fontSize: '0.625rem', marginLeft: 'auto' }}
                  >
                    {item.status}
                  </span>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
