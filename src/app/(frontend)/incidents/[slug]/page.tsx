import React from 'react'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { auth } from '@/lib/auth'
import { ChatPanel } from '@/components/chat'
import { IncidentAdminActions } from '@/components/incidents/IncidentAdminActions'
import { IncidentCommunityValidation } from '@/components/incidents/IncidentCommunityValidation'
import { CorroborationBadge, CorroborationSources } from '@/components/incidents/CorroborationBadge'
import { IncidentEvidencePanel } from '@/components/incidents/IncidentEvidencePanel'
import { getIncidentEvidence } from '@/lib/evidence'
import { neonQuery } from '@/lib/neon'
import { DataUnavailable } from '@/components/DataUnavailable'

export const dynamic = 'force-dynamic'

// ── Types ──

interface Incident {
  id: number
  title: string
  slug: string
  description: string | null
  domain: string
  severity: number
  severity_level: string
  sev_level: string
  status: string
  validation_status: string
  validated_by: string | null
  validated_at: string | null
  declared_by: string
  declared_at: string
  escalated_at: string | null
  resolved_at: string | null
  closed_at: string | null
  closed_by: string | null
  close_reason: string | null
  reopened_at: string | null
  reopened_count: number
  location_name: string | null
  location_country: string | null
  location_lat: number | null
  location_lon: number | null
  affected_regions: string[] | null
  affected_workforce_types: string[] | null
  related_event_uris: string[] | null
  related_signal_ids: number[] | null
  notes: string | null
  impact_summary: string | null
  is_persistent: boolean
  last_revalidated_at: string | null
  revalidation_due_at: string | null
  event_count: number
  article_count: number
  community_confirmations: number
  community_denials: number
  corroboration: unknown
  updated_at: string
  created_at: string
}

interface TimelineEntry {
  id: number
  incident_id: number
  action: string
  actor: string
  details: string | null
  old_severity: string | null
  new_severity: string | null
  created_at: string
}

// ── Design tokens ──

