import React from 'react'

export const metadata = { title: 'Incidents — WFM Labs Hub' }
export const dynamic = 'force-dynamic'

// ── Neon HTTP query (same pattern as workers) ──

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

// ── Types ──

interface Incident {
  id: number
  title: string
  slug: string
  description: string | null
  domain: string
  severity: number
  severity_level: string
  status: string
  declared_by: string
  declared_at: string
  escalated_at: string | null
  resolved_at: string | null
  location_name: string | null
  location_country: string | null
  affected_regions: string[] | null
  related_event_uris: string[] | null
  notes: string | null
}

// ── Design tokens ──

const domainColors: Record<string, { bg: string; fg: string; border: string }> = {
  weather: { bg: 'rgba(59,130,246,0.08)', fg: '#60a5fa', border: '#3b82f6' },
  seismic: { bg: 'rgba(239,68,68,0.08)', fg: '#f87171', border: '#ef4444' },
  disaster: { bg: 'rgba(249,115,22,0.08)', fg: '#fb923c', border: '#f97316' },
  cyber: { bg: 'rgba(34,197,94,0.08)', fg: '#4ade80', border: '#22c55e' },
  health: { bg: 'rgba(236,72,153,0.08)', fg: '#f472b6', border: '#ec4899' },
  infrastructure: { bg: 'rgba(139,92,246,0.08)', fg: '#a78bfa', border: '#8b5cf6' },
  financial: { bg: 'rgba(245,158,11,0.08)', fg: '#fbbf24', border: '#f59e0b' },
  environmental: { bg: 'rgba(20,184,166,0.08)', fg: '#2dd4bf', border: '#14b8a6' },
  geopolitical: { bg: 'rgba(99,102,241,0.08)', fg: '#818cf8', border: '#6366f1' },
  labor: { bg: 'rgba(168,85,247,0.08)', fg: '#c084fc', border: '#a855f7' },
  supply_chain: { bg: 'rgba(234,179,8,0.08)', fg: '#facc15', border: '#eab308' },
  travel: { bg: 'rgba(6,182,212,0.08)', fg: '#22d3ee', border: '#06b6d4' },
}
const defaultDomain = { bg: 'rgba(148,163,184,0.08)', fg: '#94a3b8', border: '#64748b' }

