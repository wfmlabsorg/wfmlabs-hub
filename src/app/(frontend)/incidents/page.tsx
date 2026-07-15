import React from 'react'
import { isMobile } from '@/lib/mobile'
import { neonQuery } from '@/lib/neon'
import { AutoRefresh } from '@/components/AutoRefresh'
import { DataUnavailable } from '@/components/DataUnavailable'
import { CorroborationBadge } from '@/components/incidents/CorroborationBadge'
import { CoveragePanel, type DistroItem } from '@/components/incidents/CoveragePanel'

export const metadata = { title: 'Incidents — WFM Labs Hub' }
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
  declared_by: string
  declared_at: string
  escalated_at: string | null
  resolved_at: string | null
  closed_at: string | null
  location_name: string | null
  location_country: string | null
  affected_regions: string[] | null
  related_event_uris: string[] | null
  related_signal_ids: number[] | null
  notes: string | null
  impact_summary: string | null
  is_persistent: boolean
  event_count: number
  article_count: number
  validation_status: string
  community_confirmations: number
  community_denials: number
  corroboration: unknown
}

// ── Design tokens ──

const sevConfig: Record<string, { label: string; color: string; bg: string; borderColor: string; pulse?: boolean }> = {
  SEV1: { label: 'SEV1', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', borderColor: '#ef4444', pulse: true },
  SEV2: { label: 'SEV2', color: '#f97316', bg: 'rgba(249,115,22,0.1)', borderColor: '#f97316' },
  SEV3: { label: 'SEV3', color: '#eab308', bg: 'transparent', borderColor: '#eab308' },
  SEV4: { label: 'SEV4', color: '#64748b', bg: 'transparent', borderColor: '#475569' },
}

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
  general: { bg: 'rgba(148,163,184,0.08)', fg: '#94a3b8', border: '#64748b' },
}
const defaultDomain = { bg: 'rgba(148,163,184,0.08)', fg: '#94a3b8', border: '#64748b' }

