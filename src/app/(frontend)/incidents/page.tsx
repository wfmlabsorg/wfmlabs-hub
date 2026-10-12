import React from 'react'
import { isMobile } from '@/lib/mobile'
import { neonQuery } from '@/lib/neon'
import { DESK_API_BASE } from '@/lib/desk'
import { AutoRefresh } from '@/components/AutoRefresh'
import { DataUnavailable } from '@/components/DataUnavailable'

export const metadata = { title: 'Incidents — WFM Labs Hub' }
export const dynamic = 'force-dynamic'

/**
 * The incidents page is the desk page: one list, each row labelled by its rung on the ladder.
 *
 *   WATCHING  a layer-1 desk item at severity ≥ 6 that no open incident covers (rung 2, desk-api /desk/items)
 *   OPEN      an incident is open — a desk rule fired at severity ≥ 5, or Watchkeeper declared it (rung 4)
 *   ALERTED   the incident reached Ted by push or email (rung 5, incident_timeline action 'alerted')
 *
 * Open incidents sort by SEV, then latest activity. Recently closed sits below for 72 h.
 */

// ── Types ──

interface OpenIncident {
  id: number
  title: string
  slug: string
  sev_level: string | null
  status: string
  declared_by: string | null
  declared_at: string
  last_at: string
  location_name: string | null
  location_country: string | null
  impact_summary: string | null
  description: string | null
  proposal_rule: string | null
  item_ids: string[] | null
  signal_ids: number[] | null
  alerted_at: string | null
  alerted_via: string | null
}

interface ClosedIncident {
  id: number
  title: string
  slug: string
  sev_level: string | null
  closed_at: string
  close_reason: string | null
}

interface DeskItem {
  item_id: string
  class: string
  layer: number
  severity: number
  title: string
  why: string | null
  place: string | null
  seen_at: string | null
  href: string | null
  members?: string[] | null
  source: string | null
}

// ── Design tokens ──

const sevConfig: Record<string, { color: string; bg: string; pulse?: boolean }> = {
  SEV1: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', pulse: true },
  SEV2: { color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  SEV3: { color: '#eab308', bg: 'rgba(234,179,8,0.08)' },
  SEV4: { color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
}

const rungConfig = {
  alerted: { label: 'ALERTED', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', note: 'reached you by push or email' },
  open: { label: 'OPEN', color: '#22d3ee', bg: 'rgba(34,211,238,0.1)', note: 'opened, no alert sent' },
  watching: { label: 'WATCHING', color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', note: 'strong signal, no incident' },
} as const

const mono = "'IBM Plex Mono', monospace"
const WATCH_MIN_SEV = 6
const WATCH_LIMIT = 15
const CLOSED_WINDOW_H = 72
/** A hung desk-api must not hang the page: on timeout the Watching section says the feed is unreachable. */
const DESK_TIMEOUT_MS = 5000

// ── Helpers ──

function ago(ts: string | null): string {
  if (!ts) return ''
  const m = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60000))
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

function ruleLabel(inc: OpenIncident): string {
  if (inc.declared_by?.startsWith('desk-rules') && inc.proposal_rule) return inc.proposal_rule.split(':')[0].replace(/_/g, ' ')
  if (inc.declared_by?.startsWith('desk-rules')) return 'desk rule'
  return inc.declared_by || 'watchkeeper'
}

function place(inc: OpenIncident): string | null {
  const parts = [inc.location_name, inc.location_country].filter((x): x is string => !!x && x.trim() !== '')
  if (parts.length === 2 && parts[0].includes(parts[1])) return parts[0]
  return parts.length ? parts.join(', ') : null
}

function sevRank(s: string | null): number {
  return s === 'SEV1' ? 1 : s === 'SEV2' ? 2 : s === 'SEV3' ? 3 : s === 'SEV4' ? 4 : 5
}

function alertLine(inc: OpenIncident): string {
  if (!inc.alerted_at) return 'no alert sent'
  // Backfilled rows (schema/062) carry no real send time, so they show no time.
  if (!(inc.alerted_via || '').startsWith('Alerted by ')) return 'alert sent'
  return `${(inc.alerted_via || '').slice('Alerted by '.length)} · ${ago(inc.alerted_at)}`
}

function Chip({ label, color, bg, pulse }: { label: string; color: string; bg: string; pulse?: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        fontSize: '0.6875rem',
        fontWeight: 700,
        fontFamily: mono,
        letterSpacing: '0.05em',
        padding: '0.175rem 0.5rem',
        borderRadius: '4px',
        background: bg,
        border: `1px solid ${color}55`,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {pulse && (
        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: color, animation: 'pulse 2s ease-in-out infinite' }} />
      )}
      {label}
    </span>
  )
}

function SectionTitle({ children, count }: { children: React.ReactNode; count: number }) {
  return (
    <h2
      style={{
        fontSize: '0.8125rem',
        fontWeight: 700,
        fontFamily: mono,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--fg-muted)',
        margin: '2rem 0 0.75rem',
      }}
    >
      {children} <span style={{ opacity: 0.7 }}>({count})</span>
    </h2>
  )
}