const sevConfig: Record<string, { label: string; color: string; bg: string; borderColor: string }> = {
  SEV1: { label: 'SEV1 — Critical', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', borderColor: '#ef4444' },
  SEV2: { label: 'SEV2 — Major', color: '#f87171', bg: 'rgba(248,113,113,0.1)', borderColor: '#f87171' },
  SEV3: { label: 'SEV3 — Elevated', color: '#eab308', bg: 'transparent', borderColor: '#eab308' },
  SEV4: { label: 'SEV4 — Advisory', color: '#64748b', bg: 'transparent', borderColor: '#475569' },
}

const domainColors: Record<string, { bg: string; fg: string; border: string }> = {
  weather: { bg: 'rgba(59,130,246,0.08)', fg: '#60a5fa', border: '#3b82f6' },
  seismic: { bg: 'rgba(244,63,94,0.08)', fg: '#fb7185', border: '#f43f5e' },
  disaster: { bg: 'rgba(239,68,68,0.08)', fg: '#f87171', border: '#ef4444' },
  cyber: { bg: 'rgba(34,197,94,0.08)', fg: '#4ade80', border: '#22c55e' },
  health: { bg: 'rgba(236,72,153,0.08)', fg: '#f472b6', border: '#ec4899' },
  infrastructure: { bg: 'rgba(139,92,246,0.08)', fg: '#a78bfa', border: '#8b5cf6' },
  financial: { bg: 'rgba(245,158,11,0.08)', fg: '#fbbf24', border: '#f59e0b' },
  environmental: { bg: 'rgba(20,184,166,0.08)', fg: '#2dd4bf', border: '#14b8a6' },
  geopolitical: { bg: 'rgba(99,102,241,0.08)', fg: '#818cf8', border: '#6366f1' },
  general: { bg: 'rgba(148,163,184,0.08)', fg: '#94a3b8', border: '#64748b' },
}
const defaultDomain = { bg: 'rgba(148,163,184,0.08)', fg: '#94a3b8', border: '#64748b' }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  detected: { label: 'DETECTED', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
  declared: { label: 'DECLARED', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  open: { label: 'OPEN', color: '#22d3ee', bg: 'rgba(34,211,238,0.1)' },
  validated: { label: 'VALIDATED', color: '#22d3ee', bg: 'rgba(34,211,238,0.1)' },
  escalated: { label: 'ESCALATED', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
  'de-escalated': { label: 'DE-ESCALATED', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  resolving: { label: 'RESOLVING', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  closed: { label: 'CLOSED', color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
  reopened: { label: 'REOPENED', color: '#e879f9', bg: 'rgba(232,121,249,0.1)' },
}

const actionLabels: Record<string, { label: string; color: string; icon: string }> = {
  opened: { label: 'Incident opened', color: '#f59e0b', icon: '\u26a0' },
  validated: { label: 'Severity validated', color: '#22d3ee', icon: '\u2713' },
  escalated: { label: 'Escalated', color: '#ef4444', icon: '\u2191' },
  'de-escalated': { label: 'De-escalated', color: '#10b981', icon: '\u2193' },
  note_added: { label: 'Note added', color: '#94a3b8', icon: '\u270e' },
  revalidated: { label: 'Revalidated', color: '#3b82f6', icon: '\u21bb' },
  resolving: { label: 'Entering resolution', color: '#3b82f6', icon: '\u23f3' },
  closed: { label: 'Incident closed', color: '#64748b', icon: '\u2716' },
  reopened: { label: 'Incident reopened', color: '#e879f9', icon: '\u21ba' },
  community_confirm: { label: 'Community confirmation', color: '#10b981', icon: '\u2714' },
  community_deny: { label: 'Community denial', color: '#ef4444', icon: '\u2718' },
  escalation_flagged: { label: 'Flagged for escalation', color: '#f87171', icon: '\u2691' },
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

function formatDateTime(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }) + ' UTC'
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  try {
    const { rows } = await neonQuery<{ title: string; sev_level: string }>(
      'SELECT title, sev_level FROM incidents WHERE slug = $1 LIMIT 1',
      [slug],
    )
    if (!rows[0]) return { title: 'Incident Not Found — WFM Labs Hub' }
    return { title: `${rows[0].sev_level}: ${rows[0].title} — WFM Labs Hub` }
  } catch {
    return { title: 'Incident — WFM Labs Hub' }
  }
}

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const session = await auth()

  // Fetch incident — a transient Neon failure renders a visible degraded state
  // instead of a 500 (and is kept distinct from a genuine 404).
  let incidentRows: Incident[] | null = null
  try {
    const { rows } = await neonQuery<Incident>(
      'SELECT * FROM incidents WHERE slug = $1 LIMIT 1',
      [slug],
    )
    incidentRows = rows
  } catch (e) {
    console.error('incident detail: live data fetch failed:', e)
  }

  if (!incidentRows) {
    return (
      <div style={{ maxWidth: '50rem', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
        <nav style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)', marginBottom: '1.5rem' }}>
          <a href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Home</a>
          {' / '}
          <a href="/incidents" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Incidents</a>
        </nav>
        <DataUnavailable
          title="Incident data temporarily unavailable"
          detail="This incident could not be loaded just now. This is a connection issue, not a resolution — please refresh in a moment."
        />
      </div>
    )
  }

  const incident = incidentRows[0]
  if (!incident) notFound()

  // Fetch timeline — degrades to a visible "unavailable" note rather than failing the page.
  const timeline = await neonQuery<TimelineEntry>(
    'SELECT * FROM incident_timeline WHERE incident_id = $1 ORDER BY created_at ASC',
    [incident.id],
  ).then((r) => r.rows).catch((e): TimelineEntry[] | null => {
    console.error('incident detail: timeline fetch failed:', e)
    return null
  })

  // Resolve the viewer's member identity (for admin actions + community vote state).
  const isAdmin = session?.user?.role === 'admin'
  let username = ''
  if (session?.user?.payloadMemberId) {
    const payload = await getPayload({ config })
    const member = await payload
      .findByID({
        collection: 'members',
        id: Number(session.user.payloadMemberId),
        overrideAccess: true,
      })
      .catch(() => null)
    username = (member?.username as string) || ''
  }
  const hasVoted = !!username && (timeline || []).some(
    (t) => t.actor === username && (t.action === 'community_confirm' || t.action === 'community_deny'),
  )

  // Fetch related signals via Payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let relatedSignals: any[] = []
  if (incident.related_signal_ids && incident.related_signal_ids.length > 0) {
    const payload = await getPayload({ config })
    const sigResult = await payload.find({
      collection: 'signals',
      where: { id: { in: incident.related_signal_ids.map(String) } },
      limit: 20,
      sort: '-createdAt',
      depth: 0,
      overrideAccess: true,
    }).catch(() => ({ docs: [] }))
    relatedSignals = sigResult.docs
  }

  // Fetch the evidence chain (best-effort; null/absent for un-instrumented incidents).
  const evidence = await getIncidentEvidence({ id: incident.id, slug: incident.slug })

  const sc = sevConfig[incident.sev_level] || sevConfig.SEV4
  const st = statusConfig[incident.status] || statusConfig.declared
  const dc = domainColors[incident.domain] || defaultDomain
  const isClosed = incident.status === 'closed'
  const age = timeAgo(incident.declared_at)

  return (
    <div style={{ maxWidth: '50rem', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      {/* Breadcrumb */}
      <nav style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)', marginBottom: '1.5rem' }}>
        <a href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Home</a>
        {' / '}
        <a href="/incidents" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>Incidents</a>
        {' / '}
        <span style={{ color: 'var(--fg)' }}>{incident.sev_level}</span>
      </nav>

      {/* ── Header ── */}
      <div style={{ marginBottom: '2rem' }}>
        {/* Badges */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {/* Severity badge */}
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
              background: sc.bg,
              border: `1px solid ${sc.borderColor}`,
              color: sc.color,
            }}
          >
            {sc.label}
          </span>

          {/* Status badge */}
          <span
            style={{
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
            {st.label}
          </span>

          {/* Domain */}
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              fontFamily: "'IBM Plex Mono', monospace",
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              padding: '0.25rem 0.625rem',
              borderRadius: '4px',
              background: dc.bg,
              color: dc.fg,
            }}
          >
            {domainLabel(incident.domain)}
          </span>

          {incident.is_persistent && (
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 600,
                fontFamily: "'IBM Plex Mono', monospace",
                padding: '0.25rem 0.625rem',
                borderRadius: '4px',
                background: 'rgba(245,158,11,0.08)',
                color: '#f59e0b',
                border: '1px solid rgba(245,158,11,0.15)',
              }}
            >
              ONGOING
            </span>
          )}

          {/* Corroboration badge */}
          <CorroborationBadge corroboration={incident.corroboration} />

          {/* Age */}
          <span style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)', marginLeft: 'auto' }}>
            {age}
          </span>
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 'clamp(1.25rem, 3vw, 1.75rem)',
            fontWeight: 800,
            lineHeight: 1.2,
            marginBottom: '0.25rem',
            textDecoration: isClosed ? 'line-through' : 'none',
            textDecorationColor: 'var(--fg-faint)',
          }}
        >
          {incident.title}
        </h1>

        {incident.description && (
          <p style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', lineHeight: 1.5, margin: 0 }}>
            {incident.description}
          </p>
        )}
      </div>

      {/* ── Impact Summary ── */}
      {incident.impact_summary && (
        <div
          style={{
            padding: '1.25rem',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            borderLeft: `3px solid ${sc.color}`,
            marginBottom: '2rem',
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
            Impact Summary
          </div>
          <p style={{ fontSize: '0.9375rem', color: 'var(--fg)', lineHeight: 1.6, margin: 0 }}>
            {incident.impact_summary}
          </p>
        </div>
      )}

      {/* ── Key Facts Panel ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(13rem, 1fr))',
          gap: '0.75rem',
          marginBottom: '2rem',
        }}
      >
        {/* Domain */}
        <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Domain</div>
          <div style={{ fontSize: '0.875rem', fontWeight: 500, color: dc.fg }}>{domainLabel(incident.domain)}</div>
        </div>

        {/* Region */}
        {(incident.location_name || incident.location_country) && (
          <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Region</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
              {[incident.location_name, incident.location_country].filter(Boolean).join(', ')}
            </div>
          </div>
        )}

        {/* Opened by */}
        <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Opened By</div>
          <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{incident.declared_by}</div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)' }}>{formatDateTime(incident.declared_at)}</div>
        </div>

        {/* Validated by */}
        {incident.validated_by && (
          <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Validated By</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>{incident.validated_by}</div>
            {incident.validated_at && (
              <div style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)' }}>{formatDateTime(incident.validated_at)}</div>
            )}
          </div>
        )}

        {/* Event cluster */}
        <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Event Cluster</div>
          <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
            {incident.event_count || 1} event{(incident.event_count || 1) !== 1 ? 's' : ''}
            {(incident.article_count || 0) > 0 && `, ${incident.article_count} article${incident.article_count !== 1 ? 's' : ''}`}
          </div>
        </div>

        {/* OVIX Score */}
        {incident.severity > 0 && (
          <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>OVIX Score</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", color: '#f59e0b' }}>
              {incident.severity.toFixed(1)}
            </div>
          </div>
        )}

        {/* Community */}
        {(incident.community_confirmations > 0 || incident.community_denials > 0) && (
          <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Community</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, display: 'flex', gap: '0.75rem' }}>
              <span style={{ color: '#10b981' }}>{incident.community_confirmations} confirmed</span>
              <span style={{ color: '#ef4444' }}>{incident.community_denials} denied</span>
            </div>
          </div>
        )}

        {/* Closed info */}
        {isClosed && incident.closed_at && (
          <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Closed</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
              {incident.closed_by || 'System'}
              {incident.close_reason && (
                <span style={{ color: 'var(--fg-faint)', marginLeft: '0.375rem' }}>
                  ({incident.close_reason.replace(/_/g, ' ')})
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)' }}>{formatDateTime(incident.closed_at)}</div>
          </div>
        )}

        {/* Affected workforce types */}
        {incident.affected_workforce_types && incident.affected_workforce_types.length > 0 && (
          <div style={{ padding: '0.75rem', background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', gridColumn: 'span 2' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>Affected Workforce</div>
            <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
              {incident.affected_workforce_types.map((wt) => (
                <span
                  key={wt}
                  style={{
                    fontSize: '0.6875rem',
                    fontWeight: 500,
                    padding: '0.175rem 0.5rem',
                    borderRadius: '4px',
                    background: 'var(--accent-light)',
                    color: 'var(--accent)',
                  }}
                >
                  {wt.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Community Validation ── */}
      {!isClosed && (
        <IncidentCommunityValidation
          slug={slug}
          confirmations={incident.community_confirmations}
          denials={incident.community_denials}
          loggedIn={!!session?.user}
          hasVoted={hasVoted}
        />
      )}

      {/* ── Notes ── */}
      {incident.notes && (
        <div style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Notes</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--fg-muted)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
            {incident.notes}
          </p>
        </div>
      )}

      {/* ── Timeline ── */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
          Timeline
          {timeline !== null && timeline.length > 0 && <span style={{ fontWeight: 400, marginLeft: '0.5rem' }}>{timeline.length}</span>}
        </h2>

        {timeline === null ? (
          <DataUnavailable
            title="Timeline temporarily unavailable"
            detail="The timeline feed could not be reached just now — events may exist that are not shown. Please refresh in a moment."
          />
        ) : timeline.length === 0 ? (
          <div
            style={{
              padding: '1.5rem',
              border: '1px dashed var(--border)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--fg-muted)',
              fontSize: '0.875rem',
              textAlign: 'center',
            }}
          >
            No timeline events recorded yet.
          </div>
        ) : (
          <div style={{ position: 'relative', paddingLeft: '1.75rem' }}>
            {/* Vertical line */}
            <div
              style={{
                position: 'absolute',
                left: '0.4375rem',
                top: '0.25rem',
                bottom: '0.25rem',
                width: '2px',
                background: 'var(--border)',
              }}
            />

            {timeline.map((entry, i) => {
              const action = actionLabels[entry.action] || { label: entry.action, color: '#94a3b8', icon: '\u25cf' }
              return (
                <div
                  key={entry.id}
                  style={{
                    position: 'relative',
                    paddingBottom: i < timeline.length - 1 ? '1.25rem' : '0',
                  }}
                >
                  {/* Dot */}
                  <div
                    style={{
                      position: 'absolute',
                      left: '-1.75rem',
                      top: '0.125rem',
                      width: '0.9375rem',
                      height: '0.9375rem',
                      borderRadius: '50%',
                      background: 'var(--bg)',
                      border: `2px solid ${action.color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.5rem',
                    }}
                  >
                    <span style={{ color: action.color }}>{action.icon}</span>
                  </div>

                  {/* Content */}
                  <div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: action.color }}>
                        {action.label}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)' }}>
                        by {entry.actor}
                      </span>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', marginLeft: 'auto' }}>
                        {formatDateTime(entry.created_at)}
                      </span>
                    </div>

                    {/* Severity change */}
                    {entry.old_severity && entry.new_severity && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginTop: '0.125rem' }}>
                        {entry.old_severity} → {entry.new_severity}
                      </div>
                    )}

                    {/* Details */}
                    {entry.details && (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', marginTop: '0.25rem', lineHeight: 1.5 }}>
                        {entry.details}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Evidence / Why this? ── */}
      <IncidentEvidencePanel
        evidence={evidence}
        corroboration={incident.corroboration}
        sevLabel={incident.sev_level}
      />

      {/* ── Related Signals ── */}
      {relatedSignals.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
            Related Signals
            <span style={{ fontWeight: 400, marginLeft: '0.5rem' }}>{relatedSignals.length}</span>
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {relatedSignals.map((sig) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const s = sig as any
              const sigDc = domainColors[s.category || 'general'] || defaultDomain
              return (
                <a
                  key={s.id}
                  href="/signals"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.625rem 1rem',
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <span
                    style={{
                      width: '0.375rem',
                      height: '0.375rem',
                      borderRadius: '50%',
                      background: sigDc.border,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500, flex: 1 }}>
                    {s.title}
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)' }}>
                    {s.source}
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)' }}>
                    {timeAgo(s.createdAt)}
                  </span>
                </a>
              )
            })}
          </div>
        </div>
      )}

      {/* ── External Corroboration ── */}
      <CorroborationSources corroboration={incident.corroboration} />

      {/* ── Affected Regions ── */}
      {incident.affected_regions && incident.affected_regions.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Affected Regions
          </h2>
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {incident.affected_regions.map((region) => (
              <span
                key={region}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  padding: '0.25rem 0.625rem',
                  borderRadius: '9999px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  color: 'var(--fg-muted)',
                }}
              >
                {region}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Admin Actions ── */}
      {isAdmin && (
        <IncidentAdminActions slug={slug} sevLevel={incident.sev_level} status={incident.status} />
      )}

      {/* ── Incident Channel ── */}
      {session?.user && (
        <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
              Incident Channel
            </h2>
            <span
              style={{
                fontSize: '0.6875rem',
                fontFamily: "'IBM Plex Mono', monospace",
                color: 'var(--fg-faint)',
                padding: '0.125rem 0.375rem',
                background: 'var(--bg-secondary)',
                borderRadius: '4px',
                border: '1px solid var(--border)',
              }}
            >
              incident:{slug}
            </span>
          </div>
          <ChatPanel
            channel={`incident:${slug}`}
            style={{ height: '500px' }}
          />
        </div>
      )}
    </div>
  )
}