const statusConfig: Record<string, { label: string; color: string; bg: string; pulse?: boolean }> = {
  declared: { label: 'DECLARED', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  active: { label: 'ACTIVE', color: '#22d3ee', bg: 'rgba(34,211,238,0.1)', pulse: true },
  escalated: { label: 'ESCALATED', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', pulse: true },
  'de-escalated': { label: 'DE-ESCALATED', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  resolved: { label: 'RESOLVED', color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
}

const severityColors: Record<string, string> = {
  CRITICAL: '#ef4444',
  ELEVATED: '#f59e0b',
  MODERATE: '#3b82f6',
  LOW: '#10b981',
  MINIMAL: '#64748b',
}

function domainLabel(domain: string): string {
  return domain.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }) + ' UTC'
}

// ── Page ──

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>
}) {
  const params = await searchParams
  const activeStatus = params.status || null
  const page = parseInt(params.page || '1')
  const limit = 20
  const offset = (page - 1) * limit

  // Build query
  let whereClause = ''
  const queryParams: unknown[] = []
  if (activeStatus && Object.keys(statusConfig).includes(activeStatus)) {
    queryParams.push(activeStatus)
    whereClause = `WHERE status = $${queryParams.length}`
  }

  const [{ rows: incidents }, { rows: [countRow] }, { rows: statusCounts }] = await Promise.all([
    neonQuery<Incident>(
      `SELECT * FROM incidents ${whereClause} ORDER BY
        CASE status
          WHEN 'escalated' THEN 0
          WHEN 'active' THEN 1
          WHEN 'declared' THEN 2
          WHEN 'de-escalated' THEN 3
          WHEN 'resolved' THEN 4
        END,
        severity DESC, declared_at DESC
      LIMIT ${limit} OFFSET ${offset}`,
      queryParams,
    ),
    neonQuery<{ cnt: string }>(
      `SELECT COUNT(*) as cnt FROM incidents ${whereClause}`,
      queryParams,
    ),
    neonQuery<{ status: string; cnt: string }>(
      `SELECT status, COUNT(*) as cnt FROM incidents GROUP BY status`,
    ),
  ])

  const totalDocs = parseInt(countRow?.cnt || '0')
  const totalPages = Math.ceil(totalDocs / limit)
  const hasPrev = page > 1
  const hasNext = page < totalPages

  // Status counts for filter badges
  const statusCountMap = Object.fromEntries(statusCounts.map((r) => [r.status, parseInt(r.cnt)]))
  const activeCount = (statusCountMap['declared'] || 0) + (statusCountMap['active'] || 0) + (statusCountMap['escalated'] || 0)

  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <h1
            style={{
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              fontWeight: 800,
              margin: 0,
            }}
          >
            Incidents
          </h1>
          {activeCount > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: '0.6875rem',
                fontWeight: 600,
                padding: '0.25rem 0.625rem',
                borderRadius: '9999px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#f87171',
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#ef4444',
                  animation: 'pulse 2s ease-in-out infinite',
                }}
              />
              {activeCount} ACTIVE
            </span>
          )}
        </div>
        <p style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', margin: 0 }}>
          Validated operational events tracked by Watchkeeper — declared, monitored, and resolved
          {totalDocs > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', marginLeft: '0.75rem' }}>
              {totalDocs} total
            </span>
          )}
        </p>
      </div>

      {/* Status filter chips */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <a
          href="/incidents"
          style={{
            padding: '0.375rem 0.875rem',
            borderRadius: '9999px',
            border: '1px solid var(--border)',
            background: !activeStatus ? 'var(--fg)' : 'transparent',
            color: !activeStatus ? 'var(--bg)' : 'var(--fg-muted)',
            fontSize: '0.8125rem',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          All
        </a>
        {Object.entries(statusConfig).map(([key, cfg]) => {
          const isActive = activeStatus === key
          const count = statusCountMap[key] || 0
          return (
            <a
              key={key}
              href={isActive ? '/incidents' : `/incidents?status=${key}`}
              style={{
                padding: '0.375rem 0.875rem',
                borderRadius: '9999px',
                border: `1px solid ${isActive ? cfg.color : 'var(--border)'}`,
                background: isActive ? cfg.bg : 'transparent',
                color: isActive ? cfg.color : 'var(--fg-muted)',
                fontSize: '0.8125rem',
                fontWeight: 500,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: '0.5rem',
                  height: '0.5rem',
                  borderRadius: '50%',
                  background: cfg.color,
                  flexShrink: 0,
                }}
              />
              {cfg.label}
              {count > 0 && (
                <span style={{ fontSize: '0.6875rem', opacity: 0.7 }}>
                  {count}
                </span>
              )}
            </a>
          )
        })}
      </div>

      {/* Incident cards */}
      {incidents.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--fg-muted)',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.3 }}>
            {activeStatus === 'resolved' ? '\u2705' : '\u26A0\uFE0F'}
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            {activeStatus ? `No ${statusConfig[activeStatus]?.label.toLowerCase()} incidents` : 'No incidents'}
          </h2>
          <p style={{ fontSize: '0.875rem', maxWidth: '28rem', margin: '0 auto', lineHeight: 1.6 }}>
            {activeStatus
              ? `No incidents currently in ${statusConfig[activeStatus]?.label.toLowerCase()} state.`
              : 'Watchkeeper has not declared any incidents yet. Incidents appear when severity thresholds are met across monitored domains.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {incidents.map((incident) => {
            const domain = domainColors[incident.domain] || defaultDomain
            const status = statusConfig[incident.status] || statusConfig.declared
            const sevColor = severityColors[incident.severity_level] || '#94a3b8'
            const isResolved = incident.status === 'resolved'

            return (
              <div
                key={incident.id}
                className="card"
                style={{
                  display: 'flex',
                  overflow: 'hidden',
                  borderRadius: 'var(--radius-lg)',
                  opacity: isResolved ? 0.6 : 1,
                }}
              >
                {/* Domain color band */}
                <div
                  style={{
                    width: '5px',
                    background: domain.border,
                    flexShrink: 0,
                  }}
                />

                <div style={{ flex: 1, padding: '1.25rem' }}>
                  {/* Top row: status badge + domain + severity + time */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginBottom: '0.625rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* Status badge */}
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
                        background: status.bg,
                        border: `1px solid ${status.color}25`,
                        color: status.color,
                      }}
                    >
                      {status.pulse && (
                        <span
                          style={{
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            background: status.color,
                            animation: 'pulse 2s ease-in-out infinite',
                          }}
                        />
                      )}
                      {status.label}
                    </span>

                    {/* Domain badge */}
                    <span
                      style={{
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        fontFamily: "'IBM Plex Mono', monospace",
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        padding: '0.175rem 0.5rem',
                        borderRadius: '4px',
                        background: domain.bg,
                        color: domain.fg,
                      }}
                    >
                      {domainLabel(incident.domain)}
                    </span>

                    {/* Severity */}
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        fontFamily: "'IBM Plex Mono', monospace",
                        color: sevColor,
                      }}
                    >
                      SEV {incident.severity.toFixed(0)}
                    </span>

                    {/* Timestamp */}
                    <span style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', marginLeft: 'auto' }}>
                      {timeAgo(incident.declared_at)}
                    </span>
                  </div>

                  {/* Title */}
                  <h3
                    style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      marginBottom: '0.375rem',
                      lineHeight: 1.3,
                      textDecoration: isResolved ? 'line-through' : 'none',
                      textDecorationColor: 'var(--fg-faint)',
                    }}
                  >
                    {incident.title}
                  </h3>

                  {/* Description */}
                  {incident.description && (
                    <p
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--fg-muted)',
                        lineHeight: 1.5,
                        marginBottom: '0.625rem',
                      }}
                    >
                      {incident.description.length > 200
                        ? incident.description.slice(0, 200) + '...'
                        : incident.description}
                    </p>
                  )}

                  {/* Footer: location + timeline + related events */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.75rem',
                      fontSize: '0.6875rem',
                      color: 'var(--fg-faint)',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    {(incident.location_name || incident.location_country) && (
                      <span>
                        {[incident.location_name, incident.location_country].filter(Boolean).join(', ')}
                      </span>
                    )}
                    {incident.location_country && (
                      <span style={{ opacity: 0.4 }}>{'\u00b7'}</span>
                    )}
                    <span>
                      Declared {formatDate(incident.declared_at)}
                    </span>
                    {incident.escalated_at && (
                      <>
                        <span style={{ opacity: 0.4 }}>{'\u00b7'}</span>
                        <span style={{ color: '#f87171' }}>
                          Escalated {formatDate(incident.escalated_at)}
                        </span>
                      </>
                    )}
                    {incident.resolved_at && (
                      <>
                        <span style={{ opacity: 0.4 }}>{'\u00b7'}</span>
                        <span style={{ color: '#10b981' }}>
                          Resolved {formatDate(incident.resolved_at)}
                        </span>
                      </>
                    )}
                    {incident.related_event_uris && incident.related_event_uris.length > 0 && (
                      <>
                        <span style={{ opacity: 0.4 }}>{'\u00b7'}</span>
                        <span>{incident.related_event_uris.length} related event{incident.related_event_uris.length !== 1 ? 's' : ''}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {(hasPrev || hasNext) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1rem',
            marginTop: '2rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border)',
          }}
        >
          {hasPrev && (
            <a
              href={`/incidents?${activeStatus ? `status=${activeStatus}&` : ''}page=${page - 1}`}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--fg)',
                fontSize: '0.8125rem',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              {'\u2190'} Newer
            </a>
          )}
          <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)' }}>
            Page {page} of {totalPages}
          </span>
          {hasNext && (
            <a
              href={`/incidents?${activeStatus ? `status=${activeStatus}&` : ''}page=${page + 1}`}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--fg)',
                fontSize: '0.8125rem',
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              Older {'\u2192'}
            </a>
          )}
        </div>
      )}
    </div>
  )
}
