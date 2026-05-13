'use client'

import React, { useEffect, useState, useCallback } from 'react'

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
  sourceUrl?: string
  createdAt: string
}

const domainColors: Record<string, string> = {
  weather: '#3b82f6',
  seismic: '#ef4444',
  disaster: '#f97316',
  infrastructure: '#8b5cf6',
  cyber: '#22c55e',
  health: '#ec4899',
  financial: '#f59e0b',
  environmental: '#14b8a6',
  general: '#64748b',
  events: '#64748b',
}

const domainLabels: Record<string, string> = {
  weather: 'Weather',
  seismic: 'Seismic',
  disaster: 'Disaster',
  infrastructure: 'Infrastructure',
  cyber: 'Cyber',
  health: 'Health',
  financial: 'Financial',
  environmental: 'Environmental',
  general: 'General',
  events: 'Events',
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
}

const severityBadgeColors: Record<string, { bg: string; fg: string }> = {
  extreme: { bg: '#fecaca', fg: '#991b1b' },
  severe: { bg: '#fed7aa', fg: '#9a3412' },
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

export default function SignalsPage() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const fetchSignals = useCallback((category: string | null) => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('limit', '50')
    if (category) params.set('category', category)

    fetch(`/api/signals?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setSignals(data.docs || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchSignals(activeCategory)
  }, [activeCategory, fetchSignals])

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
          const color = domainColors[cat]
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
            No signals {activeCategory ? `in ${domainLabels[activeCategory]}` : 'yet'}
          </p>
          <p style={{ fontSize: '0.875rem' }}>
            Signals appear here as operational events are detected across monitored domains.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {signals.map((sig) => {
            const color = domainColors[sig.category || 'general'] || domainColors.general
            const icon = categoryIcons[sig.category || 'general'] || categoryIcons.general
            const badge = severityBadgeColors[sig.severityLabel || 'info'] || severityBadgeColors.info

            return (
              <div
                key={sig.id}
                className="card"
                style={{
                  display: 'flex',
                  overflow: 'hidden',
                  borderRadius: 'var(--radius-lg)',
                }}
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
                    padding: '1rem 1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  {/* Title row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontSize: '0.875rem' }}>{icon}</span>
                    <span
                      style={{
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        color: 'var(--fg)',
                        flex: 1,
                        minWidth: 0,
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
                  </div>

                  {/* Message */}
                  <div
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--fg-muted)',
                      lineHeight: 1.5,
                    }}
                  >
                    {sig.message}
                  </div>

                  {/* Meta row */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.75rem',
                      fontSize: '0.75rem',
                      color: 'var(--fg-faint)',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{sig.source}</span>
                    {sig.regionName && (
                      <>
                        <span style={{ opacity: 0.4 }}>{'\u00b7'}</span>
                        <span>{sig.regionName}</span>
                      </>
                    )}
                    {sig.category && (
                      <>
                        <span style={{ opacity: 0.4 }}>{'\u00b7'}</span>
                        <span
                          style={{
                            color,
                            fontWeight: 500,
                          }}
                        >
                          {domainLabels[sig.category] || sig.category}
                        </span>
                      </>
                    )}
                    <span style={{ marginLeft: 'auto' }}>{timeAgo(sig.createdAt)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