const statusConfig: Record<string, { label: string; color: string; bg: string; pulse?: boolean }> = {
  detected: { label: 'DETECTED', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
  declared: { label: 'DECLARED', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  open: { label: 'OPEN', color: '#22d3ee', bg: 'rgba(34,211,238,0.1)', pulse: true },
  validated: { label: 'VALIDATED', color: '#22d3ee', bg: 'rgba(34,211,238,0.1)' },
  escalated: { label: 'ESCALATED', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', pulse: true },
  'de-escalated': { label: 'DE-ESCALATED', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  resolving: { label: 'RESOLVING', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  closed: { label: 'CLOSED', color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
  reopened: { label: 'REOPENED', color: '#f97316', bg: 'rgba(249,115,22,0.1)', pulse: true },
}

const domainList = [
  'weather', 'seismic', 'disaster', 'cyber', 'health',
  'infrastructure', 'financial', 'environmental', 'geopolitical', 'general',
]

// Corroboration triage filter — keys map to a SQL predicate on incidents.corroboration.
// 'uncorroborated' deliberately also captures null/absent corroboration (legacy incidents
// + Exa failures) so the triage queue surfaces everything lacking external confirmation.
const corrobConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  corroborated: { label: 'Corroborated', color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
  'single-source': { label: 'Single source', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)' },
  uncorroborated: { label: 'Uncorroborated', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'var(--border-hover)' },
}
const corrobList = ['corroborated', 'single-source', 'uncorroborated']

function corrobPredicate(key: string): string {
  if (key === 'corroborated') return "corroboration->>'status' = 'corroborated'"
  if (key === 'single-source') return "corroboration->>'status' = 'single-source'"
  // uncorroborated bucket = explicit 'uncorroborated' OR no corroboration on record
  return "(corroboration IS NULL OR corroboration->>'status' IS NULL OR corroboration->>'status' NOT IN ('corroborated','single-source'))"
}

// Region bucket (US / non-US / global) as a SQL CASE over a free-text location column.
// Heuristic by design — the goal is at-a-glance skew, not precise geocoding.
function regionBucketCase(col: string): string {
  return `CASE
    WHEN ${col} IS NULL OR btrim(${col}) = '' OR lower(btrim(${col})) IN ('global','worldwide','international','multiple','various') THEN 'global'
    WHEN ${col} ILIKE '%united states%' OR upper(btrim(${col})) IN ('US','USA','U.S.','U.S.A.') OR ${col} ILIKE '%, us' OR ${col} ILIKE '%, usa' THEN 'US'
    ELSE 'non-US'
  END`
}

const regionColors: Record<string, string> = {
  US: '#22d3ee',
  'non-US': '#3b82f6',
  global: '#64748b',
}

interface CoverageData {
  totalSignals: number
  totalOpenIncidents: number
  needsValidation: number
  signalsByRegion: DistroItem[]
  signalsByCategory: DistroItem[]
  incidentsByDomain: DistroItem[]
  incidentsByRegion: DistroItem[]
  corroboration: DistroItem[]
}

const COVERAGE_WINDOW_DAYS = 7

/**
 * Loads the coverage/balance distributions. Wrapped so a query failure degrades to a
 * hidden panel (returns null) instead of breaking the whole incidents page.
 */
async function loadCoverage(): Promise<CoverageData | null> {
  try {
    const win = `created_at > now() - interval '${COVERAGE_WINDOW_DAYS} days'`
    const [
      { rows: sigRegion },
      { rows: sigCategory },
      { rows: incDomain },
      { rows: incRegion },
      { rows: incCorrob },
    ] = await Promise.all([
      neonQuery<{ bucket: string; cnt: string }>(
        `SELECT ${regionBucketCase('region_name')} AS bucket, COUNT(*) AS cnt
           FROM signals WHERE ${win} GROUP BY 1`,
      ),
      neonQuery<{ category: string; cnt: string }>(
        `SELECT category::text AS category, COUNT(*) AS cnt
           FROM signals WHERE ${win} GROUP BY 1 ORDER BY 2 DESC LIMIT 8`,
      ),
      neonQuery<{ domain: string; cnt: string }>(
        "SELECT domain, COUNT(*) AS cnt FROM incidents WHERE status != 'closed' GROUP BY 1 ORDER BY 2 DESC LIMIT 8",
      ),
      neonQuery<{ bucket: string; cnt: string }>(
        `SELECT ${regionBucketCase('location_country')} AS bucket, COUNT(*) AS cnt
           FROM incidents WHERE status != 'closed' GROUP BY 1`,
      ),
      neonQuery<{ bucket: string; cnt: string }>(
        `SELECT CASE
            WHEN corroboration->>'status' = 'corroborated' THEN 'corroborated'
            WHEN corroboration->>'status' = 'single-source' THEN 'single-source'
            ELSE 'uncorroborated'
          END AS bucket, COUNT(*) AS cnt
           FROM incidents WHERE status != 'closed' GROUP BY 1`,
      ),
    ])

    // Region buckets render in a fixed, meaningful order (always show all three).
    const regionOrder = ['US', 'non-US', 'global']
    const mapRegion = (rows: { bucket: string; cnt: string }[], hrefFor?: (b: string) => string): DistroItem[] => {
      const counts: Record<string, number> = {}
      for (const r of rows) counts[r.bucket] = parseInt(r.cnt) || 0
      return regionOrder.map((b) => ({
        label: b,
        count: counts[b] || 0,
        color: regionColors[b] || '#64748b',
        href: hrefFor ? hrefFor(b) : undefined,
      }))
    }

    const signalsByRegion = mapRegion(sigRegion)
    const totalSignals = signalsByRegion.reduce((a, b) => a + b.count, 0)

    const signalsByCategory: DistroItem[] = sigCategory.map((r) => ({
      label: domainLabel(r.category || 'general'),
      count: parseInt(r.cnt) || 0,
      color: (domainColors[r.category] || defaultDomain).fg,
    }))

    const incidentsByDomain: DistroItem[] = incDomain.map((r) => ({
      label: domainLabel(r.domain || 'general'),
      count: parseInt(r.cnt) || 0,
      color: (domainColors[r.domain] || defaultDomain).fg,
      href: `/incidents?domain=${encodeURIComponent(r.domain)}`,
    }))

    const incidentsByRegion = mapRegion(incRegion)

    const corrobCounts: Record<string, number> = {}
    for (const r of incCorrob) corrobCounts[r.bucket] = parseInt(r.cnt) || 0
    const corroboration: DistroItem[] = corrobList.map((k) => ({
      label: corrobConfig[k].label,
      count: corrobCounts[k] || 0,
      color: corrobConfig[k].color,
      href: `/incidents?corrob=${k}`,
    }))

    const totalOpenIncidents = incidentsByDomain.reduce((a, b) => a + b.count, 0)
    const needsValidation = (corrobCounts['uncorroborated'] || 0) + (corrobCounts['single-source'] || 0)

    return {
      totalSignals,
      totalOpenIncidents,
      needsValidation,
      signalsByRegion,
      signalsByCategory,
      incidentsByDomain,
      incidentsByRegion,
      corroboration,
    }
  } catch (e) {
    console.error('coverage load failed:', e)
    return null
  }
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

function buildHref(base: Record<string, string | null>, overrides: Record<string, string | null>): string {
  const merged = { ...base, ...overrides }
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(merged)) {
    if (v) params.set(k, v)
  }
  const qs = params.toString()
  return `/incidents${qs ? `?${qs}` : ''}`
}

// ── Page ──

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sev?: string; domain?: string; corrob?: string; page?: string }>
}) {
  const params = await searchParams
  const mobile = await isMobile()
  const activeSev = params.sev || null
  const activeDomain = params.domain || null
  const activeStatus = params.status || null
  const activeCorrob = params.corrob && corrobList.includes(params.corrob) ? params.corrob : null
  const page = parseInt(params.page || '1')
  const limit = 25
  const offset = (page - 1) * limit

  const filterState = {
    sev: activeSev,
    domain: activeDomain,
    status: activeStatus,
    corrob: activeCorrob,
    page: null as string | null,
  }

  // Build query conditions
  const conditions: string[] = []
  const queryParams: unknown[] = []
  let paramIdx = 1

  // Default: show non-closed incidents (unless specifically filtering for closed)
  if (activeStatus === 'closed') {
    conditions.push("status = 'closed'")
  } else if (activeStatus && Object.keys(statusConfig).includes(activeStatus)) {
    conditions.push(`status = $${paramIdx++}`)
    queryParams.push(activeStatus)
  } else {
    conditions.push("status != 'closed'")
  }

  if (activeSev && ['SEV1', 'SEV2', 'SEV3', 'SEV4'].includes(activeSev)) {
    conditions.push(`sev_level = $${paramIdx++}`)
    queryParams.push(activeSev)
  }
  if (activeDomain && domainList.includes(activeDomain)) {
    conditions.push(`domain = $${paramIdx++}`)
    queryParams.push(activeDomain)
  }
  if (activeCorrob) {
    conditions.push(corrobPredicate(activeCorrob))
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const sortOrder = activeStatus === 'closed'
    ? 'closed_at DESC NULLS LAST, declared_at DESC'
    : "CASE sev_level WHEN 'SEV1' THEN 1 WHEN 'SEV2' THEN 2 WHEN 'SEV3' THEN 3 WHEN 'SEV4' THEN 4 ELSE 5 END, declared_at DESC"

  // A transient Neon failure degrades to a visible "feed down" state instead of
  // erroring the whole page (and instead of silently rendering "no incidents").
  let pageData: {
    incidents: Incident[]
    countRow: { cnt: string } | undefined
    sevRows: { sev_level: string; cnt: string }[]
    persistentIncidents: Incident[]
    recentlyClosed: Incident[]
    coverage: CoverageData | null
  } | null = null
  try {
    const [
      { rows: incidents },
      { rows: [countRow] },
      { rows: sevRows },
      { rows: persistentIncidents },
      { rows: recentlyClosed },
      coverage,
    ] = await Promise.all([
      neonQuery<Incident>(
        `SELECT * FROM incidents ${whereClause} ORDER BY ${sortOrder} LIMIT ${limit} OFFSET ${offset}`,
        queryParams,
      ),
      neonQuery<{ cnt: string }>(
        `SELECT COUNT(*) as cnt FROM incidents ${whereClause}`,
        queryParams,
      ),
      neonQuery<{ sev_level: string; cnt: string }>(
        "SELECT sev_level, COUNT(*) as cnt FROM incidents WHERE status != 'closed' GROUP BY sev_level",
      ),
      neonQuery<Incident>(
        "SELECT * FROM incidents WHERE is_persistent = true AND status != 'closed' ORDER BY declared_at DESC LIMIT 5",
      ),
      activeStatus !== 'closed'
        ? neonQuery<Incident>(
            "SELECT * FROM incidents WHERE status = 'closed' ORDER BY closed_at DESC NULLS LAST LIMIT 10",
          )
        : Promise.resolve({ rows: [] as Incident[], rowCount: 0 }),
      loadCoverage(),
    ])
    pageData = { incidents, countRow, sevRows, persistentIncidents, recentlyClosed, coverage }
  } catch (e) {
    console.error('incidents page: live data fetch failed:', e)
  }

  if (!pageData) {
    return (
      <div style={{ maxWidth: '72rem', margin: '0 auto', padding: mobile ? '1rem 0.75rem 3rem' : '2rem 1rem 4rem' }}>
        <AutoRefresh />
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 800, margin: '0 0 0.5rem' }}>Incidents</h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', margin: 0 }}>
            Validated operational events tracked by Watchkeeper
          </p>
        </div>
        <DataUnavailable
          title="Incident data temporarily unavailable"
          detail="The incident feed could not be reached just now. This is a connection issue, not an all-clear — incidents may still be active. Please refresh in a moment."
        />
      </div>
    )
  }

  const { incidents, countRow, sevRows, persistentIncidents, recentlyClosed, coverage } = pageData

  const totalDocs = parseInt(countRow?.cnt || '0')
  const totalPages = Math.ceil(totalDocs / limit)
  const hasPrev = page > 1
  const hasNext = page < totalPages

  const sevCounts: Record<string, number> = { SEV1: 0, SEV2: 0, SEV3: 0, SEV4: 0 }
  for (const row of sevRows) {
    if (row.sev_level) sevCounts[row.sev_level] = parseInt(row.cnt)
  }
  const totalActive = Object.values(sevCounts).reduce((a, b) => a + b, 0)

  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto', padding: mobile ? '1rem 0.75rem 3rem' : '2rem 1rem 4rem' }}>
      <AutoRefresh />
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
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
          {totalActive > 0 && (
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
              {totalActive} ACTIVE
            </span>
          )}
        </div>
        <p style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', margin: 0 }}>
          Validated operational events tracked by Watchkeeper
        </p>
      </div>

      {/* Severity count bar */}
      <div
        style={{
          display: 'flex',
          gap: '0',
          marginBottom: '1.5rem',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        {(['SEV1', 'SEV2', 'SEV3', 'SEV4'] as const).map((sev) => {
          const cfg = sevConfig[sev]
          const count = sevCounts[sev] || 0
          const isActive = activeSev === sev
          return (
            <a
              key={sev}
              href={buildHref(filterState, { sev: isActive ? null : sev, page: null })}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '0.75rem 0.5rem',
                textDecoration: 'none',
                borderRight: sev !== 'SEV4' ? '1px solid var(--border)' : 'none',
                background: isActive ? cfg.bg : 'transparent',
                transition: 'background 0.15s',
              }}
            >
              <span
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: count > 0 ? cfg.color : 'var(--fg-faint)',
                }}
              >
                {count}
              </span>
              <span
                style={{
                  fontSize: '0.625rem',
                  fontWeight: 600,
                  fontFamily: "'IBM Plex Mono', monospace",
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: isActive ? cfg.color : 'var(--fg-faint)',
                }}
              >
                {cfg.label}
              </span>
            </a>
          )
        })}
      </div>

      {/* Coverage / balance overview */}
      {coverage && (
        <CoveragePanel
          windowDays={COVERAGE_WINDOW_DAYS}
          totalSignals={coverage.totalSignals}
          totalOpenIncidents={coverage.totalOpenIncidents}
          needsValidation={coverage.needsValidation}
          signalsByRegion={coverage.signalsByRegion}
          signalsByCategory={coverage.signalsByCategory}
          incidentsByDomain={coverage.incidentsByDomain}
          incidentsByRegion={coverage.incidentsByRegion}
          corroboration={coverage.corroboration}
        />
      )}

      {/* Filters: domain + status + corroboration */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {/* Domain filter */}
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
            Domain
          </span>
          {domainList.map((d) => {
            const dc = domainColors[d] || defaultDomain
            const isActive = activeDomain === d
            return (
              <a
                key={d}
                href={buildHref(filterState, { domain: isActive ? null : d, page: null })}
                style={{
                  padding: '0.25rem 0.625rem',
                  borderRadius: '9999px',
                  border: `1px solid ${isActive ? dc.border : 'var(--border)'}`,
                  background: isActive ? dc.bg : 'transparent',
                  color: isActive ? dc.fg : 'var(--fg-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <span
                  style={{
                    width: '0.375rem',
                    height: '0.375rem',
                    borderRadius: '50%',
                    background: dc.border,
                    flexShrink: 0,
                  }}
                />
                {domainLabel(d)}
              </a>
            )
          })}
        </div>

        {/* Status filter */}
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
            href={buildHref(filterState, { status: null, page: null })}
            style={{
              padding: '0.25rem 0.625rem',
              borderRadius: '9999px',
              border: '1px solid var(--border)',
              background: !activeStatus ? 'var(--fg)' : 'transparent',
              color: !activeStatus ? 'var(--bg)' : 'var(--fg-muted)',
              fontSize: '0.75rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Active
          </a>
          {Object.entries(statusConfig).map(([key, cfg]) => {
            const isActive = activeStatus === key
            return (
              <a
                key={key}
                href={buildHref(filterState, { status: isActive ? null : key, page: null })}
                style={{
                  padding: '0.25rem 0.625rem',
                  borderRadius: '9999px',
                  border: `1px solid ${isActive ? cfg.color : 'var(--border)'}`,
                  background: isActive ? cfg.bg : 'transparent',
                  color: isActive ? cfg.color : 'var(--fg-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                {cfg.label}
              </a>
            )
          })}
        </div>

        {/* Corroboration triage filter */}
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
            Corroboration
          </span>
          <a
            href={buildHref(filterState, { corrob: null, page: null })}
            style={{
              padding: '0.25rem 0.625rem',
              borderRadius: '9999px',
              border: '1px solid var(--border)',
              background: !activeCorrob ? 'var(--fg)' : 'transparent',
              color: !activeCorrob ? 'var(--bg)' : 'var(--fg-muted)',
              fontSize: '0.75rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            All
          </a>
          {corrobList.map((key) => {
            const cfg = corrobConfig[key]
            const isActive = activeCorrob === key
            return (
              <a
                key={key}
                href={buildHref(filterState, { corrob: isActive ? null : key, page: null })}
                title={
                  key === 'uncorroborated'
                    ? 'Incidents lacking external corroboration — the triage queue to validate'
                    : key === 'single-source'
                      ? 'Only a single external source found'
                      : 'Independently corroborated by reputable external sources'
                }
                style={{
                  padding: '0.25rem 0.625rem',
                  borderRadius: '9999px',
                  border: `1px solid ${isActive ? cfg.border : 'var(--border)'}`,
                  background: isActive ? cfg.bg : 'transparent',
                  color: isActive ? cfg.color : 'var(--fg-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <span
                  style={{
                    width: '0.375rem',
                    height: '0.375rem',
                    borderRadius: '50%',
                    background: cfg.color,
                    flexShrink: 0,
                  }}
                />
                {cfg.label}
              </a>
            )
          })}
        </div>
      </div>

      {/* Persistent Situations */}
      {persistentIncidents.length > 0 && !activeStatus && !activeSev && !activeDomain && !activeCorrob && (
        <div style={{ marginBottom: '2rem' }}>
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
            Ongoing Situations
          </h2>
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              overflowX: 'auto',
              paddingBottom: '0.5rem',
            }}
          >
            {persistentIncidents.map((inc) => {
              const dc = domainColors[inc.domain] || defaultDomain
              const sc = sevConfig[inc.sev_level] || sevConfig.SEV4
              return (
                <a
                  key={inc.id}
                  href={`/incidents/${inc.slug}`}
                  className="card"
                  style={{
                    minWidth: '16rem',
                    maxWidth: '20rem',
                    padding: '1rem',
                    textDecoration: 'none',
                    color: 'inherit',
                    borderLeft: `3px solid ${dc.border}`,
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        fontFamily: "'IBM Plex Mono', monospace",
                        padding: '0.125rem 0.375rem',
                        borderRadius: '4px',
                        border: `1px solid ${sc.borderColor}`,
                        background: sc.bg,
                        color: sc.color,
                      }}
                    >
                      {sc.label}
                    </span>
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        fontFamily: "'IBM Plex Mono', monospace",
                        textTransform: 'uppercase',
                        color: dc.fg,
                      }}
                    >
                      {domainLabel(inc.domain)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, lineHeight: 1.3, marginBottom: '0.375rem' }}>
                    {inc.title}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)' }}>
                    Since {timeAgo(inc.declared_at)} · {inc.event_count || 1} events
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      )}

      {/* Active Incidents */}
      <div style={{ marginBottom: '2rem' }}>
        {activeStatus || activeSev || activeDomain || activeCorrob ? (
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
            {activeStatus === 'closed' ? 'Closed' : 'Filtered'} Incidents
            <span style={{ fontWeight: 400, marginLeft: '0.5rem' }}>{totalDocs}</span>
          </h2>
        ) : (
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
            Active Incidents
            <span style={{ fontWeight: 400, marginLeft: '0.5rem' }}>{totalDocs}</span>
          </h2>
        )}

        {incidents.length === 0 ? (
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
              {activeStatus || activeSev || activeDomain || activeCorrob
                ? 'No incidents matching filters'
                : 'No active incidents'}
            </p>
            <p style={{ fontSize: '0.875rem' }}>
              {activeStatus || activeSev || activeDomain || activeCorrob
                ? 'Try adjusting your filters.'
                : 'Watchkeeper will declare incidents when severity thresholds are met.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {incidents.map((incident) => {
              const dc = domainColors[incident.domain] || defaultDomain
              const st = statusConfig[incident.status] || statusConfig.declared
              const sc = sevConfig[incident.sev_level] || sevConfig.SEV4
              const isClosed = incident.status === 'closed'

              return (
                <a
                  key={incident.id}
                  href={`/incidents/${incident.slug}`}
                  className="card"
                  style={{
                    display: 'flex',
                    overflow: 'hidden',
                    borderRadius: 'var(--radius-lg)',
                    opacity: isClosed ? 0.6 : 1,
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  {/* Severity color band */}
                  <div
                    style={{
                      width: '4px',
                      background: sc.color,
                      flexShrink: 0,
                    }}
                  />

                  <div style={{ flex: 1, padding: '1rem 1.25rem' }}>
                    {/* Badges row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.5rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      {/* Severity badge */}
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
                          background: sc.bg,
                          border: `1px solid ${sc.borderColor}`,
                          color: sc.color,
                        }}
                      >
                        {sc.pulse && (
                          <span
                            style={{
                              width: '5px',
                              height: '5px',
                              borderRadius: '50%',
                              background: sc.color,
                              animation: 'pulse 2s ease-in-out infinite',
                            }}
                          />
                        )}
                        {sc.label}
                      </span>

                      {/* Status badge */}
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

                      {/* Domain badge */}
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          fontFamily: "'IBM Plex Mono', monospace",
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          padding: '0.175rem 0.5rem',
                          borderRadius: '4px',
                          background: dc.bg,
                          color: dc.fg,
                        }}
                      >
                        {domainLabel(incident.domain)}
                      </span>

                      {/* Persistent flag */}
                      {incident.is_persistent && (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            fontFamily: "'IBM Plex Mono', monospace",
                            padding: '0.175rem 0.5rem',
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

                      {/* Timestamp */}
                      <span style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', marginLeft: 'auto' }}>
                        {timeAgo(incident.declared_at)}
                      </span>
                    </div>

                    {/* Title */}
                    <h3
                      style={{
                        fontSize: '0.9375rem',
                        fontWeight: 700,
                        marginBottom: '0.375rem',
                        lineHeight: 1.3,
                      }}
                    >
                      {incident.title}
                    </h3>

                    {/* Impact summary or description */}
                    {(incident.impact_summary || incident.description) && (
                      <p
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--fg-muted)',
                          lineHeight: 1.5,
                          marginBottom: '0.5rem',
                        }}
                      >
                        {(() => {
                          const text = incident.impact_summary || incident.description || ''
                          return text.length > 180 ? text.slice(0, 180) + '...' : text
                        })()}
                      </p>
                    )}

                    {/* Footer meta */}
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
                      {(incident.event_count || 0) > 1 && (
                        <span>
                          {incident.event_count} events
                          {(incident.article_count || 0) > 0 && `, ${incident.article_count} articles`}
                        </span>
                      )}
                      {incident.community_confirmations > 0 && (
                        <span style={{ color: '#10b981' }}>
                          {incident.community_confirmations} confirmed
                        </span>
                      )}
                      <span>
                        Declared {formatDate(incident.declared_at)}
                      </span>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {(hasPrev || hasNext) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1rem',
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border)',
          }}
        >
          {hasPrev ? (
            <a
              href={buildHref(filterState, { page: String(page - 1) })}
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
          ) : (
            <span />
          )}
          <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)' }}>
            Page {page} of {totalPages}
          </span>
          {hasNext ? (
            <a
              href={buildHref(filterState, { page: String(page + 1) })}
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
          ) : (
            <span />
          )}
        </div>
      )}

      {/* Recently Closed (only when not filtering) */}
      {!activeStatus && !activeSev && !activeDomain && !activeCorrob && recentlyClosed.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <details>
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
              Recently Closed ({recentlyClosed.length})
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', marginTop: '0.75rem' }}>
              {recentlyClosed.map((inc) => {
                const dc = domainColors[inc.domain] || defaultDomain
                const sc = sevConfig[inc.sev_level] || sevConfig.SEV4
                return (
                  <a
                    key={inc.id}
                    href={`/incidents/${inc.slug}`}
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
                      opacity: 0.6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        fontFamily: "'IBM Plex Mono', monospace",
                        color: sc.color,
                        minWidth: '2.5rem',
                      }}
                    >
                      {sc.label}
                    </span>
                    <span
                      style={{
                        width: '0.375rem',
                        height: '0.375rem',
                        borderRadius: '50%',
                        background: dc.border,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: '0.8125rem', fontWeight: 500, flex: 1 }}>
                      {inc.title}
                    </span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)' }}>
                      Closed {inc.closed_at ? timeAgo(inc.closed_at) : timeAgo(inc.resolved_at || inc.declared_at)}
                    </span>
                  </a>
                )
              })}
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
