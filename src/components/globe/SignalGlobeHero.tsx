'use client'

// Landing-page HERO: native Signal Globe + live ticker (hub-010).
// Owns the live poll of /api/roc-globe and feeds both the ticker rail and the
// Cesium canvas. The canvas is dynamic-imported with ssr:false so Cesium never
// enters the initial bundle or breaks SSR. On mobile we skip Cesium entirely
// (battery/perf) and show a CSS-globe + the live ticker.

import React, { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  type GlobeSignal,
  type GlobeIncident,
  signalColor,
  severityChip,
  severityChipColor,
  domainLabel,
  timeAgo,
  ROC_GLOBE_FEED,
} from './globeShared'

const SignalGlobeCanvas = dynamic(() => import('./SignalGlobeCanvas'), {
  ssr: false,
  loading: () => (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <InlineGlobePlaceholder label="Loading globe…" />
    </div>
  ),
})

const POLL_MS = 30_000
const TICKER_CAP = 30

interface FocusRequest {
  id: number
  nonce: number
}

export default function SignalGlobeHero({ mobile }: { mobile: boolean }) {
  const [signals, setSignals] = useState<GlobeSignal[]>([])
  const [incidents, setIncidents] = useState<GlobeIncident[]>([])
  const [focusedId, setFocusedId] = useState<number | null>(null)
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null)
  const nonceRef = useRef(0)
  const sectionRef = useRef<HTMLElement | null>(null)

  // ── postMessage bridge: the OVIX tape (iframe at /roc/dashboards/scores.html)
  // posts { type:'wfm:globe-focus', domain } to its parent (this landing). We
  // validate the origin, re-dispatch as the window CustomEvent the canvas listens
  // for, and scroll the globe hero into view so the user sees the fly-to.
  // On mobile no Cesium canvas is mounted, so the CustomEvent no-ops gracefully
  // and we simply scroll the hero/ticker into view. Same-document native callers
  // can dispatch the CustomEvent directly (no postMessage needed).
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return // SECURITY: same-origin only
      const data = event.data
      if (!data || data.type !== 'wfm:globe-focus') return
      const detail: Record<string, unknown> = {}
      if (data.lat != null) detail.lat = data.lat
      if (data.lon != null) detail.lon = data.lon
      if (data.title != null) detail.title = data.title
      if (data.category != null) detail.category = data.category
      if (data.domain != null) detail.domain = data.domain
      if (data.signalId != null) detail.signalId = data.signalId
      window.dispatchEvent(new CustomEvent('wfm:globe-focus', { detail }))
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // ── live poll ──
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const r = await fetch(ROC_GLOBE_FEED, { cache: 'no-store' })
        if (!r.ok) return
        const d = await r.json()
        if (!alive) return
        if (Array.isArray(d.signals)) setSignals(d.signals)
        if (Array.isArray(d.incidents)) setIncidents(d.incidents)
      } catch {
        /* keep last good data */
      }
    }
    load()
    const t = window.setInterval(load, POLL_MS)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [])

  const handleRowClick = useCallback((id: number) => {
    setFocusedId(id)
    nonceRef.current += 1
    setFocusRequest({ id, nonce: nonceRef.current })
  }, [])

  const tickerSignals = signals.slice(0, TICKER_CAP)

  // ── desktop: full-bleed Cesium hero + overlaid ticker ──
  if (!mobile) {
    return (
      <section
        ref={sectionRef}
        style={{
          position: 'relative',
          width: '100%',
          height: 'clamp(460px, 72vh, 780px)',
          background: '#060610',
          borderBottom: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        <SignalGlobeCanvas
          signals={signals}
          incidents={incidents}
          focusRequest={focusRequest}
          onFocus={setFocusedId}
        />

        <HeroOverlayHeader incidentCount={incidents.length} signalCount={signals.length} />

        {/* ticker rail (right) */}
        <div
          style={{
            position: 'absolute',
            top: '4.75rem',
            right: '1rem',
            bottom: '1rem',
            width: '22rem',
            maxWidth: '40vw',
            background: 'rgba(6,10,22,0.82)',
            backdropFilter: 'blur(6px)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 5,
          }}
        >
          <TickerHeader />
          <div style={{ overflowY: 'auto', padding: '0.4rem' }}>
            <TickerRows rows={tickerSignals} focusedId={focusedId} onRowClick={handleRowClick} />
          </div>
        </div>
        <TickerKeyframes />
      </section>
    )
  }

  // ── mobile: CSS globe + ticker, no Cesium ──
  return (
    <section
      ref={sectionRef}
      style={{
        position: 'relative',
        width: '100%',
        background: '#060610',
        borderBottom: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'relative', height: '300px' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <InlineGlobePlaceholder />
        </div>
        <HeroOverlayHeader incidentCount={incidents.length} signalCount={signals.length} compact />
        <a
          href="/roc/globe/globe.html"
          target="_blank"
          rel="noopener"
          style={{
            position: 'absolute',
            bottom: '0.75rem',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: '#22d3ee',
            background: 'rgba(6,10,22,0.85)',
            border: '1px solid rgba(34,211,238,0.3)',
            borderRadius: '999px',
            padding: '0.4rem 1rem',
            textDecoration: 'none',
            zIndex: 5,
          }}
        >
          🌍 View live globe →
        </a>
      </div>
      <div style={{ background: 'rgba(6,10,22,0.6)', borderTop: '1px solid var(--border)' }}>
        <TickerHeader />
        <div style={{ padding: '0.4rem', maxHeight: '360px', overflowY: 'auto' }}>
          <TickerRows
            rows={tickerSignals.slice(0, 14)}
            focusedId={focusedId}
            onRowClick={(id) => setFocusedId(id)}
          />
        </div>
      </div>
      <TickerKeyframes />
    </section>
  )
}

// ── sub-components ──

function HeroOverlayHeader({
  incidentCount,
  signalCount,
  compact,
}: {
  incidentCount: number
  signalCount: number
  compact?: boolean
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '0.75rem',
        padding: compact ? '0.75rem 0.9rem' : '1.1rem 1.4rem',
        zIndex: 5,
        pointerEvents: 'none',
      }}
    >
      <div style={{ pointerEvents: 'auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.625rem',
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#22d3ee',
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          <span style={{ width: '0.4rem', height: '0.4rem', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', animation: 'pulse 2s infinite' }} />
          Live Signal Globe
        </div>
        {!compact && (
          <h1 style={{ margin: '0.35rem 0 0', fontSize: 'clamp(1.1rem, 2.4vw, 1.75rem)', fontWeight: 800, color: '#e2e8f0', lineHeight: 1.2 }}>
            Real-time operational risk
          </h1>
        )}
        <div style={{ marginTop: '0.3rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <Badge color="#ef4444" label={`${incidentCount} open incident${incidentCount === 1 ? '' : 's'}`} />
          <Badge color="#22d3ee" label={`${signalCount} live signal${signalCount === 1 ? '' : 's'}`} />
        </div>
      </div>
      <a
        href="/roc"
        style={{
          pointerEvents: 'auto',
          flexShrink: 0,
          fontSize: '0.75rem',
          fontWeight: 600,
          color: '#22d3ee',
          background: 'rgba(6,10,22,0.7)',
          border: '1px solid rgba(34,211,238,0.3)',
          borderRadius: '999px',
          padding: '0.35rem 0.85rem',
          textDecoration: 'none',
        }}
      >
        Open full ROC ↗
      </a>
    </div>
  )
}

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{
        fontSize: '0.6rem',
        fontWeight: 600,
        fontFamily: "'IBM Plex Mono', monospace",
        color,
        border: `1px solid ${color}`,
        background: 'rgba(6,10,22,0.55)',
        borderRadius: '999px',
        padding: '0.1rem 0.5rem',
      }}
    >
      {label}
    </span>
  )
}

function TickerHeader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.6rem 0.75rem',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      <span style={{ width: '0.35rem', height: '0.35rem', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e', animation: 'pulse 2s infinite' }} />
      <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#e2e8f0', fontFamily: "'IBM Plex Mono', monospace" }}>
        Signal Feed
      </span>
      <span style={{ marginLeft: 'auto', fontSize: '0.6rem', color: '#64748b' }}>newest first</span>
    </div>
  )
}