// ── Data ──

async function loadOpen(): Promise<OpenIncident[]> {
  const { rows } = await neonQuery<OpenIncident>(
    `SELECT i.id, i.title, i.slug, i.sev_level, i.status, i.declared_by, i.declared_at::text AS declared_at,
            coalesce(i.last_material_event_at, i.declared_at)::text AS last_at,
            i.location_name, i.location_country, i.impact_summary, i.description, i.proposal_rule,
            CASE WHEN jsonb_typeof(i.proposal_payload->'item_ids') = 'array' THEN i.proposal_payload->'item_ids' END AS item_ids,
            to_jsonb(i.related_signal_ids) AS signal_ids,
            a.created_at::text AS alerted_at, a.details AS alerted_via
       FROM incidents i
       LEFT JOIN LATERAL (
         SELECT t.created_at, t.details FROM incident_timeline t
          WHERE t.incident_id = i.id AND t.action = 'alerted'
          ORDER BY t.created_at ASC LIMIT 1
       ) a ON true
      WHERE i.status NOT IN ('closed', 'resolved', 'proposed', 'dismissed')
      ORDER BY coalesce(i.last_material_event_at, i.declared_at) DESC`,
  )
  return rows.sort((a, b) => sevRank(a.sev_level) - sevRank(b.sev_level) || b.last_at.localeCompare(a.last_at))
}

async function loadClosed(): Promise<ClosedIncident[]> {
  const { rows } = await neonQuery<ClosedIncident>(
    `SELECT id, title, slug, sev_level, closed_at::text AS closed_at, close_reason
       FROM incidents
      WHERE status = 'closed' AND closed_at > now() - interval '${CLOSED_WINDOW_H} hours'
        AND coalesce(close_reason, '') <> 'duplicate'
      ORDER BY closed_at DESC LIMIT 15`,
  )
  return rows
}

/** Rung 2: strong layer-1 desk items that no open incident covers. Null when desk-api is unreachable. */
async function loadWatching(open: OpenIncident[]): Promise<DeskItem[] | null> {
  try {
    const res = await fetch(
      `${DESK_API_BASE}/desk/items?class=event,hazard,delay&min_sev=${WATCH_MIN_SEV}&hours=24&limit=100`,
      { cache: 'no-store', signal: AbortSignal.timeout(DESK_TIMEOUT_MS) },
    )
    if (!res.ok) return null
    const { items } = (await res.json()) as { items: DeskItem[] }
    const covered = new Set<string>()
    for (const inc of open) {
      for (const id of inc.item_ids ?? []) covered.add(String(id))
      // Desk incidents are covered by their OWN items only: Watchkeeper's refresh pass attaches same-domain
      // neighbours to related_signal_ids (a hurricane and a Panama quake rode on the Riyadh attack), and those
      // must stay visible here. Watchkeeper-declared incidents have no item_ids, so their signals count.
      if (!inc.declared_by?.startsWith('desk-rules')) for (const n of inc.signal_ids ?? []) covered.add(`signal:${n}`)
    }
    const coveredTitles = new Set(open.map((i) => i.title.trim().toLowerCase()))
    return items
      .filter((d) => d.layer === 1)
      .filter((d) => ![d.item_id, ...(d.members ?? [])].some((id) => covered.has(id)))
      .filter((d) => !coveredTitles.has(d.title.trim().toLowerCase()))
      .slice(0, WATCH_LIMIT)
  } catch {
    return null
  }
}

