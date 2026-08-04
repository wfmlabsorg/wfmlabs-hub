import React from 'react'
import type { Metadata } from 'next'
import { DataUnavailable } from '@/components/DataUnavailable'
import { Panel, Trace, StateChip, IndexReadout, MONO } from '@/components/travelrisk/parts'
import { TRAVELRISK_DOMAIN_ORDER, domainHref } from '@/lib/travelrisk/domains'
import { fetchGlobalOpRisk } from '@/lib/travelrisk/opRiskRegions'
import { domainState, explain, fmtUpdated, summarize, NEUTRAL, NEUTRAL_DIM } from '@/lib/scoreState'
import { describeSpread, spreadSentence, INDEX_MAX } from '@/lib/travelrisk/riskAxes'
import { domainColor } from '@/lib/domainColors'

/**
 * THE INDEX OF THE TWELVE RISK MAPS (hub-051 item 4).
 *
 * Twelve real pages need a front door — somewhere a reader arrives when they
 * want "the maps" rather than one particular map, and somewhere the nav can
 * point. In flight-impact order, with each domain's current reading so the
 * choice of which to open is an informed one rather than a guess.
 *
 * The ordering is presentation only. Scoring, declare logic and the canonical
 * 12-domain taxonomy are identical to the rest of the platform.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Risk maps — all twelve domains',
  description:
    'Twelve per-domain operational risk maps, ordered by impact on a flight in the next 48 hours. Each domain scored across every region, from the WFM Labs intelligence platform.',
}

export default async function RiskMapIndexPage() {
  const opRisk = await fetchGlobalOpRisk()
  const byDomain = new Map(
    (opRisk?.domains || []).map((e) => [(e.domain || '').toLowerCase(), e]),
  )
  const sum = summarize(opRisk)
  const spreadNote = spreadSentence(describeSpread(opRisk?.domains || []))

  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '1.25rem 1rem 2rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <div
          style={{
            fontFamily: MONO, fontSize: '0.625rem', letterSpacing: '0.14em',
            color: NEUTRAL_DIM, textTransform: 'uppercase',
          }}
        >
          <a href="/travelrisk" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Travel Risk</a>
          {' · '}risk maps
        </div>
        <h1 style={{ margin: '0.25rem 0 0.375rem', fontSize: 'clamp(1.35rem, 3vw, 1.9rem)', fontWeight: 700 }}>
          Twelve risk maps, ordered by what moves a flight
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--fg-muted)', lineHeight: 1.6, maxWidth: '48rem' }}>
          Each domain gets its own page: the global reading, the same index scored across every region,
          and this domain&rsquo;s open incidents and live signals. The rank is presentation only —
          scoring, declare logic and the canonical twelve-domain taxonomy are identical to the rest of
          the platform.
        </p>
      </div>

      <Panel
        title="All twelve"
        subtitle="Magnitude is drawn as a bar in one hue, and the published level is printed as a word. Red and amber are reserved on this surface for things we checked and found impaired."
        right={<StateChip state={sum.compositeState} title={explain(sum) || undefined} />}
      >
        {!opRisk ? (
          <DataUnavailable
            title="The operational-risk index could not be reached"
            detail="ovix-api did not answer just now. This is a connection issue, not an all-clear — the world is not known to be calm, it is simply unread. Every map below is still reachable; each will report the same gap."
          />
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(19rem, 1fr))', gap: '0.75rem' }}>
          {TRAVELRISK_DOMAIN_ORDER.map((meta) => {
            const entry = byDomain.get(meta.domain)
            const st = domainState(entry)
            const available = !!entry && entry.available !== false
            const dc = domainColor(meta.domain)
            return (
              <a
                key={meta.domain}
                href={domainHref(meta.domain)}
                style={{
                  display: 'block',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${dc}`,
                  borderRadius: 'var(--radius)',
                  padding: '0.75rem 0.875rem',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                  <span
                    style={{
                      fontFamily: MONO, fontSize: '0.625rem', fontWeight: 700,
                      color: meta.rank <= 2 ? '#22d3ee' : NEUTRAL_DIM,
                      border: `1px solid ${meta.rank <= 2 ? 'rgba(34,211,238,0.45)' : 'var(--border)'}`,
                      borderRadius: '3px', padding: '0.0625rem 0.3rem', flexShrink: 0,
                    }}
                  >
                    #{meta.rank}
                  </span>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 700 }}>{meta.label}</span>
                  <span style={{ marginLeft: 'auto' }}>
                    <StateChip state={st.state} compact />
                  </span>
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <IndexReadout score={st.score} level={st.level} available={available} />
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
                  {meta.why}
                </p>
                <Trace items={['open the risk map →']} />
              </a>
            )
          })}
        </div>

        {spreadNote && (
          <div
            style={{
              marginTop: '0.875rem', padding: '0.75rem 0.875rem',
              borderLeft: `2px solid ${NEUTRAL}`, background: 'rgba(148,163,184,0.07)',
              borderRadius: 'var(--radius)', fontSize: '0.8125rem',
              color: 'var(--fg-muted)', lineHeight: 1.6,
            }}
          >
            <strong style={{ color: NEUTRAL, fontFamily: MONO, fontSize: '0.625rem', letterSpacing: '0.09em', display: 'block', marginBottom: '0.25rem' }}>
              READ THE SPREAD BEFORE THE BANDS
            </strong>
            {spreadNote}
          </div>
        )}

        <Trace
          items={[
            'source: ovix-api /api/ovix/op-risk?scope=global',
            sum.ruleVersion ? `rule: op_risk_index ${sum.ruleVersion}` : null,
            sum.lastUpdated ? `computed ${fmtUpdated(sum.lastUpdated)}` : null,
            `scale: 0–${INDEX_MAX}`,
          ]}
        />
      </Panel>
    </div>
  )
}
