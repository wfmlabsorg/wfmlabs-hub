import React from 'react'
import { notFound } from 'next/navigation'
import { isMobile } from '@/lib/mobile'
// import { DiscussionSection } from '@/components/discussion/DiscussionSection'

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

function mapDebate(d: Record<string, unknown>) {
  return {
    ...d,
    advocatePosition: d.advocate_position,
    advocateOpening: d.advocate_opening,
    advocateRebuttal: d.advocate_rebuttal,
    advocateClosing: d.advocate_closing,
    challengerPosition: d.challenger_position,
    challengerOpening: d.challenger_opening,
    challengerRebuttal: d.challenger_rebuttal,
    challengerClosing: d.challenger_closing,
    advocateVotes: parseInt((d.advocate_votes as string) || '0'),
    challengerVotes: parseInt((d.challenger_votes as string) || '0'),
    votingOpensAt: d.voting_opens_at,
    votingClosesAt: d.voting_closes_at,
    publishedAt: d.published_at,
    decidedAt: d.decided_at,
    createdAt: d.created_at,
  }
}

const ADVOCATE_COLOR = '#3b82f6'
const CHALLENGER_COLOR = '#f97316'

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

function daysLeft(closesAt: string): string {
  const ms = new Date(closesAt).getTime() - Date.now()
  if (ms <= 0) return 'Voting closed'
  const days = Math.ceil(ms / 86400000)
  return `${days} day${days !== 1 ? 's' : ''} left`
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { rows } = await neonQuery(`SELECT title FROM debates WHERE slug = $1 LIMIT 1`, [slug])
  const debate = rows[0] as { title?: string } | undefined
  if (!debate) return { title: 'Debate Not Found — WFM Labs Hub' }
  return { title: `${debate.title} — Debates — WFM Labs Hub` }
}