// ── Page ──

export default async function IncidentsPage() {
  const mobile = await isMobile()

  let open: OpenIncident[]
  let closed: ClosedIncident[]
  try {
    ;[open, closed] = await Promise.all([loadOpen(), loadClosed()])
  } catch {
    return (
      <div style={{ maxWidth: '72rem', margin: '0 auto', padding: mobile ? '1rem 0.75rem 3rem' : '2rem 1rem 4rem' }}>
        <AutoRefresh />
        <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, margin: '0 0 1rem' }}>Incidents</h1>
        <DataUnavailable
          title="Incident data temporarily unavailable"
          detail="The incident feed could not be reached just now. This is a connection issue, not an all-clear — incidents may still be active. Please refresh in a moment."
        />
      </div>
    )
  }
  const watching = await loadWatching(open)

  const alertedCount = open.filter((i) => i.alerted_at).length
  const counts = { alerted: alertedCount, open: open.length - alertedCount, watching: watching?.length ?? 0 }

  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto', padding: mobile ? '1rem 0.75rem 3rem' : '2rem 1rem 4rem' }}>
      <AutoRefresh />

      {/* Header */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, margin: '0 0 0.5rem' }}>Incidents</h1>
        <p style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', margin: 0 }}>
          What could disrupt business travel right now — air, hotel, rail and ground — labelled by how far up the ladder it
          has climbed. <a href="/incidents/rules" style={{ color: '#22d3ee' }}>How incidents open</a>
        </p>
      </div>

      {/* Rung strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {(['alerted', 'open', 'watching'] as const).map((k, i) => {
          const cfg = rungConfig[k]
          return (
            <a
              key={k}
              href={k === 'watching' ? '#watching' : '#open'}
              style={{
                padding: mobile ? '0.75rem 0.5rem' : '0.875rem 1rem',
                borderLeft: i ? '1px solid var(--border)' : 'none',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div style={{ fontSize: mobile ? '1.375rem' : '1.75rem', fontWeight: 800, fontFamily: mono, color: cfg.color }}>
                {k === 'watching' && watching === null ? '–' : counts[k]}
              </div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, fontFamily: mono, letterSpacing: '0.08em', color: cfg.color }}>
                {cfg.label}
              </div>
              {!mobile && <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginTop: '0.125rem' }}>{cfg.note}</div>}
            </a>
          )
        })}
      </div>

      {/* Open incidents — one list, rung on every row */}
      <div id="open">
        <SectionTitle count={open.length}>Open incidents</SectionTitle>
        {open.length === 0 ? (
          <div className="card" style={{ padding: '1.5rem', color: 'var(--fg-muted)', fontSize: '0.875rem' }}>
            No open incidents. The desk opens one when a rule fires at severity 5 or above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {open.map((inc) => {
              const sc = sevConfig[inc.sev_level ?? ''] ?? sevConfig.SEV4
              const rung = inc.alerted_at ? rungConfig.alerted : rungConfig.open
              const where = place(inc)
              const summary = inc.impact_summary || inc.description
              return (
                <a
                  key={inc.id}
                  href={`/incidents/${inc.slug}`}
                  className="card"
                  style={{ display: 'flex', overflow: 'hidden', borderRadius: 'var(--radius-lg)', textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ width: '4px', background: sc.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0, padding: mobile ? '0.75rem 0.875rem' : '0.875rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
                      <Chip label={inc.sev_level ?? 'SEV?'} color={sc.color} bg={sc.bg} pulse={sc.pulse} />
                      <Chip label={rung.label} color={rung.color} bg={rung.bg} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', fontFamily: mono }}>{alertLine(inc)}</span>
                      <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--fg-muted)' }}>
                        opened {ago(inc.declared_at)}
                        {inc.last_at !== inc.declared_at ? ` · active ${ago(inc.last_at)}` : ''}
                      </span>
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.35, marginBottom: '0.25rem' }}>{inc.title}</div>
                    {summary && (
                      <div
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--fg-muted)',
                          lineHeight: 1.45,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {summary}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.375rem', fontSize: '0.75rem', color: 'var(--fg-muted)', fontFamily: mono }}>
                      {where && <span>{where}</span>}
                      <span>rule: {ruleLabel(inc)}</span>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>

      {/* Watching — rung 2 */}
      <div id="watching">
        <SectionTitle count={watching?.length ?? 0}>Watching</SectionTitle>
        <p style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', margin: '-0.25rem 0 0.75rem' }}>
          Travel signals at severity {WATCH_MIN_SEV}+ in the last 24 hours that no open incident covers. None of these has met
          an opening rule.
        </p>
        {watching === null ? (
          <div className="card" style={{ padding: '1rem 1.25rem', color: 'var(--fg-muted)', fontSize: '0.8125rem' }}>
            The desk feed could not be reached just now, so the watch list is not shown. This is not an all-clear.
          </div>
        ) : watching.length === 0 ? (
          <div className="card" style={{ padding: '1rem 1.25rem', color: 'var(--fg-muted)', fontSize: '0.8125rem' }}>
            Nothing strong outside the open incidents.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {watching.map((d) => {
              const body = (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.625rem', flexWrap: mobile ? 'wrap' : 'nowrap', padding: '0.625rem 1rem' }}>
                  <Chip label={rungConfig.watching.label} color={rungConfig.watching.color} bg={rungConfig.watching.bg} />
                  <span style={{ fontFamily: mono, fontSize: '0.75rem', fontWeight: 700, color: d.severity >= 8 ? '#f97316' : '#eab308' }}>
                    {Number(d.severity).toFixed(1)}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: mobile ? 'normal' : 'nowrap',
                    }}
                  >
                    {d.title}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                    {[d.place, d.class, ago(d.seen_at)].filter(Boolean).join(' · ')}
                  </span>
                </div>
              )
              return d.href ? (
                <a key={d.item_id} href={d.href} className="card" style={{ textDecoration: 'none', color: 'inherit', borderRadius: 'var(--radius-lg)' }}>
                  {body}
                </a>
              ) : (
                <div key={d.item_id} className="card" style={{ borderRadius: 'var(--radius-lg)' }}>
                  {body}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Recently closed */}
      <div id="closed">
        <SectionTitle count={closed.length}>Closed in the last {CLOSED_WINDOW_H} hours</SectionTitle>
        {closed.length === 0 ? (
          <div style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>None.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {closed.map((c) => {
              const sc = sevConfig[c.sev_level ?? ''] ?? sevConfig.SEV4
              return (
                <a
                  key={c.id}
                  href={`/incidents/${c.slug}`}
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '0.625rem',
                    padding: '0.375rem 0',
                    textDecoration: 'none',
                    color: 'inherit',
                    opacity: 0.7,
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontFamily: mono, fontSize: '0.6875rem', fontWeight: 700, color: sc.color }}>{c.sev_level ?? '—'}</span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.title}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                    {[c.close_reason?.replace(/-/g, ' '), ago(c.closed_at)].filter(Boolean).join(' · ')}
                  </span>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
