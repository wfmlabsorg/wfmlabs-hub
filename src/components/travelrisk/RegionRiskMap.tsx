import React from 'react'
import { CONFIDENCE, INDEX_HUE, INDEX_MAX } from '@/lib/travelrisk/riskAxes'

/**
 * PER-DOMAIN RISK MAP (hub-051 item 4)
 * ============================================================================
 * One domain's op-risk index, everywhere ovix-api scores it: 5 macro regions
 * and 38 sub-regions, each at the coordinate the API itself publishes in
 * `/api/ovix/regions`.
 *
 * ── WHY THIS IS AN ABSTRACT MAP AND NOT A CHOROPLETH ─────────────────────
 * A filled-country choropleth would be a lie about coverage. These 43 nodes are
 * a business-region taxonomy, not a partition of the earth's surface — "EMEA"
 * and "Malaysia / Singapore" are siblings in the same tree, most of the planet
 * is in no node at all, and colouring landmass would tell a reader we have a
 * reading for ground we have never scored. So the map plots exactly what is
 * scored, where it is scored, on a graticule, and the rest of the world stays
 * visibly empty. Empty means unscored. That is the honest rendering.
 *
 * ── THE ENCODING ─────────────────────────────────────────────────────────
 * MAGNITUDE IS AREA, NOT AN ALARM COLOUR — the same correction hub-051 made to
 * the domain board, for the same reason (see src/lib/travelrisk/riskAxes.ts).
 * One hue for every scored node; the disc grows with the score. Nothing on this
 * map is red or amber, because nothing on this map is a checked operational
 * impairment: op-risk is a provisional index derived from event volume, and
 * painting it in alarm colours is what made the surface a wall of yellow.
 *
 * ── THE HONESTY RULE, ONE LEVEL UP ───────────────────────────────────────
 * ovix-api publishes `available: false` together with `score: 1` and
 * `level: "NORMAL"` for a domain it has no events for in that scope. Measured
 * live: 6 of 12 domains in North America, 6 of 12 in APAC, 8 of 12 in US
 * Northeast. Drawing those as a calm green NORMAL would be exactly the lie this
 * whole surface exists to refuse — "we have nothing" rendered as "it is fine".
 * They are drawn as HOLLOW SLATE RINGS: a different shape, on the confidence
 * axis, and counted out loud beneath the map.
 *
 * Equirectangular, 2:1. Chosen over Web Mercator because this map carries no
 * area encoding to protect and equirectangular keeps the polar regions from
 * consuming half the canvas for four nodes.
 */

export interface RegionRiskNode {
  id: string
  name: string
  lat: number
  lon: number
  tier: 'macro' | 'sub'
  /** Published score, or null when the API reports no reading for this scope. */
  score: number | null
  level: string | null
  available: boolean
  eventCount: number | null
  topEvent: string | null
  state: string | null
}

const W = 720
const H = 360
const px = (lon: number) => ((lon + 180) / 360) * W
const py = (lat: number) => ((90 - lat) / 180) * H

/** Disc radius from a published score. Area-proportional-ish and floored so a
 *  low score is still a visible mark rather than a vanishing one. */
function radius(score: number, tier: 'macro' | 'sub'): number {
  const base = tier === 'macro' ? 7 : 4
  const grow = tier === 'macro' ? 13 : 8
  return base + (Math.max(0, Math.min(INDEX_MAX, score)) / INDEX_MAX) * grow
}

