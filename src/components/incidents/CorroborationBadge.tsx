import React from 'react'

// ── Canonical corroboration contract (incidents.corroboration jsonb) ──
// Populated by Watchkeeper (agents-026) after each declared incident.
// {
//   status: "corroborated" | "single-source" | "uncorroborated",
//   checked_at: ISO, query: string, reputable_count: int,
//   sources: [{ title, url, publisher, published? }],
//   error?: string   // present only on Exa failure; sources:[]
// }

export interface CorroborationSource {
  title?: string | null
  url?: string | null
  publisher?: string | null
  published?: string | null
}

export interface Corroboration {
  status?: string | null
  checked_at?: string | null
  query?: string | null
  reputable_count?: number | null
  sources?: CorroborationSource[] | null
  error?: string | null
}

type EffectiveStatus = 'corroborated' | 'single-source' | 'unverified'

/**
 * Defensive parse — corroboration may be null, a JSON string, a partial object,
 * or have an empty/absent sources array. Never throws; returns null when absent.
 */
export function parseCorroboration(raw: unknown): Corroboration | null {
  if (raw == null) return null
  let obj: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    try {
      obj = JSON.parse(trimmed)
    } catch {
      return null
    }
  }
  if (typeof obj !== 'object' || obj === null) return null
  return obj as Corroboration
}

function effectiveStatus(c: Corroboration | null): EffectiveStatus {
  const s = c?.status
  if (s === 'corroborated') return 'corroborated'
  if (s === 'single-source') return 'single-source'
  return 'unverified'
}

function sourceCount(c: Corroboration | null): number {
  if (!c) return 0
  if (typeof c.reputable_count === 'number' && c.reputable_count >= 0) return c.reputable_count
  return Array.isArray(c.sources) ? c.sources.length : 0
}

const badgeConfig: Record<EffectiveStatus, { color: string; bg: string; border: string }> = {
  // Affirmative — emerald (existing "confirmed"/"de-escalated" palette token)
  corroborated: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
  // Caution — amber (existing caution token; used sparingly)
  'single-source': { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
  // Neutral / unknown — muted; do NOT alarm (many incidents predate the feature)
  unverified: { color: 'var(--fg-faint)', bg: 'transparent', border: 'var(--border)' },
}

/**
 * Compact corroboration status chip. Renders on both the /incidents list cards
 * and the detail header. Degrades to a muted "Unverified" chip when corroboration
 * is null/absent/unknown.
 */
export function CorroborationBadge({ corroboration }: { corroboration: unknown }) {
  const c = parseCorroboration(corroboration)
  const status = effectiveStatus(c)
  const cfg = badgeConfig[status]

  let label: string
  if (status === 'corroborated') {
    const n = sourceCount(c)
    label = n > 0 ? `✓ Corroborated · ${n} source${n === 1 ? '' : 's'}` : '✓ Corroborated'
  } else if (status === 'single-source') {
    label = 'Single source'
  } else {
    label = 'Unverified'
  }

  return (
    <span
      title={
        status === 'corroborated'
          ? 'Independently corroborated by reputable external sources'
          : status === 'single-source'
            ? 'Only a single external source found'
            : 'No external corroboration on record'
      }
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
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

function formatDateTime(date: string): string {
  const d = new Date(date)
  if (isNaN(d.getTime())) return date
  return (
    d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }) + ' UTC'
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * Detail-view "External corroboration" section. Lists external sources as links,
 * clearly distinct from internal WFM signals. Shows the checked_at timestamp.
 * If `error` is present, renders a muted "external check unavailable" note
 * (NOT an error state). Renders nothing when corroboration is absent entirely.
 */
export function CorroborationSources({ corroboration }: { corroboration: unknown }) {
  const c = parseCorroboration(corroboration)
  if (!c) return null

  const status = effectiveStatus(c)
  const sources = Array.isArray(c.sources)
    ? c.sources.filter((s): s is CorroborationSource => !!s && typeof s === 'object' && !!s.url)
    : []

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <h2
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--fg-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: 0,
          }}
        >
          External Corroboration
        </h2>
        <CorroborationBadge corroboration={corroboration} />
        {c.checked_at && (
          <span style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', marginLeft: 'auto' }}>
            Checked {formatDateTime(c.checked_at)}
          </span>
        )}
      </div>

      {c.error ? (
        <div
          style={{
            padding: '0.875rem 1rem',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--fg-faint)',
            fontSize: '0.8125rem',
            fontStyle: 'italic',
          }}
        >
          External check unavailable.
        </div>
      ) : sources.length === 0 ? (
        <div
          style={{
            padding: '0.875rem 1rem',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--fg-muted)',
            fontSize: '0.8125rem',
          }}
        >
          {status === 'single-source'
            ? 'A single external source was found, with no additional public link on record.'
            : 'No independent external sources found.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {sources.map((s, i) => {
            const host = s.url ? hostOf(s.url) : ''
            const publisher = s.publisher || host
            return (
              <a
                key={`${s.url}-${i}`}
                href={s.url || '#'}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '0.75rem',
                  padding: '0.625rem 1rem',
                  // Distinct from internal signals: cyan accent left-rule + secondary bg
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  borderLeft: '3px solid var(--accent)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <span style={{ fontSize: '0.8125rem', fontWeight: 500, flex: 1, lineHeight: 1.4 }}>
                  {s.title || s.url}
                  <span style={{ color: 'var(--accent)', marginLeft: '0.375rem', fontSize: '0.75rem' }}>{'↗'}</span>
                </span>
                <span
                  style={{
                    fontSize: '0.6875rem',
                    color: 'var(--fg-faint)',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    gap: '0.5rem',
                    alignItems: 'baseline',
                  }}
                >
                  {publisher && <span>{publisher}</span>}
                  {s.published && <span>{formatDateTime(s.published)}</span>}
                </span>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