function TickerRows({
  rows,
  focusedId,
  onRowClick,
}: {
  rows: GlobeSignal[]
  focusedId: number | null
  onRowClick: (id: number) => void
}) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: '1.5rem 0.75rem', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
        Listening for signals…
      </div>
    )
  }
  return (
    <>
      {rows.map((s) => {
        const focused = focusedId === s.id
        const dc = signalColor(s.category)
        return (
          <button
            key={s.id}
            onClick={() => onRowClick(s.id)}
            style={{
              animation: 'tickerIn 0.45s ease',
              display: 'block',
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
              background: focused ? 'rgba(34,211,238,0.12)' : 'transparent',
              border: '1px solid',
              borderColor: focused ? 'rgba(34,211,238,0.45)' : 'transparent',
              borderLeft: `3px solid ${dc}`,
              borderRadius: 'var(--radius)',
              padding: '0.45rem 0.55rem',
              marginBottom: '0.3rem',
              color: 'inherit',
              font: 'inherit',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem' }}>
              <span style={{ width: '0.45rem', height: '0.45rem', borderRadius: '50%', background: dc, flexShrink: 0 }} />
              <span style={{ fontSize: '0.58rem', fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
                {domainLabel(s.category)}
              </span>
              <span
                style={{
                  fontSize: '0.56rem',
                  fontWeight: 700,
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: severityChipColor(s),
                  border: `1px solid ${severityChipColor(s)}`,
                  borderRadius: '3px',
                  padding: '0 0.3rem',
                }}
              >
                {severityChip(s)}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '0.58rem', color: '#64748b', fontFamily: "'IBM Plex Mono', monospace" }}>
                {timeAgo(s.created_at)}
              </span>
            </div>
            <div style={{ fontSize: '0.74rem', fontWeight: 500, color: '#e2e8f0', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {s.title}
            </div>
            <div style={{ fontSize: '0.6rem', color: '#64748b', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📍 {s.region_name || 'Global'}
            </div>
          </button>
        )
      })}
    </>
  )
}

function TickerKeyframes() {
  return (
    <style>{`
      @keyframes tickerIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    `}</style>
  )
}

// Lightweight CSS sphere (duplicated minimal copy so the dynamic chunk boundary
// is clean — importing the canvas module's placeholder would defeat code-split).
function InlineGlobePlaceholder({ label }: { label?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.9rem' }}>
      <div
        style={{
          width: 'min(46vw, 240px)',
          height: 'min(46vw, 240px)',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 30%, #16243f 0%, #0d1830 45%, #060d1c 100%)',
          boxShadow: '0 0 60px rgba(34,211,238,0.18), inset -16px -16px 50px rgba(0,0,0,0.6)',
          border: '1px solid rgba(34,211,238,0.18)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            backgroundImage:
              'repeating-linear-gradient(0deg, transparent 0 22px, rgba(34,211,238,0.07) 22px 23px), repeating-linear-gradient(90deg, transparent 0 22px, rgba(34,211,238,0.07) 22px 23px)',
          }}
        />
      </div>
      {label && (
        <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: "'IBM Plex Mono', monospace", letterSpacing: '0.08em' }}>
          {label}
        </span>
      )}
    </div>
  )
}