export default async function DebateDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const mobile = await isMobile()
  const { rows } = await neonQuery(`SELECT * FROM debates WHERE slug = $1 LIMIT 1`, [slug])
  if (rows.length === 0) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const debate = mapDebate(rows[0]) as any

  const st = statusConfig[debate.status] || statusConfig.framing
  const total = (debate.advocateVotes || 0) + (debate.challengerVotes || 0)
  const advPct = total > 0 ? Math.round(((debate.advocateVotes || 0) / total) * 100) : 50
  const chaPct = 100 - advPct
  const isVoting = debate.status === 'voting'
  const isDecided = debate.status === 'decided' || debate.status === 'archived'

  // Resolve linked tools
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkedTools = ((debate.linkedTools || []) as any[]).filter(
    (t) => typeof t === 'object' && t !== null,
  )

  return (
    <div style={{ maxWidth: '56rem', margin: '0 auto', padding: mobile ? '1rem 0.75rem 3rem' : '2rem 1rem 4rem' }}>
      {/* Breadcrumb */}
      <nav style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)', marginBottom: '1.5rem' }}>
        <a href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Home</a>
        {' / '}
        <a href="/debates" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Debates</a>
        {' / '}
        <span style={{ color: 'var(--fg)' }}>Current</span>
      </nav>

      {/* ── Header ── */}
      <div style={{ marginBottom: '2rem' }}>
        {/* Badges */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.6875rem',
              fontWeight: 700,
              fontFamily: "'IBM Plex Mono', monospace",
              padding: '0.25rem 0.625rem',
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
                letterSpacing: '0.05em',
                padding: '0.25rem 0.625rem',
                borderRadius: '4px',
                background: 'var(--accent-light)',
                color: 'var(--accent)',
              }}
            >
              {categoryLabels[debate.category] || debate.category}
            </span>
          )}
          {debate.difficulty && (
            <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', textTransform: 'capitalize' }}>
              {debate.difficulty}
            </span>
          )}
          {isVoting && debate.votingClosesAt && (
            <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', marginLeft: 'auto' }}>
              {daysLeft(debate.votingClosesAt)}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 style={{ fontSize: 'clamp(1.25rem, 3vw, 1.75rem)', fontWeight: 800, lineHeight: 1.2, marginBottom: '0.5rem' }}>
          {debate.title}
        </h1>

        {/* Stakes */}
        {debate.stakes && (
          <p style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', lineHeight: 1.5, margin: 0 }}>
            {debate.stakes}
          </p>
        )}
      </div>

      {/* ── Context Panel ── */}
      {debate.context && (
        <details open style={{ marginBottom: '2rem' }}>
          <summary
            style={{
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--fg-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              cursor: 'pointer',
              marginBottom: '0.75rem',
            }}
          >
            Background & Context
          </summary>
          <div
            style={{
              padding: '1.25rem',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              fontSize: '0.9375rem',
              color: 'var(--fg-muted)',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}
          >
            {debate.context}
          </div>
        </details>
      )}

      {/* ── Position Headers ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          marginBottom: '0.5rem',
        }}
      >
        <div style={{ borderBottom: `3px solid ${ADVOCATE_COLOR}`, paddingBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: ADVOCATE_COLOR, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
            Advocate
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>
            {debate.advocatePosition || 'YES position'}
          </div>
        </div>
        <div style={{ borderBottom: `3px solid ${CHALLENGER_COLOR}`, paddingBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: CHALLENGER_COLOR, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
            Challenger
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>
            {debate.challengerPosition || 'NO position'}
          </div>
        </div>
      </div>

      {/* ── Debate Rounds (serial flow) ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
        {/* Round 1 — Opening Statements */}
        {debate.advocateOpening && (
          <div>
            <div
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                fontFamily: "'IBM Plex Mono', monospace",
                color: 'var(--fg-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                textAlign: 'center',
                padding: '0.5rem',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                border: '1px solid var(--border)',
                borderBottom: 'none',
              }}
            >
              Round 1 — Opening Statements
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)', overflow: 'hidden' }}>
              {/* Advocate Opening */}
              <div style={{ borderLeft: `3px solid ${ADVOCATE_COLOR}`, padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: ADVOCATE_COLOR, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: ADVOCATE_COLOR }} />
                  Advocate — Opening
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--fg)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {debate.advocateOpening}
                </div>
              </div>
              {/* Challenger Opening */}
              {debate.challengerOpening && (
                <div style={{ borderLeft: `3px solid ${CHALLENGER_COLOR}`, padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: CHALLENGER_COLOR, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: CHALLENGER_COLOR }} />
                    Challenger — Opening
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--fg)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                    {debate.challengerOpening}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Round 2 — Rebuttals */}
        {debate.advocateRebuttal && (
          <div>
            <div
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                fontFamily: "'IBM Plex Mono', monospace",
                color: 'var(--fg-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                textAlign: 'center',
                padding: '0.5rem',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                border: '1px solid var(--border)',
                borderBottom: 'none',
              }}
            >
              Round 2 — Rebuttals
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)', overflow: 'hidden' }}>
              {/* Advocate Rebuttal */}
              <div style={{ borderLeft: `3px solid ${ADVOCATE_COLOR}`, padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: ADVOCATE_COLOR, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: ADVOCATE_COLOR }} />
                  Advocate — Rebuttal
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--fg)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {debate.advocateRebuttal}
                </div>
              </div>
              {/* Challenger Rebuttal */}
              {debate.challengerRebuttal && (
                <div style={{ borderLeft: `3px solid ${CHALLENGER_COLOR}`, padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: CHALLENGER_COLOR, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: CHALLENGER_COLOR }} />
                    Challenger — Rebuttal
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--fg)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                    {debate.challengerRebuttal}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Closing Statements */}
        {debate.advocateClosing && (
          <div>
            <div
              style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                fontFamily: "'IBM Plex Mono', monospace",
                color: 'var(--fg-faint)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                textAlign: 'center',
                padding: '0.5rem',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
                border: '1px solid var(--border)',
                borderBottom: 'none',
              }}
            >
              Closing Statements
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)', overflow: 'hidden' }}>
              {/* Advocate Closing */}
              <div style={{ borderLeft: `3px solid ${ADVOCATE_COLOR}`, padding: '1.25rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: ADVOCATE_COLOR, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: ADVOCATE_COLOR }} />
                  Advocate — Closing
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--fg)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                  {debate.advocateClosing}
                </div>
              </div>
              {/* Challenger Closing */}
              {debate.challengerClosing && (
                <div style={{ borderLeft: `3px solid ${CHALLENGER_COLOR}`, padding: '1.25rem' }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: CHALLENGER_COLOR, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: CHALLENGER_COLOR }} />
                    Challenger — Closing
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--fg)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                    {debate.challengerClosing}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Voting Section ── */}
      {(isVoting || isDecided) && (
        <div
          style={{
            marginBottom: '2rem',
            padding: '1.5rem',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
          }}
        >
          <h2
            style={{
              fontSize: '1rem',
              fontWeight: 700,
              marginBottom: '1rem',
              textAlign: 'center',
            }}
          >
            {isVoting ? 'Who made the stronger case?' : 'Final Results'}
          </h2>

          {/* Vote bar */}
          {total > 0 ? (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                <span style={{ color: ADVOCATE_COLOR, fontWeight: 700 }}>Advocate {advPct}%</span>
                <span style={{ color: CHALLENGER_COLOR, fontWeight: 700 }}>Challenger {chaPct}%</span>
              </div>
              <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ width: `${advPct}%`, background: ADVOCATE_COLOR, transition: 'width 0.5s' }} />
                <div style={{ width: `${chaPct}%`, background: CHALLENGER_COLOR, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', textAlign: 'center', marginTop: '0.5rem' }}>
                {total} vote{total !== 1 ? 's' : ''}
                {isVoting && debate.votingClosesAt && ` · ${daysLeft(debate.votingClosesAt)}`}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.875rem', color: 'var(--fg-faint)', textAlign: 'center', marginBottom: '1rem' }}>
              No votes yet. Be the first.
            </div>
          )}

          {/* Vote buttons (voting only) */}
          {isVoting && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.75rem',
              }}
            >
              <button
                data-vote="advocate"
                data-debate-id={debate.id}
                style={{
                  padding: '0.875rem',
                  borderRadius: '8px',
                  border: `2px solid ${ADVOCATE_COLOR}`,
                  background: `${ADVOCATE_COLOR}15`,
                  color: ADVOCATE_COLOR,
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                Vote Advocate
              </button>
              <button
                data-vote="challenger"
                data-debate-id={debate.id}
                style={{
                  padding: '0.875rem',
                  borderRadius: '8px',
                  border: `2px solid ${CHALLENGER_COLOR}`,
                  background: `${CHALLENGER_COLOR}15`,
                  color: CHALLENGER_COLOR,
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                Vote Challenger
              </button>
            </div>
          )}

          {/* Winner badge (decided) */}
          {isDecided && debate.winner && (
            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  padding: '0.375rem 1rem',
                  borderRadius: '9999px',
                  background: 'rgba(245,158,11,0.1)',
                  border: '2px solid #f59e0b',
                  color: '#f59e0b',
                }}
              >
                {debate.winner === 'advocate' ? 'Advocate Wins' : debate.winner === 'challenger' ? 'Challenger Wins' : 'Draw'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Verdict (decided) ── */}
      {isDecided && debate.verdict && (
        <div
          style={{
            marginBottom: '2rem',
            padding: '1.5rem',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            borderLeft: '3px solid #f59e0b',
          }}
        >
          <div
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: '#f59e0b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.75rem',
            }}
          >
            Beacon&apos;s Verdict
          </div>
          <div style={{ fontSize: '0.9375rem', color: 'var(--fg)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {debate.verdict}
          </div>
        </div>
      )}

      {/* ── Related Tools ── */}
      {linkedTools.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Related Tools
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {linkedTools.map((tool) => (
              <a
                key={tool.id}
                href={`/tools/${tool.slug}`}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  color: 'var(--accent)',
                  textDecoration: 'none',
                }}
              >
                {tool.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Discussion section — will activate once Payload migration syncs debates as a valid asset type */}
    </div>
  )
}
