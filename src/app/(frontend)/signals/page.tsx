'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { domainColor } from '@/lib/domainColors'

interface Signal {
  id: number
  signalType: string
  title: string
  message: string
  source: string
  severity?: number
  severityLabel?: string
  category?: string
  regionId?: string
  regionName?: string
  regions?: string[]
  sourceUrl?: string
  createdAt: string
}

// Surface the multi-region spread of a de-duped signal (e.g. one cyber CVE
// collapsed across many cities) without re-listing the primary region.
function extraRegions(sig: Signal): string[] {
  if (!Array.isArray(sig.regions)) return []
  const primary = (sig.regionName || '').trim().toLowerCase()
  const seen = new Set<string>()
  const out: string[] = []
  for (const r of sig.regions) {
    const v = (r || '').trim()
    if (!v) continue
    const key = v.toLowerCase()
    if (key === primary || seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}

// Domain dot colors come from the canonical map (hub-017) — see domainColor().
const domainLabels: Record<string, string> = {
  weather: 'Weather',
  seismic: 'Seismic',
  disaster: 'Disaster',
  infrastructure: 'Infrastructure',
  cyber: 'Cyber',
  health: 'Health',
  financial: 'Financial',
  environmental: 'Environmental',
  geopolitical: 'Geopolitical',
  general: 'General',
  events: 'Events',
  labor: 'Labor',
  supply_chain: 'Supply Chain',
  travel: 'Travel',
}

const categoryIcons: Record<string, string> = {
  weather: '\u26c8',
  seismic: '\u26a0',
  disaster: '\ud83c\udf0a',
  events: '\ud83d\udce1',
  cyber: '\ud83d\udee1',
  infrastructure: '\u26a1',
  health: '\ud83c\udfe5',
  financial: '\ud83d\udcca',
  environmental: '\ud83c\udf3f',
  general: '\u25c6',
  labor: '\ud83d\udc65',
  supply_chain: '\ud83d\udce6',
  travel: '\u2708',
}

const severityBadgeColors: Record<string, { bg: string; fg: string }> = {
  extreme: { bg: '#fecaca', fg: '#991b1b' },
  severe: { bg: '#fef08a', fg: '#854d0e' },
  moderate: { bg: '#bfdbfe', fg: '#1e40af' },
  info: { bg: '#d1fae5', fg: '#065f46' },
}

const filterCategories = [
  'weather',
  'seismic',
  'disaster',
  'infrastructure',
  'cyber',
  'health',
  'financial',
  'environmental',
  'geopolitical',
  'labor',
  'supply_chain',
  'travel',
  'general',
]

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

const severityLevels = [
  { value: 'info', label: 'Info', color: '#10b981' },
  { value: 'moderate', label: 'Moderate', color: '#3b82f6' },
  { value: 'severe', label: 'Severe', color: '#f59e0b' },
  { value: 'extreme', label: 'Extreme', color: '#ef4444' },
]

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeSource, setActiveSource] = useState<string | null>(null)
  const [activeSeverity, setActiveSeverity] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [totalDocs, setTotalDocs] = useState(0)
  const [knownSources, setKnownSources] = useState<string[]>([])

  // Fetch distinct sources on mount
  useEffect(() => {
    fetch('/api/signals?limit=100&page=1')
      .then((r) => r.json())
      .then((data) => {
        const sources = [...new Set((data.docs || []).map((s: Signal) => s.source))].sort() as string[]
        setKnownSources(sources)
      })
      .catch(() => {})
  }, [])

  const fetchSignals = useCallback((category: string | null, source: string | null, severity: string | null, pg: number, silent = false) => {
    if (!silent) setLoading(true)
    const params = new URLSearchParams()
    params.set('limit', '50')
    params.set('page', String(pg))
    if (category) params.set('category', category)
    if (source) params.set('source', source)
    if (severity) params.set('severityLabel', severity)

    fetch(`/api/signals?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setSignals(data.docs || [])
        setHasNextPage(data.hasNextPage || false)
        setTotalDocs(data.totalDocs || 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    setPage(1)
    // Collapse any expanded card — an open card pauses live polling, so a stale
    // expandedId from the previous filter set would silently freeze the feed.
    setExpandedId(null)
    fetchSignals(activeCategory, activeSource, activeSeverity, 1)
  }, [activeCategory, activeSource, activeSeverity, fetchSignals])

  useEffect(() => {
    setExpandedId(null)
    if (page > 1) fetchSignals(activeCategory, activeSource, activeSeverity, page)
  }, [page, activeCategory, activeSource, activeSeverity, fetchSignals])

  // Live refresh — silent refetch with the current filters/page every 60s, so a
  // member watching during an event isn't looking at a frozen list. Skipped while
  // the tab is hidden or a card is expanded (don't clobber what they're reading).
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden || expandedId !== null) return
      fetchSignals(activeCategory, activeSource, activeSeverity, page, true)
    }, 60_000)
    return () => clearInterval(id)
  }, [activeCategory, activeSource, activeSeverity, page, expandedId, fetchSignals])

  return (
    <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1
          style={{
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: 800,
            marginBottom: '0.5rem',
          }}
        >
          Signals
        </h1>
        <p style={{ fontSize: '0.9375rem', color: 'var(--fg-muted)', margin: 0 }}>
          Operational Intelligence Feed
          {!loading && totalDocs > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', marginLeft: '0.75rem' }}>
              {totalDocs.toLocaleString()} {totalDocs === 1 ? 'signal' : 'signals'}
              {!activeCategory && !activeSeverity && !activeSource && (
                <span style={{ marginLeft: '0.5rem', opacity: 0.85 }}>
                  {'·'} de-duplicated by event
                </span>
              )}
            </span>
          )}
        </p>
      </div>

      {/* Filter chips */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          marginBottom: '1.5rem',
        }}
      >
        <button
          onClick={() => setActiveCategory(null)}
          style={{
            padding: '0.375rem 0.875rem',
            borderRadius: '9999px',
            border: '1px solid var(--border)',
            background: activeCategory === null ? 'var(--fg)' : 'transparent',
            color: activeCategory === null ? 'var(--bg)' : 'var(--fg-muted)',
            fontSize: '0.8125rem',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          All
        </button>
        {filterCategories.map((cat) => {
          const color = domainColor(cat)
          const isActive = activeCategory === cat
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(isActive ? null : cat)}
              style={{
                padding: '0.375rem 0.875rem',
                borderRadius: '9999px',
                border: `1px solid ${isActive ? color : 'var(--border)'}`,
                background: isActive ? `${color}15` : 'transparent',
                color: isActive ? color : 'var(--fg-muted)',
                fontSize: '0.8125rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s',
                display: 'flex',
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
                  background: color,
                  flexShrink: 0,
                }}
              />
              {domainLabels[cat]}
            </button>
          )
        })}
      </div>

      {/* Severity + Source filters */}
      <div
        style={{
          display: 'flex',
          gap: '1.5rem',
          flexWrap: 'wrap',
          marginBottom: '1.5rem',
          alignItems: 'flex-start',
        }}
      >
        {/* Severity */}
        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
            Severity
          </span>
          {severityLevels.map((sev) => {
            const isActive = activeSeverity === sev.value
            return (
              <button
                key={sev.value}
                onClick={() => setActiveSeverity(isActive ? null : sev.value)}
                style={{
                  padding: '0.25rem 0.625rem',
                  borderRadius: '9999px',
                  border: `1px solid ${isActive ? sev.color : 'var(--border)'}`,
                  background: isActive ? `${sev.color}15` : 'transparent',
                  color: isActive ? sev.color : 'var(--fg-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {sev.label}
              </button>
            )
          })}
        </div>

        {/* Source agent */}
        {knownSources.length > 1 && (
          <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
              Source
            </span>
            {knownSources.map((src) => {
              const isActive = activeSource === src
              return (
                <button
                  key={src}
                  onClick={() => setActiveSource(isActive ? null : src)}
                  style={{
                    padding: '0.25rem 0.625rem',
                    borderRadius: '9999px',
                    border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                    background: isActive ? 'var(--accent-light)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--fg-muted)',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {src}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Signal cards */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--fg-faint)' }}>
          Loading signals...
        </div>
      ) : signals.length === 0 ? (
        <div
          style={{
            padding: '3rem 2rem',
            textAlign: 'center',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--fg-muted)',
          }}
        >
          <p style={{ fontSize: '1rem', fontWeight: 500, marginBottom: '0.5rem' }}>
            No signals{activeCategory ? ` in ${domainLabels[activeCategory]}` : ''}{activeSeverity ? ` with ${activeSeverity} severity` : ''}{activeSource ? ` from ${activeSource}` : ''}{!activeCategory && !activeSeverity && !activeSource ? ' yet' : ' matching filters'}
          </p>
          <p style={{ fontSize: '0.875rem' }}>
            Signals appear here as operational events are detected across monitored domains.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {signals.map((sig) => {
            const color = domainColor(sig.category || 'general')
            const icon = categoryIcons[sig.category || 'general'] || categoryIcons.general
            const badge = severityBadgeColors[sig.severityLabel || 'info'] || severityBadgeColors.info
            const isExpanded = expandedId === sig.id
            const regionSpread = extraRegions(sig)
            const CHIP_PREVIEW = 4

            return (
              <div
                key={sig.id}
                className="card"
                style={{
                  display: 'flex',
                  overflow: 'hidden',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s',
                }}
                onClick={() => setExpandedId(isExpanded ? null : sig.id)}
              >
                {/* Color left border */}
                <div
                  style={{
                    width: '4px',
                    background: color,
                    flexShrink: 0,
                  }}
                />

                <div
                  style={{
                    flex: 1,
                    padding: '0.75rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                  }}
                >
                  {/* Title row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span style={{ fontSize: '0.875rem', flexShrink: 0 }}>{icon}</span>
                    <span
                      style={{
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        color: 'var(--fg)',
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {sig.title}
                    </span>
                    {/* Severity badge */}
                    <span
                      style={{
                        fontSize: '0.6875rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '9999px',
                        background: badge.bg,
                        color: badge.fg,
                        flexShrink: 0,
                      }}
                    >
                      {sig.severityLabel || 'info'}
                      {sig.severity !== undefined && sig.severity !== null
                        ? ` ${sig.severity.toFixed(1)}`
                        : ''}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', flexShrink: 0 }}>
                      {timeAgo(sig.createdAt)}
                    </span>
                    {/* Chevron */}
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--fg-faint)',
                        flexShrink: 0,
                        transition: 'transform 0.2s ease',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        display: 'inline-block',
                      }}
                    >
                      {'\u25BC'}
                    </span>
                  </div>

                  {/* Collapsed meta line */}
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--fg-faint)',
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{sig.source}</span>
                    {sig.regionName && (
                      <>
                        <span style={{ opacity: 0.4 }}>{'\u00b7'}</span>
                        <span>{sig.regionName}</span>
                      </>
                    )}
                    {regionSpread.length > 0 && (
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          fontWeight: 600,
                          color: 'var(--accent)',
                          background: 'var(--accent-light)',
                          border: '1px solid var(--accent)',
                          borderRadius: '9999px',
                          padding: '0.0625rem 0.4375rem',
                          flexShrink: 0,
                        }}
                        title={`Spans ${regionSpread.length + (sig.regionName ? 1 : 0)} regions`}
                      >
                        +{regionSpread.length} {regionSpread.length === 1 ? 'region' : 'regions'}
                      </span>
                    )}
                  </div>

                  {/* Region spread chips \u2014 multi-region de-duped signals */}
                  {regionSpread.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.25rem',
                        marginTop: '0.25rem',
                      }}
                    >
                      {(isExpanded ? regionSpread : regionSpread.slice(0, CHIP_PREVIEW)).map(
                        (region) => (
                          <span
                            key={region}
                            style={{
                              fontSize: '0.6875rem',
                              color: 'var(--accent)',
                              background: 'var(--accent-light)',
                              border: '1px solid rgba(34, 211, 238, 0.35)',
                              borderRadius: '9999px',
                              padding: '0.0625rem 0.5rem',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {region}
                          </span>
                        ),
                      )}
                      {!isExpanded && regionSpread.length > CHIP_PREVIEW && (
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            color: 'var(--fg-faint)',
                            padding: '0.0625rem 0.25rem',
                          }}
                        >
                          +{regionSpread.length - CHIP_PREVIEW} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Expandable detail section */}
                  <div
                    style={{
                      maxHeight: isExpanded ? '500px' : '0px',
                      overflow: 'hidden',
                      transition: 'max-height 0.3s ease, opacity 0.2s ease',
                      opacity: isExpanded ? 1 : 0,
                    }}
                  >
                    <div style={{ paddingTop: '0.5rem' }}>
                      {/* Message */}
                      <div
                        style={{
                          fontSize: '0.8125rem',
                          color: 'var(--fg-muted)',
                          lineHeight: 1.6,
                          marginBottom: '0.75rem',
                        }}
                      >
                        {sig.message}
                      </div>

                      {/* Detail grid */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr',
                          gap: '0.25rem 0.75rem',
                          fontSize: '0.75rem',
                          color: 'var(--fg-faint)',
                        }}
                      >
                        {sig.category && (
                          <>
                            <span style={{ fontWeight: 500 }}>Category</span>
                            <span style={{ color, fontWeight: 500 }}>
                              {domainLabels[sig.category] || sig.category}
                            </span>
                          </>
                        )}
                        <span style={{ fontWeight: 500 }}>Source</span>
                        <span>{sig.source}</span>
                        {sig.regionName && (
                          <>
                            <span style={{ fontWeight: 500 }}>Region</span>
                            <span>{sig.regionName}</span>
                          </>
                        )}
                        {regionSpread.length > 0 && (
                          <>
                            <span style={{ fontWeight: 500 }}>
                              Spread ({regionSpread.length + (sig.regionName ? 1 : 0)})
                            </span>
                            <span>{regionSpread.join(', ')}</span>
                          </>
                        )}
                        {sig.signalType && (
                          <>
                            <span style={{ fontWeight: 500 }}>Type</span>
                            <span>{sig.signalType}</span>
                          </>
                        )}
                        {sig.severity !== undefined && sig.severity !== null && (
                          <>
                            <span style={{ fontWeight: 500 }}>Severity</span>
                            <span>
                              {sig.severity.toFixed(2)} ({sig.severityLabel || 'info'})
                            </span>
                          </>
                        )}
                        {sig.sourceUrl && (
                          <>
                            <span style={{ fontWeight: 500 }}>Link</span>
                            <a
                              href={sig.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                color,
                                textDecoration: 'underline',
                                textUnderlineOffset: '2px',
                              }}
                            >
                              {sig.sourceUrl.length > 60
                                ? sig.sourceUrl.slice(0, 57) + '...'
                                : sig.sourceUrl}
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {(page > 1 || hasNextPage) && (
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
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              background: page <= 1 ? 'transparent' : 'var(--bg-secondary)',
              color: page <= 1 ? 'var(--fg-faint)' : 'var(--fg)',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: page <= 1 ? 'default' : 'pointer',
            }}
          >
            {'\u2190'} Newer
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)' }}>
            Page {page}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNextPage}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              background: !hasNextPage ? 'transparent' : 'var(--bg-secondary)',
              color: !hasNextPage ? 'var(--fg-faint)' : 'var(--fg)',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: !hasNextPage ? 'default' : 'pointer',
            }}
          >
            Older {'\u2192'}
          </button>
        </div>
      )}
    </div>
  )
}
