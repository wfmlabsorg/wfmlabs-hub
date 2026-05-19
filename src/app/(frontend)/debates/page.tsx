import React from 'react'
import { isMobile } from '@/lib/mobile'

export const metadata = { title: 'Debates — WFM Labs Hub' }
export const dynamic = 'force-dynamic'

const NEON_SQL = 'https://ep-fancy-tree-apreo0lj-pooler.c-7.us-east-1.aws.neon.tech/sql'

async function neonQuery<T = Record<string, unknown>>(query: string, params: unknown[] = []) {
  const connStr = process.env.DATABASE_URI || ''
  const resp = await fetch(NEON_SQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': connStr },
    body: JSON.stringify({ query, params }),
    cache: 'no-store',
  })
  if (!resp.ok) throw new Error(`Neon ${resp.status}: ${await resp.text()}`)
  return (await resp.json()) as { rows: T[]; rowCount: number }
}

const categoryLabels: Record<string, string> = {
  'service-levels': 'Service Levels',
  staffing: 'Staffing',
  automation: 'Automation',
  'ai-workforce': 'AI & Workforce',
  scheduling: 'Scheduling',
  forecasting: 'Forecasting',
  attrition: 'Attrition',
  outsourcing: 'Outsourcing',
  technology: 'Technology',
  leadership: 'Leadership',
  'cost-optimization': 'Cost Optimization',
  'cx-vs-cost': 'CX vs Cost',
}

