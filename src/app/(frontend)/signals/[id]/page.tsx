import React from 'react'
import { notFound } from 'next/navigation'
import { getPool } from '@/lib/db'
import { getSignalEvidence } from '@/lib/evidence'
import { SignalEvidencePanel } from '@/components/signals/SignalEvidencePanel'

export const dynamic = 'force-dynamic'

// ── Types ──

interface SignalRow {
  id: number
  signal_type: string | null
  title: string | null
  message: string | null
  source: string | null
  severity: number | null
  severity_label: string | null
  category: string | null
  region_name: string | null
  created_at: string
}

// ── Presentation helpers (Mission Control — no orange) ──

const categoryColors: Record<string, string> = {
  weather: '#3b82f6',
  seismic: '#22d3ee',
  disaster: '#06b6d4',
  events: '#64748b',
  cyber: '#22c55e',
  infrastructure: '#8b5cf6',
  health: '#ec4899',
  financial: '#0ea5e9',
  environmental: '#14b8a6',
  geopolitical: '#a78bfa',
  travel: '#38bdf8',
  labor: '#818cf8',
  supply_chain: '#2dd4bf',
  general: '#64748b',
}

const severityColors: Record<string, string> = {
  extreme: '#ef4444',
  severe: '#eab308',
  moderate: '#22d3ee',
  info: '#64748b',
}

function catLabel(cat: string | null): string {
  if (!cat) return 'Signal'
  return cat.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function fmtUTC(date: string): string {
  return (
    new Date(date).toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }) + ' UTC'
  )
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

async function fetchSignal(id: number): Promise<SignalRow | null> {
  const pool = getPool()
  const result = await pool.query(
    `SELECT id, signal_type, title, message, source, severity, severity_label,
            category::text AS category, region_name, created_at
       FROM signals
      WHERE id = $1
      LIMIT 1`,
    [id],
  )
  return (result.rows[0] as SignalRow) || null
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const numId = parseInt(id, 10)
  if (!Number.isFinite(numId)) return { title: 'Signal Not Found — WFM Labs Hub' }
  const sig = await fetchSignal(numId).catch(() => null)
  if (!sig) return { title: 'Signal Not Found — WFM Labs Hub' }
  return { title: `Signal: ${sig.title || catLabel(sig.category)} — WFM Labs Hub` }
}

export default async function SignalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const numId = parseInt(id, 10)
  if (!Number.isFinite(numId)) notFound()

  const signal = await fetchSignal(numId).catch(() => null)
  if (!signal) notFound()

  // Evidence chain (best-effort; null/absent for un-instrumented or pre-migration signals).
  const evidence = await getSignalEvidence(signal.id)

  const catColor = categoryColors[signal.category || 'general'] || '#22d3ee'
  const sevColor = severityColors[(signal.severity_label || '').toLowerCase()] || '#22d3ee'

  return (
    <div style={{ maxWidth: '50rem', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      {/* Breadcrumb */}
      <nav style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)', marginBottom: '1.5rem' }}>
        <a href="/" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>
          Home
        </a>
        {' / '}
        <a href="/signals" style={{ color: 'var(--fg-muted)', textDecoration: 'none' }}>
          Signals
        </a>
        {' / '}
        <span style={{ color: 'var(--fg)' }}>#{signal.id}</span>
      </nav>

      {/* Badges */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '0.75rem',
        }}
      >
        <a
          href={`/signals?category=${encodeURIComponent(signal.category || '')}`}
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            padding: '0.2rem 0.6rem',
            borderRadius: '0.25rem',
            color: catColor,
            border: `1px solid ${catColor}`,
            background: `${catColor}1a`,
            textDecoration: 'none',
          }}
        >
          {catLabel(signal.category)}
        </a>
        {signal.severity_label && (
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              padding: '0.2rem 0.6rem',
              borderRadius: '0.25rem',
              color: sevColor,
              border: `1px solid ${sevColor}`,
              background: `${sevColor}1a`,
            }}
          >
            {signal.severity_label}
            {signal.severity != null ? ` · ${signal.severity}` : ''}
          </span>
        )}
        <span style={{ fontSize: '0.8125rem', color: 'var(--fg-faint)', marginLeft: 'auto' }}>
          {timeAgo(signal.created_at)}
        </span>
      </div>

      {/* Title */}
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--fg)', margin: '0 0 1rem', lineHeight: 1.3 }}>
        {signal.title || catLabel(signal.category)}
      </h1>

      {/* Message */}
      {signal.message && (
        <p style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
          {signal.message}
        </p>
      )}

      {/* Meta grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))',
          gap: '0.75rem',
          padding: '1rem',
          border: '1px solid var(--border, rgba(34,211,238,0.15))',
          borderRadius: '0.5rem',
          background: 'rgba(34,211,238,0.03)',
        }}
      >
        <Meta label="Region" value={signal.region_name || '—'} />
        <Meta label="Category" value={catLabel(signal.category)} />
        <Meta
          label="Severity"
          value={
            signal.severity_label
              ? `${signal.severity_label}${signal.severity != null ? ` (${signal.severity})` : ''}`
              : signal.severity != null
                ? String(signal.severity)
                : '—'
          }
        />
        <Meta label="Source" value={signal.source || '—'} />
        <Meta label="Detected (UTC)" value={fmtUTC(signal.created_at)} />
        <Meta label="Signal ID" value={`#${signal.id}`} />
      </div>

      {/* Evidence / Why this is a signal */}
      <div style={{ marginTop: '2rem' }}>
        <SignalEvidencePanel evidence={evidence} />
      </div>

      {/* Back to feed */}
      <div style={{ marginTop: '1.5rem' }}>
        <a
          href={`/signals?category=${encodeURIComponent(signal.category || '')}`}
          style={{ color: 'var(--accent, #22d3ee)', textDecoration: 'none', fontSize: '0.875rem' }}
        >
          ← View all {catLabel(signal.category)} signals
        </a>
      </div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: '0.6875rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--fg-faint)',
          marginBottom: '0.2rem',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: '0.875rem', color: 'var(--fg)' }}>{value}</div>
    </div>
  )
}
