'use client'

// hub-012 — compact "show on globe" affordance for incident cards.
// Dispatches the hub-011 globe-focus bridge so the native Signal Globe
// (SignalGlobeHero/SignalGlobeCanvas) flies to the incident's coordinates AND
// scrolls itself into view. We POST a same-origin message rather than
// dispatching the window CustomEvent directly: the SignalGlobeHero `message`
// bridge re-dispatches the CustomEvent (fly) *and* scrolls the hero into view,
// whereas a bare CustomEvent only flies. On mobile (no Cesium canvas mounted)
// the CustomEvent no-ops gracefully and the hero/ticker still scrolls in.
//
// Rendered inside the incident card's <a> link, so the click must not navigate:
// preventDefault + stopPropagation keep the card's /incidents/{slug} link intact.

import React from 'react'

interface ShowOnGlobeButtonProps {
  lat: number
  lon: number
  title: string
  domain: string
}

export default function ShowOnGlobeButton({ lat, lon, title, domain }: ShowOnGlobeButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    // Don't let the click bubble to the surrounding card link.
    e.preventDefault()
    e.stopPropagation()
    if (typeof window === 'undefined') return
    window.postMessage(
      { type: 'wfm:globe-focus', lat, lon, title, category: domain },
      window.location.origin,
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Show this incident on the live globe"
      aria-label="Show this incident on the live globe"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        cursor: 'pointer',
        fontSize: '0.625rem',
        fontWeight: 600,
        fontFamily: "'IBM Plex Mono', monospace",
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: '#22d3ee',
        background: 'rgba(34,211,238,0.08)',
        border: '1px solid rgba(34,211,238,0.35)',
        borderRadius: '999px',
        padding: '0.125rem 0.5rem',
        lineHeight: 1.4,
      }}
    >
      <span aria-hidden="true">📍</span>
      Globe
    </button>
  )
}
