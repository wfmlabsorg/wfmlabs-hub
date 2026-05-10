import { getPayload } from 'payload'
import config from '@payload-config'
import { notFound } from 'next/navigation'
import React from 'react'

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

  return (
    <div style={{ maxWidth: '50rem', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Breadcrumb */}
      <nav style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)', marginBottom: '1.5rem' }}>
        <a href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Home</a>
        {' / '}
        <a href="/members" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Members</a>
        {' / '}
        <span style={{ color: 'var(--fg)' }}>@{member.username}</span>
      </nav>

      {/* Profile header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
        <div
          style={{
            width: '5rem',
            height: '5rem',
            borderRadius: '50%',
            background: 'var(--accent-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2rem',
            fontWeight: 700,
            color: 'var(--accent)',
            flexShrink: 0,
          }}
        >
          {member.displayName?.charAt(0).toUpperCase() || '?'}
        </div>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            {member.displayName}
          </h1>
          <div style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', marginBottom: '0.5rem' }}>
            @{member.username}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {member.type && <span className="badge badge-type">{member.type}</span>}
            {member.foundingMember && (
              <span className="badge" style={{ background: '#3d2e00', color: '#ff9d00' }}>
                Founding Member
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bio */}
      {member.bio && (
        <div style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', lineHeight: 1.6 }}>
            {member.bio}
          </p>
        </div>
      )}

      {/* Contributions */}
      <div>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
          Contributions ({allContributions.length})
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
