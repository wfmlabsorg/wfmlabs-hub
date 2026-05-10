import { getPayload } from 'payload'
import config from '@payload-config'
import React from 'react'

export const metadata = { title: 'Members' }
export const dynamic = 'force-dynamic'

export default async function MembersBrowsePage() {
  const payload = await getPayload({ config })
  const members = await payload
    .find({ collection: 'members', limit: 50, sort: '-createdAt', depth: 0, overrideAccess: true })
    .catch(() => ({ docs: [] }))

  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>Members</h1>
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.9375rem' }}>
          WFM practitioners and builders in the community.
        </p>
      </div>

      <div style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', marginBottom: '1.5rem' }}>
        {members.docs.length} {members.docs.length === 1 ? 'member' : 'members'}
      </div>

      {members.docs.length === 0 ? (
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
            No members yet
          </p>
          <p style={{ fontSize: '0.875rem' }}>Members will appear here once they join.</p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(16rem, 1fr))',
            gap: '1rem',
          }}
        >
          {members.docs.map((member) => (
            <a
              key={member.id}
              href={`/member/${member.username}`}
              className="card"
              style={{ padding: '1.25rem', textDecoration: 'none', color: 'inherit' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div
                  style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '50%',
                    background: 'var(--accent-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--accent)',
                    flexShrink: 0,
                  }}
                >
                  {member.displayName?.charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{member.displayName}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)' }}>
                    @{member.username}
                  </div>
                </div>
              </div>
              {member.bio && (
                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: 'var(--fg-muted)',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {member.bio}
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                {member.type && (
                  <span className="badge badge-type" style={{ fontSize: '0.6875rem' }}>
                    {member.type}
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
          ))}
        </div>
      )}
    </div>
  )
}