export function RegionRiskMap({
  nodes, domainLabel,
}: {
  nodes: readonly RegionRiskNode[]
  domainLabel: string
}) {
  const scored = nodes.filter((n) => n.available && typeof n.score === 'number')
  const unscored = nodes.filter((n) => !(n.available && typeof n.score === 'number'))
  // Draw the biggest last so a large macro disc never buries a sub-region.
  const drawOrder = [...scored].sort((a, b) => (b.score as number) - (a.score as number))

  return (
    <div>
      <div
        style={{
          overflowX: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          background: '#060610',
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${domainLabel} operational risk by region — ${scored.length} regions with a reading, ${unscored.length} with none`}
          style={{ display: 'block', width: '100%', minWidth: '34rem', height: 'auto' }}
        >
          {/* Graticule every 30°, with the equator and prime meridian picked out. */}
          <g stroke={CONFIDENCE.faint} strokeWidth={0.5} opacity={0.35}>
            {[-150, -120, -90, -60, -30, 30, 60, 90, 120, 150].map((lon) => (
              <line key={`m${lon}`} x1={px(lon)} y1={0} x2={px(lon)} y2={H} />
            ))}
            {[-60, -30, 30, 60].map((lat) => (
              <line key={`p${lat}`} x1={0} y1={py(lat)} x2={W} y2={py(lat)} />
            ))}
          </g>
          <g stroke={CONFIDENCE.faint} strokeWidth={0.9} opacity={0.55}>
            <line x1={0} y1={py(0)} x2={W} y2={py(0)} />
            <line x1={px(0)} y1={0} x2={px(0)} y2={H} />
          </g>

          {/* NO READING — hollow slate rings. Drawn first, so a scored node is
              never hidden behind an absence. */}
          {unscored.map((n) => (
            <g key={n.id}>
              <circle
                cx={px(n.lon)} cy={py(n.lat)} r={n.tier === 'macro' ? 8 : 5}
                fill="none" stroke={CONFIDENCE.mid} strokeWidth={n.tier === 'macro' ? 1.6 : 1}
                strokeDasharray="2 2" opacity={0.8}
              >
                <title>{`${n.name} — no reading published for ${domainLabel} in this scope. Not an all-clear.`}</title>
              </circle>
            </g>
          ))}

          {/* SCORED — one hue, magnitude carried by area. */}
          {drawOrder.map((n) => {
            const r = radius(n.score as number, n.tier)
            return (
              <g key={n.id}>
                <circle
                  cx={px(n.lon)} cy={py(n.lat)} r={r}
                  fill={INDEX_HUE} fillOpacity={n.tier === 'macro' ? 0.2 : 0.28}
                  stroke={INDEX_HUE} strokeWidth={n.tier === 'macro' ? 1.4 : 1}
                  strokeOpacity={0.85}
                >
                  <title>
                    {`${n.name} — ${domainLabel} ${(n.score as number).toFixed(1)}/${INDEX_MAX}` +
                      ` · ${n.level || 'level not held'}` +
                      (n.state ? ` · ${n.state}` : '') +
                      (n.eventCount != null ? ` · ${n.eventCount} events` : '') +
                      (n.topEvent ? `\n${n.topEvent}` : '')}
                  </title>
                </circle>
                <circle cx={px(n.lon)} cy={py(n.lat)} r={1.4} fill={INDEX_HUE} opacity={0.9} />
              </g>
            )
          })}

          {/* Macro-region names only. Labelling all 43 would smear; the
              sub-regions carry their names on hover and in the table below. */}
          {nodes.filter((n) => n.tier === 'macro').map((n) => (
            <text
              key={`t${n.id}`}
              x={px(n.lon)} y={py(n.lat) - (n.available && n.score != null ? radius(n.score, 'macro') : 8) - 5}
              textAnchor="middle"
              fill={CONFIDENCE.mid}
              fontSize={9}
              fontFamily="'IBM Plex Mono', monospace"
              letterSpacing="0.06em"
            >
              {n.name.toUpperCase()}
            </text>
          ))}
        </svg>
      </div>

      <div
        style={{
          display: 'flex', flexWrap: 'wrap', gap: '0.375rem 1.25rem', marginTop: '0.625rem',
          fontSize: '0.6875rem', color: 'var(--fg-muted)', lineHeight: 1.5,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: INDEX_HUE, opacity: 0.35, border: `1px solid ${INDEX_HUE}` }} />
          <strong style={{ color: 'var(--fg)' }}>{scored.length} scored</strong>
          <span style={{ color: CONFIDENCE.dim }}>disc grows with the index, 0–{INDEX_MAX}</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', border: `1.5px dashed ${CONFIDENCE.mid}` }} />
          <strong style={{ color: 'var(--fg)' }}>{unscored.length} with no reading</strong>
          <span style={{ color: CONFIDENCE.dim }}>hollow — not an all-clear</span>
        </span>
      </div>

      <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: 'var(--fg-muted)', lineHeight: 1.6 }}>
        Nothing on this map is red or amber. The op-risk index is a{' '}
        <strong>provisional ranking derived from event volume</strong>, not an observation of any
        airport, so it is drawn in one hue with magnitude carried by size. Red and amber are reserved
        on this surface for things we checked and found impaired — degraded airfields and declared
        incidents. Regions the index reports no reading for are drawn hollow rather than as a calm
        NORMAL, because <em>we have nothing</em> and <em>it is fine</em> are different claims.
      </p>
    </div>
  )
}

export default RegionRiskMap
