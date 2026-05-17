'use client'

import { useState, useEffect } from 'react'

interface FeedInfo {
  name: string
  label: string
  icon: string
  color: string
  rocPath: string
  score?: number
  eventCount?: number
}

const DASHBOARDS: FeedInfo[] = [
  { name: 'weather', label: 'Weather', icon: '⛈', color: '#3b82f6', rocPath: 'roc-dashboards:weather' },
  { name: 'seismic', label: 'Seismic', icon: '🌋', color: '#ef4444', rocPath: 'roc-dashboards:seismic' },
  { name: 'disaster', label: 'Disaster', icon: '🔥', color: '#f97316', rocPath: 'roc-dashboards:disaster' },
  { name: 'cyber', label: 'Cyber', icon: '🛡', color: '#22c55e', rocPath: 'roc-dashboards:cyber' },
  { name: 'health', label: 'Health', icon: '🏥', color: '#ec4899', rocPath: 'roc-dashboards:health' },
  { name: 'infrastructure', label: 'Infrastructure', icon: '🏗', color: '#8b5cf6', rocPath: 'roc-dashboards:infrastructure' },
  { name: 'financial', label: 'Financial', icon: '📈', color: '#f59e0b', rocPath: 'roc-dashboards:financial-markets' },
  { name: 'environmental', label: 'Environmental', icon: '🌿', color: '#14b8a6', rocPath: 'roc-dashboards:environmental' },
  { name: 'geopolitical', label: 'Geopolitical', icon: '🌐', color: '#6366f1', rocPath: 'roc-dashboards:geopolitical' },
  { name: 'travel', label: 'Travel', icon: '✈', color: '#06b6d4', rocPath: 'roc-dashboards:travel' },
]

function sevColor(s: number): string {
  if (s >= 8) return '#ef4444'
  if (s >= 6) return '#f97316'
  if (s >= 4) return '#eab308'
  if (s >= 2) return '#22d3ee'
  return '#10b981'
}

function sevLevel(s: number): string {
  if (s >= 8) return 'CRITICAL'
  if (s >= 6) return 'ELEVATED'
  if (s >= 4) return 'MODERATE'
  if (s >= 2) return 'LOW'
  return 'MINIMAL'
}

export function DashboardRotator() {
  const [activeIndex, setActiveIndex] = useState(0)
  const [feedData, setFeedData] = useState<Record<string, { score: number; eventCount: number; topEvent: string }>>({})
  const [paused, setPaused] = useState(false)

  // Fetch feed health data
  useEffect(() => {
    fetch('https://ovix-api.tedlango.workers.dev/api/ovix/feed-health')
      .then(r => r.json())
      .then(data => {
        const feeds = data.feeds || []
        const mapped: Record<string, { score: number; eventCount: number; topEvent: string }> = {}
        for (const f of feeds) {
          const name = (f.domain || f.name || '').toLowerCase()
          mapped[name] = {
            score: f.avg_severity || f.max_severity || 0,
            eventCount: f.event_count || 0,
            topEvent: f.last_event || '',
          }
        }
        setFeedData(mapped)
      })
      .catch(() => {})
  }, [])

  // Auto-rotate every 5 seconds
  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % DASHBOARDS.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [paused])

  const active = DASHBOARDS[activeIndex]
  const data = feedData[active.name]
  const score = data?.score || Math.round(Math.random() * 4 + 1) // fallback display
  const rocUrl = `/roc#/browse/roc-dashboards:root/${active.rocPath}`

  return (
    <div
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', borderTop: `2px solid ${active.color}`, overflow: 'hidden', transition: 'border-color 0.3s' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Header */}
      <div style={{ padding: '0.875rem 1rem 0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span style={{ fontSize: '0.875rem' }}>📊</span>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>OVIX Dashboards</span>
        </div>
        <a href="/roc" target="_blank" rel="noopener" style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', textDecoration: 'none' }}>
          Open ROC →
        </a>
      </div>

      {/* Active dashboard display */}
      <div style={{ padding: '0 1rem' }}>
        <a href={rocUrl} target="_blank" rel="noopener" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <div style={{
            padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', marginBottom: '0.75rem',
            border: `1px solid ${active.color}33`, cursor: 'pointer', transition: 'all 0.3s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.5rem' }}>{active.icon}</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: active.color }}>{active.label}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: sevColor(score), lineHeight: 1 }}>{score.toFixed(1)}</div>
                <div style={{ fontSize: '0.5625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: sevColor(score) }}>{sevLevel(score)}</div>
              </div>
            </div>
            {data?.eventCount ? (
              <div style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)' }}>{data.eventCount} events tracked</div>
            ) : null}
          </div>
        </a>
      </div>

      {/* Dashboard selector dots + mini labels */}
      <div style={{ padding: '0 1rem 0.75rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {DASHBOARDS.map((d, i) => (
          <button
            key={d.name}
            onClick={() => { setActiveIndex(i); setPaused(true); setTimeout(() => setPaused(false), 10000) }}
            title={d.label}
            style={{
              width: '1.75rem', height: '1.75rem',
              borderRadius: '6px',
              border: i === activeIndex ? `1px solid ${d.color}` : '1px solid var(--border)',
              background: i === activeIndex ? `${d.color}20` : 'transparent',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem',
              transition: 'all 0.2s',
              padding: 0,
            }}
          >
            {d.icon}
          </button>
        ))}
      </div>
    </div>
  )
}
