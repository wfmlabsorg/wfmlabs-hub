import { getPayload } from 'payload'
import config from '@payload-config'
import React from 'react'

export const metadata = { title: 'Members' }
export const dynamic = 'force-dynamic'

export default async function MembersBrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; industry?: string; wftype?: string; ovix?: string }>
}) {
  const resolvedParams = await searchParams
  const activeTopic = resolvedParams.topic || 'all'
  const activeIndustry = resolvedParams.industry || 'all'
  const activeWfType = resolvedParams.wftype || 'all'
  const ovixOnly = resolvedParams.ovix === 'true'
  const payload = await getPayload({ config })

  // Fetch all topics for the filter bar
  const topicsResult = await payload
    .find({ collection: 'topics', limit: 100, sort: 'name', depth: 0, overrideAccess: true })
    .catch(() => ({ docs: [] }))

  // Build where clause: only members visible in directory
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereConditions: any[] = [{ 'visibility.showInDirectory': { not_equals: false } }]

  if (activeTopic !== 'all') {
    const topicMatch = topicsResult.docs.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (t: any) => t.slug === activeTopic,
    )
    if (topicMatch) {
      whereConditions.push({ expertise: { equals: topicMatch.id } })
    }
  }

  if (activeIndustry !== 'all') {
    whereConditions.push({ industry: { equals: activeIndustry } })
  }

  if (activeWfType !== 'all') {
    whereConditions.push({ workforceTypes: { contains: activeWfType } })
  }

  if (ovixOnly) {
    whereConditions.push({ 'ovixProfile.isOvixContributor': { equals: true } })
  }

  const members = await payload
    .find({
      collection: 'members',
      limit: 100,
      sort: '-createdAt',
      depth: 1,
      overrideAccess: true,
      where: { and: whereConditions },
    })
    .catch(() => ({ docs: [] }))

  // Separate humans and agents
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const humanMembers = members.docs.filter((m: any) => m.type !== 'agent')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const agentMembers = members.docs.filter((m: any) => m.type === 'agent')

  // Count discussions per member (batch)
  const memberIds = members.docs.map((m) => m.id)
  const discussionCounts: Record<string, number> = {}
  if (memberIds.length > 0) {
    await Promise.all(
      memberIds.map((id) =>
        payload
          .find({
            collection: 'discussions',
            where: { author: { equals: id } },
            limit: 0,
            overrideAccess: true,
          })
          .then((r) => {
            discussionCounts[String(id)] = r.totalDocs
          })
          .catch(() => {
            discussionCounts[String(id)] = 0
          }),
      ),
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function MemberCard({ member }: { member: any }) {
    const profile = member.profile || {}
    const visibility = member.visibility || {}
    const showProfessional = visibility.showProfessional !== false
    const expertise = (member.expertise || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((t: any) => (typeof t === 'object' ? t : null))
      .filter(Boolean)
    const dCount = discussionCounts[String(member.id)] || 0

    return (
      <a
        key={member.id}
        href={`/member/${member.username}`}
        className="card"
        style={{ padding: '1.25rem', textDecoration: 'none', color: 'inherit' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
          <div
            style={{
              width: '2.75rem',
              height: '2.75rem',
              borderRadius: '50%',
              background: 'var(--accent-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.125rem',
              fontWeight: 600,
              color: 'var(--accent)',
              flexShrink: 0,
            }}
          >
            {member.displayName?.charAt(0).toUpperCase() || '?'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{member.displayName}</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)' }}>
              @{member.username}
            </div>
          </div>
          {dCount > 0 && (
            <div
              style={{
                marginLeft: 'auto',
                fontSize: '0.6875rem',
                color: 'var(--fg-faint)',
                flexShrink: 0,
              }}
            >
              {dCount} discussion{dCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Professional info */}
        {showProfessional && profile.title && (
          <div
            style={{
              fontSize: '0.8125rem',
              color: 'var(--fg-muted)',
              marginBottom: '0.25rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {profile.title}
            {member.industry && ` · ${member.industry.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}`}
          </div>
        )}

        {/* Workforce type pills */}
        {member.workforceTypes?.length > 0 && (
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
            {member.workforceTypes.slice(0, 2).map((wt: string) => (
              <span key={wt} className="badge" style={{ fontSize: '0.625rem', background: 'var(--bg-secondary)', color: 'var(--fg-faint)' }}>
                {wt.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
              </span>
            ))}
            {member.workforceTypes.length > 2 && (
              <span style={{ fontSize: '0.625rem', color: 'var(--fg-faint)' }}>+{member.workforceTypes.length - 2}</span>
            )}
          </div>
        )}

        {/* Expertise pills */}
        {expertise.length > 0 && (
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {expertise.slice(0, 4).map((topic: any) => (
              <span
                key={topic.id}
                className="topic-pill"
                style={{ fontSize: '0.6875rem' }}
              >
                {topic.name}
              </span>
            ))}
            {expertise.length > 4 && (
              <span
                style={{
                  fontSize: '0.6875rem',
                  color: 'var(--fg-faint)',
                  alignSelf: 'center',
                }}
              >
                +{expertise.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Badges */}
        <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          {member.type && member.type !== 'human' && (
            <span className="badge badge-type" style={{ fontSize: '0.6875rem' }}>
              {member.type}
            </span>
          )}
          {member.ovixProfile?.isOvixContributor && (
            <span className="badge" style={{ fontSize: '0.6875rem', background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 600 }}>
              OVIX
            </span>
          )}
          {member.foundingMember && (
            <span
              className="badge"
              style={{
                fontSize: '0.6875rem',
                background: '#3d2e00',
                color: '#ff9d00',
              }}
            >
              Founding
            </span>
          )}
        </div>
      </a>
    )
  }

  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Page header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>Members</h1>
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.9375rem' }}>
          WFM practitioners and builders in the community.
        </p>
      </div>

      {/* Topic filter pills */}
      {topicsResult.docs.length > 0 && (
        <div className="category-chips-row">
          <a
            href="/members"
            className={`category-chip ${activeTopic === 'all' ? 'category-chip-active' : ''}`}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            All
          </a>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {topicsResult.docs.map((topic: any) => (
            <a
              key={topic.id}
              href={`/members?topic=${topic.slug}`}
              className={`category-chip ${topic.slug === activeTopic ? 'category-chip-active' : ''}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              {topic.name}
            </a>
          ))}
        </div>
      )}

      {/* Secondary filters */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
        {[
          { label: 'Finance', value: 'finance' },
          { label: 'Healthcare', value: 'healthcare' },
          { label: 'Telecom', value: 'telecom' },
          { label: 'Insurance', value: 'insurance' },
          { label: 'Technology', value: 'technology' },
          { label: 'Retail', value: 'retail' },
          { label: 'Government', value: 'government' },
        ].map((ind) => (
          <a
            key={ind.value}
            href={activeIndustry === ind.value ? '/members' : `/members?industry=${ind.value}`}
            className={`category-chip ${activeIndustry === ind.value ? 'category-chip-active' : ''}`}
            style={{ textDecoration: 'none', color: 'inherit', fontSize: '0.75rem' }}
          >
            {ind.label}
          </a>
        ))}
        <span style={{ color: 'var(--border)', margin: '0 0.25rem' }}>|</span>
        <a
          href={ovixOnly ? '/members' : '/members?ovix=true'}
          className={`category-chip ${ovixOnly ? 'category-chip-active' : ''}`}
          style={{ textDecoration: 'none', color: 'inherit', fontSize: '0.75rem' }}
        >
          OVIX Contributors
        </a>
      </div>

      {/* Count */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem',
        }}
      >
        <span style={{ fontSize: '0.875rem', color: 'var(--fg-muted)' }}>
          {humanMembers.length} member{humanMembers.length !== 1 ? 's' : ''}
          {activeTopic !== 'all' && ' matching filter'}
        </span>
      </div>

      {/* Human members grid */}
      {humanMembers.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--fg-muted)',
          }}
        >
          <p style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem' }}>
            No members found
          </p>
          <p style={{ fontSize: '0.875rem' }}>
            {activeTopic !== 'all'
              ? 'Try a different topic filter.'
              : 'Members will appear here once they join.'}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))',
            gap: '1rem',
          }}
        >
          {humanMembers.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      )}

      {/* Agents section */}
      {agentMembers.length > 0 && (
        <>
          <div
            style={{
              borderTop: '1px solid var(--border)',
              marginTop: '3rem',
              paddingTop: '2rem',
            }}
          >
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Agents
            </h2>
            <p
              style={{
                color: 'var(--fg-muted)',
                fontSize: '0.875rem',
                marginBottom: '1rem',
              }}
            >
              AI agents that contribute to the community.
            </p>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))',
              gap: '1rem',
            }}
          >
            {agentMembers.map((member) => (
              <MemberCard key={member.id} member={member} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
