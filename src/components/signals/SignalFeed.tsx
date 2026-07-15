'use client'

import React, { useEffect, useState } from 'react'

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
  createdAt: string
}

const severityColors: Record<string, string> = {
  extreme: '#e74c3c',
  severe: '#f39c12',
  moderate: '#3498db',
  info: '#27ae60',
}

const categoryIcons: Record<string, string> = {
  weather: '\u26c8',    // thunder cloud
  seismic: '\u26a0',    // warning
  disaster: '\ud83c\udf0a', // wave (encoded as surrogate pair)
  events: '\ud83d\udce1',   // satellite antenna
  cyber: '\ud83d\udee1',    // shield
  infrastructure: '\u26a1', // zap
  health: '\ud83c\udfe5',   // hospital
  financial: '\ud83d\udcca', // chart
  general: '\u25c6',    // diamond
}

export function SignalFeed({
  limit = 10,
  category,
  regionId,
  compact = false,
}: {
  limit?: number
  category?: string
  regionId?: string
  compact?: boolean
}) {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('limit', String(limit))
    if (category) params.set('category', category)
    if (regionId) params.set('region', regionId)

    let cancelled = false
    const load = () => {
      fetch(`/api/signals?${params}`)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return
          setSignals(data.docs || [])
          setLoading(false)
        })
        .catch(() => { if (!cancelled) setLoading(false) })
    }

    load()
    // Live refresh — keep the ticker moving during an event; pause when hidden.
    const id = setInterval(() => {
      if (!document.hidden) load()
    }, 60_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [limit, category, regionId])

  if (loading) {
    return (
      <div style={{ padding: '1rem', color: 'var(--fg-faint)', fontSize: '0.8125rem' }}>
        Loading signals...
      </div>
    )
  }

  if (signals.length === 0) {
    return (
      <div style={{ padding: '1rem', color: 'var(--fg-faint)', fontSize: '0.8125rem' }}>
        No signals yet.
      </div>
    )
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '0.25rem' : '0.5rem' }}>
      {signals.map((sig) => {
        const color = severityColors[sig.severityLabel || 'info'] || severityColors.info
        const icon = categoryIcons[sig.category || 'general'] || categoryIcons.general

        return (
          <div
            key={sig.id}
            style={{
              display: 'flex',
              gap: '0.75rem',
              padding: compact ? '0.5rem 0' : '0.75rem',
              borderBottom: '1px solid var(--border)',
              alignItems: 'flex-start',
            }}
          >
            {/* Severity indicator */}
            <div
              style={{
                width: '3px',
                minHeight: compact ? '1.5rem' : '2.5rem',
                borderRadius: '2px',
                background: color,
                flexShrink: 0,
              }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Title row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.125rem' }}>
                <span style={{ fontSize: '0.75rem' }}>{icon}</span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--fg)' }}>
                  {sig.title}
                </span>
                {sig.severity !== undefined && sig.severity !== null && (
                  <span
                    style={{
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      color,
                      background: `${color}15`,
                      padding: '0.0625rem 0.375rem',
                      borderRadius: '0.25rem',
                      marginLeft: 'auto',
                      flexShrink: 0,
                    }}
                  >
                    {sig.severity.toFixed(1)}
                  </span>
                )}
              </div>

              {/* Message */}
              {!compact && (
                <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', lineHeight: 1.4 }}>
                  {sig.message}
                </div>
              )}

              {/* Meta row */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  fontSize: '0.6875rem',
                  color: 'var(--fg-faint)',
                  marginTop: '0.25rem',
                }}
              >
                <span>{sig.source}</span>
                {sig.regionName && <span>{sig.regionName}</span>}
                <span style={{ marginLeft: 'auto' }}>{timeAgo(sig.createdAt)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
