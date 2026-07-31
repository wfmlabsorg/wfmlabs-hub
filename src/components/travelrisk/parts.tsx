import React from 'react'
import { NEUTRAL, NEUTRAL_DIM, NEUTRAL_LINE, NEUTRAL_FILL, levelColor } from '@/lib/scoreState'

/**
 * Presentational parts for the travelrisk surface (hub-047).
 *
 * Mission Control theme. NO ORANGE (#f97316) — hub-041 took four gate-rounds to
 * clear it. Severity uses the hazard ramp (red / yellow / green); CONFIDENCE and
 * COVERAGE use neutral slate, so uncertainty is never mistaken for calm and calm
 * is never mistaken for a hazard.
 *
 * Traceability Standard gate 2: every number on this surface is rendered beside
 * a <Trace> naming its source, its rule version and when it was last checked.
 */

export const MONO = "'IBM Plex Mono', monospace"

// ── Panel ──────────────────────────────────────────────────────────────────

export function Panel({
  id, title, subtitle, accent = '#22d3ee', right, children,
}: {
  id?: string
  title: string
  subtitle?: string
  accent?: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderTop: `2px solid ${accent}`,
        borderRadius: 'var(--radius-lg)',
        marginBottom: '1.25rem',
        overflow: 'hidden',
      }}
    >
      <header
        style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          gap: '0.75rem', flexWrap: 'wrap',
          padding: '0.875rem 1.125rem',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>{title}</h2>
          {subtitle && (
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
              {subtitle}
            </p>
          )}
        </div>
        {right}
      </header>
      <div style={{ padding: '1rem 1.125rem 1.125rem' }}>{children}</div>
    </section>
  )
}

// ── Trace line (Traceability gate 2) ───────────────────────────────────────

export function Trace({ items }: { items: (string | null | undefined)[] }) {
  const parts = items.filter(Boolean) as string[]
  if (parts.length === 0) return null
  return (
    <div
      style={{
        fontFamily: MONO, fontSize: '0.625rem', color: NEUTRAL_DIM,
        letterSpacing: '0.02em', lineHeight: 1.6, marginTop: '0.5rem',
        overflowWrap: 'anywhere',
      }}
    >
      {parts.join('  ·  ')}
    </div>
  )
}

// ── State chip — the CONFIDENCE axis, always neutral ───────────────────────

export function StateChip({
  state, title, compact,
}: {
  state: string | null
  title?: string
  compact?: boolean
}) {
  if (!state) return null
  const provisional = state === 'PROVISIONAL'
  return (
    <span
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
        fontFamily: MONO,
        fontSize: compact ? '0.5625rem' : '0.625rem',
        fontWeight: 700, letterSpacing: '0.08em',
        padding: compact ? '0.0625rem 0.3rem' : '0.125rem 0.4rem',
        borderRadius: '3px',
        border: `1px ${provisional ? 'dashed' : 'solid'} ${NEUTRAL_LINE}`,
        background: NEUTRAL_FILL,
        color: NEUTRAL,
        cursor: title ? 'help' : undefined,
        whiteSpace: 'nowrap',
      }}
    >
      {provisional ? 'PROV' : 'SETTLED'}
    </span>
  )
}

// ── Level pill — the HAZARD axis ───────────────────────────────────────────

export function LevelPill({ level, score }: { level: string | null; score: number | null }) {
  const c = levelColor(level)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.4rem', whiteSpace: 'nowrap' }}>
      <span style={{ fontFamily: MONO, fontSize: '1.125rem', fontWeight: 700, color: c, fontVariantNumeric: 'tabular-nums' }}>
        {score === null ? '—' : score.toFixed(1)}
      </span>
      <span
        style={{
          fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.09em',
          color: c, border: `1px solid ${c}`, borderRadius: '3px', padding: '0.0625rem 0.3rem',
        }}
      >
        {level || 'UNKNOWN'}
      </span>
    </span>
  )
}

// ── Gap notice — "we have not built/published this yet" ────────────────────
//
// Deliberately NOT <DataUnavailable/> (amber, "the feed is down"). A gap is a
// known, named absence with an owner. Neutral slate, stated plainly, never
// dressed up as an all-clear and never disguised as an outage.

export function GapNotice({
  title, detail, owner,
}: {
  title: string
  detail: string
  owner?: string
}) {
  return (
    <div
      style={{
        border: `1px dashed ${NEUTRAL_LINE}`,
        background: NEUTRAL_FILL,
        borderRadius: 'var(--radius)',
        padding: '0.875rem 1rem',
      }}
    >
      <div
        style={{
          fontFamily: MONO, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.09em',
          textTransform: 'uppercase', color: NEUTRAL, marginBottom: '0.375rem',
        }}
      >
        ◌ Not yet published
      </div>
      <p style={{ margin: '0 0 0.375rem', fontSize: '0.875rem', fontWeight: 600 }}>{title}</p>
      <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.55 }}>{detail}</p>
      {owner && <Trace items={[`owner: ${owner}`]} />}
    </div>
  )
}

// ── Three-state coverage bar (degraded / nominal-checked / unknown) ────────
//
// The honesty rule (TRAVELRISK-SITE-SPEC §3): an airport we did not check must
// never render as an airport that is fine. Three states, three treatments —
// unknown gets the neutral hatch, never the calm green.

export function CoverageBar({
  degraded, nominal, unknown,
}: {
  degraded: number
  nominal: number
  unknown: number
}) {
  const total = Math.max(1, degraded + nominal + unknown)
  const seg = (n: number, color: string, dashed = false) => ({
    width: `${(n / total) * 100}%`,
    background: dashed ? NEUTRAL_FILL : color,
    borderRight: '1px solid var(--bg-card)',
    ...(dashed ? { backgroundImage: `repeating-linear-gradient(45deg, ${NEUTRAL_LINE} 0 3px, transparent 3px 6px)` } : {}),
  })
  return (
    <div style={{ display: 'flex', height: '0.5rem', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--border)' }}>
      <div style={seg(degraded, '#ef4444')} title={`${degraded} degraded`} />
      <div style={seg(nominal, '#10b981')} title={`${nominal} nominal (checked)`} />
      <div style={seg(unknown, NEUTRAL, true)} title={`${unknown} unknown / not covered`} />
    </div>
  )
}

export function StatTile({
  label, value, sub, color = 'var(--fg)', hatched,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
  hatched?: boolean
}) {
  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: `1px ${hatched ? 'dashed' : 'solid'} ${hatched ? NEUTRAL_LINE : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding: '0.625rem 0.75rem',
        minWidth: 0,
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: NEUTRAL_DIM }}>
        {label}
      </div>
      <div style={{ fontFamily: MONO, fontSize: '1.25rem', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', lineHeight: 1.4 }}>{sub}</div>}
    </div>
  )
}

export function TileGrid({ children, min = '9rem' }: { children: React.ReactNode; min?: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}, 1fr))`, gap: '0.625rem' }}>
      {children}
    </div>
  )
}
