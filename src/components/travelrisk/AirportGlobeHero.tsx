import React from 'react'
import { MONO } from './parts'
import { CONFIDENCE, HAZARD, ADVISORY_HUE } from '@/lib/travelrisk/riskAxes'

/**
 * THE LANDING HERO IS THE AIRPORT GLOBE (hub-051 item 1 + 2)
 * ============================================================================
 * Ted, 2026-08-01: *"The Globe here /roc/globe/travel-globe.html should be our
 * main home page landing globe with the airports, incidents and signals. We
 * need to plot the airports."*
 *
 * ── WHY AN IFRAME AND NOT A PORT ─────────────────────────────────────────
 * `travel-globe.html` is a 2,000-line self-contained Cesium page carrying the
 * entire four-state honesty model: the classifier, the freshness decay, the two
 * orthogonal axes, the census, the trace panel, the declared-vs-measured
 * cadence reconciliation. Re-implementing that inside `SignalGlobeCanvas` would
 * produce a SECOND copy of the rule that decides whether an airport is drawn as
 * fine — and the moment there are two copies, one of them is wrong and nobody
 * knows which. The instruction was explicitly to promote *that* globe, not to
 * build a second implementation of it.
 *
 * So the hero frames the real page. One globe, one classifier, one place to fix
 * a bug. `?embed=1` drops the globe's own link row (the Hub nav is already
 * directly above it) and tightens the panel offsets — chrome only; not one
 * marker, number or classification differs from the full-screen page, which
 * remains reachable and is linked from the corner of the frame.
 *
 * ── MOBILE ───────────────────────────────────────────────────────────────
 * This component is never rendered on mobile. hub-010 made a deliberate call
 * that Cesium does not go on a phone (battery, memory, and a 272-anchor scene
 * that cannot be read at that width — the globe's own CSS hides both side
 * panels below 900px). The landing keeps `<SignalGlobeHero mobile />` there,
 * which is the lightweight CSS globe plus the live ticker. The decision is made
 * by the caller, server-side, from the User-Agent it already parses.
 */

const FRAME_SRC = '/roc/globe/travel-globe.html?embed=1'
export const AIRPORT_GLOBE_HREF = '/roc/globe/travel-globe.html'

function Key({ mark, label, note }: { mark: React.ReactNode; label: string; note: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: '0.4rem', minWidth: 0 }}>
      <span style={{ flexShrink: 0, width: '0.875rem', textAlign: 'center' }}>{mark}</span>
      <span style={{ fontWeight: 700, color: 'var(--fg)', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ color: CONFIDENCE.dim }}>{note}</span>
    </span>
  )
}

export function AirportGlobeHero() {
  return (
    <section
      aria-label="Live travel risk globe"
      style={{ borderBottom: '1px solid var(--border)', background: '#060610' }}
    >
      <div style={{ maxWidth: '96rem', margin: '0 auto', padding: '0.75rem 0.75rem 0' }}>
        <div
          style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            gap: '0.75rem', flexWrap: 'wrap', padding: '0 0.25rem 0.5rem',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: MONO, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.16em',
                textTransform: 'uppercase', color: '#22d3ee',
              }}
            >
              Travel Risk · Live
            </div>
            <h1 style={{ margin: '0.2rem 0 0', fontSize: 'clamp(1.15rem, 2.4vw, 1.6rem)', fontWeight: 700, lineHeight: 1.2 }}>
              272 airports, every open incident, and the live signal stream — on one map
            </h1>
          </div>
          <a
            href={AIRPORT_GLOBE_HREF}
            style={{
              fontFamily: MONO, fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.06em',
              color: '#22d3ee', textDecoration: 'none', border: '1px solid rgba(34,211,238,0.35)',
              borderRadius: '4px', padding: '0.3rem 0.65rem', whiteSpace: 'nowrap',
            }}
          >
            Open full screen ↗
          </a>
        </div>

        <div
          style={{
            position: 'relative',
            height: 'clamp(30rem, 74vh, 52rem)',
            border: '1px solid rgba(34,211,238,0.18)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            background: '#060610',
          }}
        >
          <iframe
            src={FRAME_SRC}
            title="Travel risk globe — airports, incidents and signals"
            loading="lazy"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          />
        </div>

        {/* The key, restated outside the frame. A reader who never scrolls the
            globe's own legend still gets the one distinction that carries the
            whole page: filled means we checked, hollow means we did not. */}
        <div
          style={{
            display: 'flex', flexWrap: 'wrap', gap: '0.375rem 1.25rem',
            padding: '0.625rem 0.25rem 0.75rem', fontSize: '0.6875rem', color: 'var(--fg-muted)',
            lineHeight: 1.5,
          }}
        >
          <Key
            mark={<span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: HAZARD.degraded }} />}
            label="Degraded"
            note="checked, and impaired"
          />
          <Key
            mark={<span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#18BC9C' }} />}
            label="Nominal"
            note="checked, and fine — with the check time"
          />
          <Key
            mark={<span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: `2px solid ${CONFIDENCE.mid}` }} />}
            label="Not checked"
            note="hollow, never teal — a different shape, not just a different colour"
          />
          <Key
            mark={<span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', border: `1.5px solid ${ADVISORY_HUE}` }} />}
            label="Advisory"
            note="a separate axis — a ring around the fact, never a recolouring of it"
          />
          <Key
            mark={<span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: '#38bdf8' }} />}
            label="Signal"
            note="raw stream, subordinate to the anchors"
          />
        </div>
      </div>
    </section>
  )
}

export default AirportGlobeHero