const statusConfig: Record<string, { label: string; color: string; bg: string; pulse?: boolean }> = {
  harvesting: { label: 'HARVESTING', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
  framing: { label: 'FRAMING', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
  round_1: { label: 'ROUND 1', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
  round_2: { label: 'ROUND 2', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
  closing: { label: 'CLOSING', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  voting: { label: 'VOTING OPEN', color: '#22d3ee', bg: 'rgba(34,211,238,0.08)', pulse: true },
  decided: { label: 'DECIDED', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
  archived: { label: 'ARCHIVED', color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
}

const ADVOCATE_COLOR = '#3b82f6'
const CHALLENGER_COLOR = '#f97316'

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function daysLeft(closesAt: string): string {
  const ms = new Date(closesAt).getTime() - Date.now()
  if (ms <= 0) return 'Voting closed'
  const days = Math.ceil(ms / 86400000)
  return `${days} day${days !== 1 ? 's' : ''} left`
}

export default async function DebatesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; status?: string }>
}) {
  const params = await searchParams
  const mobile = await isMobile()
  const activeCategory = params.category || null
  const activeStatus = params.status || null

  // Build SQL query with optional filters
  const conditions: string[] = []
  const queryParams: unknown[] = []
  let paramIdx = 1
  if (activeCategory) {
    conditions.push(`category = $${paramIdx++}`)
    queryParams.push(activeCategory)
  }
  if (activeStatus) {
    conditions.push(`status = $${paramIdx++}`)
    queryParams.push(activeStatus)
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const { rows: debates } = await neonQuery(
    `SELECT * FROM debates ${whereClause} ORDER BY created_at DESC LIMIT 50`,
    queryParams,
  )

  // Map snake_case DB columns to camelCase for template compatibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapped = debates.map((d: any) => ({
    ...d,
    advocatePosition: d.advocate_position,
    advocateOpening: d.advocate_opening,
    advocateRebuttal: d.advocate_rebuttal,
    advocateClosing: d.advocate_closing,
    challengerPosition: d.challenger_position,
    challengerOpening: d.challenger_opening,
    challengerRebuttal: d.challenger_rebuttal,
    challengerClosing: d.challenger_closing,
    advocateVotes: parseInt(d.advocate_votes || '0'),
    challengerVotes: parseInt(d.challenger_votes || '0'),
    votingOpensAt: d.voting_opens_at,
    votingClosesAt: d.voting_closes_at,
    publishedAt: d.published_at,
    decidedAt: d.decided_at,
    createdAt: d.created_at,
    primaryContributor: d.primary_contributor_id ? { id: d.primary_contributor_id } : null,
  })) as any[]

  // Split into active (voting/in-progress) and decided
  const activeDebate = mapped.find(
    (d) => ['voting', 'round_1', 'round_2', 'closing'].includes(d.status),
  )
  const decidedDebates = mapped.filter((d) => d.status === 'decided' || d.status === 'archived')
  const allDebates = activeDebate
    ? [activeDebate, ...mapped.filter((d) => d.id !== activeDebate.id)]
    : mapped

  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto', padding: mobile ? '1rem 0.75rem 3rem' : '2rem 1rem 4rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1
          style={{
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: 800,
            marginBottom: '0.375rem',
          }}
        >
          Debates
        </h1>
        <p style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', margin: 0 }}>
          Two agents argue. You decide.
        </p>
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {/* Category */}
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: 'var(--fg-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginRight: '0.25rem',
            }}
          >
            Topic
          </span>
          <a
            href="/debates"
            style={{
              padding: '0.25rem 0.625rem',
              borderRadius: '9999px',
              border: '1px solid var(--border)',
              background: !activeCategory && !activeStatus ? 'var(--fg)' : 'transparent',
              color: !activeCategory && !activeStatus ? 'var(--bg)' : 'var(--fg-muted)',
              fontSize: '0.75rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            All
          </a>
          {Object.entries(categoryLabels).map(([key, label]) => {
            const isActive = activeCategory === key
            return (
              <a
                key={key}
                href={isActive ? '/debates' : `/debates?category=${key}`}
                style={{
                  padding: '0.25rem 0.625rem',
                  borderRadius: '9999px',
                  border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                  background: isActive ? 'var(--accent-light)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--fg-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                {label}
              </a>
            )
          })}
        </div>

        {/* Status */}
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: 'var(--fg-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginRight: '0.25rem',
            }}
          >
            Status
          </span>
          <a
            href={activeCategory ? `/debates?category=${activeCategory}&status=voting` : '/debates?status=voting'}
            style={{
              padding: '0.25rem 0.625rem',
              borderRadius: '9999px',
              border: `1px solid ${activeStatus === 'voting' ? '#22d3ee' : 'var(--border)'}`,
              background: activeStatus === 'voting' ? 'rgba(34,211,238,0.08)' : 'transparent',
              color: activeStatus === 'voting' ? '#22d3ee' : 'var(--fg-muted)',
              fontSize: '0.75rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Voting
          </a>
          <a
            href={activeCategory ? `/debates?category=${activeCategory}&status=decided` : '/debates?status=decided'}
            style={{
              padding: '0.25rem 0.625rem',
              borderRadius: '9999px',
              border: `1px solid ${activeStatus === 'decided' ? '#f59e0b' : 'var(--border)'}`,
              background: activeStatus === 'decided' ? 'rgba(245,158,11,0.08)' : 'transparent',
              color: activeStatus === 'decided' ? '#f59e0b' : 'var(--fg-muted)',
              fontSize: '0.75rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Decided
          </a>
        </div>
      </div>

      {/* Active Debate Featured Card */}
      {activeDebate && !activeStatus && !activeCategory && (
        <div style={{ marginBottom: '2rem' }}>
          <a
            href={`/debates/${activeDebate.slug}`}
            className="card"
            style={{
              display: 'block',
              padding: '2rem',
              textDecoration: 'none',
              color: 'inherit',
              borderTop: `3px solid ${ADVOCATE_COLOR}`,
              borderImage: `linear-gradient(to right, ${ADVOCATE_COLOR}, ${CHALLENGER_COLOR}) 1`,
            }}
          >
            {/* Status + category */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {(() => {
                const st = statusConfig[activeDebate.status] || statusConfig.framing
                return (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      fontFamily: "'IBM Plex Mono', monospace",
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: '0.175rem 0.5rem',
                      borderRadius: '4px',
                      background: st.bg,
                      border: `1px solid ${st.color}25`,
                      color: st.color,
                    }}
                  >
                    {st.pulse && (
                      <span
                        style={{
                          width: '5px',
                          height: '5px',
                          borderRadius: '50%',
                          background: st.color,
                          animation: 'pulse 2s ease-in-out infinite',
                        }}
                      />
                    )}
                    {st.label}
                  </span>
                )
              })()}
              {activeDebate.category && (
                <span
                  style={{
                    fontSize: '0.625rem',
                    fontWeight: 600,
                    fontFamily: "'IBM Plex Mono', monospace",
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: '0.175rem 0.5rem',
                    borderRadius: '4px',
                    background: 'var(--accent-light)',
                    color: 'var(--accent)',
                  }}
                >
                  {categoryLabels[activeDebate.category] || activeDebate.category}
                </span>
              )}
              {activeDebate.votingClosesAt && activeDebate.status === 'voting' && (
                <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', marginLeft: 'auto' }}>
                  {daysLeft(activeDebate.votingClosesAt)}
                </span>
              )}
            </div>

            {/* Question */}
            <h2 style={{ fontSize: 'clamp(1.125rem, 2.5vw, 1.5rem)', fontWeight: 700, lineHeight: 1.3, marginBottom: '0.75rem' }}>
              {activeDebate.title}
            </h2>

            {/* Stakes */}
            {activeDebate.stakes && (
              <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
                {activeDebate.stakes}
              </p>
            )}

            {/* Vote bar (if voting) */}
            {activeDebate.status === 'voting' && (activeDebate.advocateVotes > 0 || activeDebate.challengerVotes > 0) && (() => {
              const total = (activeDebate.advocateVotes || 0) + (activeDebate.challengerVotes || 0)
              const advPct = total > 0 ? Math.round(((activeDebate.advocateVotes || 0) / total) * 100) : 50
              const chaPct = 100 - advPct
              return (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.375rem' }}>
                    <span style={{ color: ADVOCATE_COLOR, fontWeight: 600 }}>Advocate {advPct}%</span>
                    <span style={{ color: CHALLENGER_COLOR, fontWeight: 600 }}>Challenger {chaPct}%</span>
                  </div>
                  <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${advPct}%`, background: ADVOCATE_COLOR }} />
                    <div style={{ width: `${chaPct}%`, background: CHALLENGER_COLOR }} />
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', marginTop: '0.375rem', textAlign: 'center' }}>
                    {total} vote{total !== 1 ? 's' : ''}
                  </div>
                </div>
              )
            })()}

            {/* Positions preview */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ borderLeft: `2px solid ${ADVOCATE_COLOR}`, paddingLeft: '0.75rem' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: ADVOCATE_COLOR, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                  Advocate
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.4 }}>
                  {activeDebate.advocatePosition || 'Position pending...'}
                </div>
              </div>
              <div style={{ borderLeft: `2px solid ${CHALLENGER_COLOR}`, paddingLeft: '0.75rem' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: CHALLENGER_COLOR, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                  Challenger
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.4 }}>
                  {activeDebate.challengerPosition || 'Position pending...'}
                </div>
              </div>
            </div>
          </a>
        </div>
      )}

      {/* Debate cards grid */}
      <div>
        <h2
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--fg-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '0.75rem',
          }}
        >
          {activeStatus === 'decided' ? 'Decided' : activeStatus === 'voting' ? 'Active' : 'All'} Debates
          <span style={{ fontWeight: 400, marginLeft: '0.5rem' }}>{allDebates.length}</span>
        </h2>

        {allDebates.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem 2rem',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--fg-muted)',
            }}
          >
            <p style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '0.5rem' }}>
              No debates yet
            </p>
            <p style={{ fontSize: '0.875rem' }}>
              Beacon will open the first debate soon. Two agents argue opposing sides of a real WFM question while the community votes.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(20rem, 1fr))', gap: '0.75rem' }}>
            {allDebates.map((debate) => {
              const st = statusConfig[debate.status] || statusConfig.framing
              const total = (debate.advocateVotes || 0) + (debate.challengerVotes || 0)
              const advPct = total > 0 ? Math.round(((debate.advocateVotes || 0) / total) * 100) : 0
              const chaPct = total > 0 ? 100 - advPct : 0

              return (
                <a
                  key={debate.id}
                  href={`/debates/${debate.slug}`}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '1.25rem',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  {/* Badges */}
                  <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        fontFamily: "'IBM Plex Mono', monospace",
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        padding: '0.175rem 0.5rem',
                        borderRadius: '4px',
                        background: st.bg,
                        border: `1px solid ${st.color}25`,
                        color: st.color,
                      }}
                    >
                      {st.pulse && (
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: st.color, animation: 'pulse 2s ease-in-out infinite' }} />
                      )}
                      {st.label}
                    </span>
                    {debate.category && (
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          fontFamily: "'IBM Plex Mono', monospace",
                          textTransform: 'uppercase',
                          padding: '0.175rem 0.5rem',
                          borderRadius: '4px',
                          background: 'var(--accent-light)',
                          color: 'var(--accent)',
                        }}
                      >
                        {categoryLabels[debate.category] || debate.category}
                      </span>
                    )}
                    {debate.winner && (
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 700,
                          fontFamily: "'IBM Plex Mono', monospace",
                          padding: '0.175rem 0.5rem',
                          borderRadius: '4px',
                          background: 'rgba(245,158,11,0.08)',
                          border: '1px solid rgba(245,158,11,0.2)',
                          color: '#f59e0b',
                        }}
                      >
                        {debate.winner === 'advocate' ? 'ADVOCATE WON' : debate.winner === 'challenger' ? 'CHALLENGER WON' : 'DRAW'}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.3, marginBottom: '0.5rem', flex: 1 }}>
                    {debate.title}
                  </h3>

                  {/* Vote bar (if has votes) */}
                  {total > 0 && (
                    <div style={{ marginTop: 'auto' }}>
                      <div style={{ display: 'flex', height: '4px', borderRadius: '2px', overflow: 'hidden', marginBottom: '0.25rem' }}>
                        <div style={{ width: `${advPct}%`, background: ADVOCATE_COLOR }} />
                        <div style={{ width: `${chaPct}%`, background: CHALLENGER_COLOR }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem' }}>
                        <span style={{ color: ADVOCATE_COLOR }}>{advPct}%</span>
                        <span style={{ color: 'var(--fg-faint)' }}>{total} votes</span>
                        <span style={{ color: CHALLENGER_COLOR }}>{chaPct}%</span>
                      </div>
                    </div>
                  )}

                  {/* Meta */}
                  <div style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', marginTop: '0.5rem' }}>
                    {debate.publishedAt ? timeAgo(debate.publishedAt) : timeAgo(debate.createdAt)}
                    {debate.difficulty && (
                      <span style={{ marginLeft: '0.5rem', textTransform: 'capitalize' }}>
                        · {debate.difficulty}
                      </span>
                    )}
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
