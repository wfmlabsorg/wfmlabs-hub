'use client'

// hub-017 Fix B — the Live Incident card on the landing page.
//
// PRIMARY click flies the native Signal Globe to the incident (+ popup) instead
// of navigating: the whole card is ONE <button> that posts the hub-011
// globe-focus bridge message ({ type:'wfm:globe-focus', ... }) → SignalGlobeHero
// re-dispatches the CustomEvent (flyToIncident) and scrolls the globe into view.
// The incident PAGE is then reachable from the globe popup's "view incident →".
//
// A coordless incident can't be flown to, so it falls back to a single <a> to
// the page. Either way the card is exactly ONE interactive element — no nested
// links/buttons (CodeRabbit flags those).

import React from 'react'
import { domainBadge, domainLabel } from '@/lib/domainColors'

interface SevToken {
  label: string
  color: string
  bg: string
  borderColor: string
  pulse?: boolean
}

interface LiveIncidentCardProps {
  slug: string
  title: string
  domain: string
  regions: string
  time: string
  lat: number
  lon: number
  hasCoords: boolean
  sev: SevToken
}

export default function LiveIncidentCard({
  slug,
  title,
  domain,
  regions,
  time,
  lat,
  lon,
  hasCoords,
  sev,
}: LiveIncidentCardProps) {
  const badge = domainBadge(domain)

  const focusGlobe = () => {
    if (typeof window === 'undefined') return
    window.postMessage(
      { type: 'wfm:globe-focus', incidentSlug: slug, lat, lon, title, category: domain },
      window.location.origin,
    )
  }

  const cardStyle: React.CSSProperties = {
    minWidth: '17rem',
    maxWidth: '20rem',
    padding: '0.875rem 1rem',
    color: 'inherit',
    borderLeft: `3px solid ${sev.color}`,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    textAlign: 'left',
    font: 'inherit',
    cursor: 'pointer',
    width: '100%',
  }

  const inner = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.625rem',
            fontWeight: 700,
            fontFamily: "'IBM Plex Mono', monospace",
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '0.125rem 0.375rem',
            borderRadius: '4px',
            background: sev.bg,
            border: `1px solid ${sev.borderColor}`,
            color: sev.color,
          }}
        >
          {sev.pulse && (
            <span
              style={{
                width: '4px',
                height: '4px',
                borderRadius: '50%',
                background: sev.color,
                animation: 'pulse 2s ease-in-out infinite',
              }}
            />
          )}
          {sev.label}
        </span>
        <span
          style={{
            fontSize: '0.625rem',
            fontWeight: 600,
            fontFamily: "'IBM Plex Mono', monospace",
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '0.125rem 0.375rem',
            borderRadius: '4px',
            background: badge.bg,
            color: badge.fg,
          }}
        >
          {domainLabel(domain)}
        </span>
        <span style={{ fontSize: '0.625rem', color: 'var(--fg-faint)', marginLeft: 'auto' }}>
          {time}
        </span>
      </div>
      <div style={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.35 }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span
          style={{
            fontSize: '0.6875rem',
            color: 'var(--fg-faint)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0,
          }}
        >
          📍 {regions}
        </span>
      </div>
    </>
  )

  // Coordless → can't fly the globe; link straight to the incident page.
  if (!hasCoords) {
    return (
      <a
        href={`/incidents/${slug}`}
        className="card"
        style={{ ...cardStyle, textDecoration: 'none' }}
      >
        {inner}
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={focusGlobe}
      aria-label={`Show incident "${title}" on the live globe`}
      className="card"
      style={{ ...cardStyle, background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      {inner}
    </button>
  )
}
