import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { neonQuery } from '@/lib/neon'
import { DataUnavailable } from '@/components/DataUnavailable'
import RegionRiskMap from '@/components/travelrisk/RegionRiskMap'
import {
  Panel, Trace, StateChip, IndexReadout, IndexBar, GapNotice, StatTile, TileGrid, MONO,
} from '@/components/travelrisk/parts'
import {
  TRAVELRISK_DOMAIN_ORDER, domainFromSlug, domainSlug, domainHref,
} from '@/lib/travelrisk/domains'
import { fetchRegionRisk, fetchGlobalOpRisk } from '@/lib/travelrisk/opRiskRegions'
import { domainState, explain, fmtUpdated, NEUTRAL, NEUTRAL_DIM } from '@/lib/scoreState'
import { HAZARD, CONFIDENCE, INDEX_MAX, describeSpread } from '@/lib/travelrisk/riskAxes'
import { TRAVELRISK_HIDDEN_PRODUCERS } from '@/lib/travelrisk/presentation'
import { domainColor } from '@/lib/domainColors'

/**
 * ONE DOMAIN'S RISK MAP (hub-051 item 4)
 * ============================================================================
 * Ted, 2026-08-01: *"build out links to each of our Risk area maps so that we
 * can open a new page with Weather or Disaster or Travel and see those
 * scorecard maps."*
 *
 * Twelve of these exist, one per canonical domain, at twelve real URLs. Each is
 * statically parameterised from TRAVELRISK_DOMAIN_ORDER, so the set can never
 * drift from the taxonomy and a thirteenth domain would appear here for free.
 *
 * Each page carries, for its domain and nothing else:
 *   · the global index reading, with its provisional state
 *   · a REGION MAP — the same index across 5 macro and 38 sub-regions, drawn
 *     with magnitude as area in one hue (see RegionRiskMap for why not a
 *     choropleth and why nothing here is red or amber)
 *   · the scorecard: every scored region, ranked, plus every region with NO
 *     reading, named rather than omitted
 *   · this domain's open incidents and recent signals — the things that are
 *     actually happening, as opposed to the index that ranks them
 *
 * NOTHING IS RE-DERIVED. Every number is read off ovix-api or the Hub plane.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 300

export function generateStaticParams() {
  return TRAVELRISK_DOMAIN_ORDER.map((d) => ({ domain: domainSlug(d.domain) }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ domain: string }> },
): Promise<Metadata> {
  const { domain } = await params
  const meta = domainFromSlug(domain)
  if (!meta) return { title: 'Risk map — Travel Risk' }
  return {
    title: `${meta.label} risk map — ranked #${meta.rank} by flight impact`,
    description: `${meta.label} operational risk across every scored region. ${meta.why}`,
  }
}

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0

function timeAgo(date: string | null | undefined): string {
  if (!date) return 'unknown'
  const t = new Date(String(date).replace(' ', 'T').replace(/\+00$/, 'Z')).getTime()
  if (isNaN(t)) return 'unknown'
  const s = Math.floor((Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

async function sql<T>(query: string, params: unknown[] = []): Promise<T[] | null> {
  try {
    const { rows } = await neonQuery<T>(query, params)
    return rows
  } catch {
    return null
  }
}

interface IncidentRow {
  id: number; title: string; slug: string; sev_level: string; status: string
  declared_at: string; location_name: string | null; location_country: string | null
}
interface SignalRow {
  id: number; title: string; source: string; region_name: string | null; created_at: string
}

export default async function DomainRiskMapPage(
  { params }: { params: Promise<{ domain: string }> },
) {
  const { domain: slug } = await params
  const meta = domainFromSlug(slug)
  if (!meta) notFound()

  const [regionRisk, globalRisk, incidents, signals] = await Promise.all([
    fetchRegionRisk(meta.domain),
    fetchGlobalOpRisk(),
    sql<IncidentRow>(
      `SELECT id, title, slug, sev_level, status, declared_at, location_name, location_country
         FROM incidents
        WHERE status NOT IN ('closed','resolved') AND lower(domain) = $1
        ORDER BY CASE sev_level WHEN 'SEV1' THEN 1 WHEN 'SEV2' THEN 2 WHEN 'SEV3' THEN 3 ELSE 4 END,
                 declared_at DESC
        LIMIT 12`,
      [meta.domain],
    ),
    // The producer deny-list applies here exactly as it does on the landing —
    // it only ever bites on `travel`, but applying it uniformly means there is
    // one rule rather than one rule with an exception nobody remembers.
    sql<SignalRow>(
      `SELECT id, title, source, region_name, created_at
         FROM signals
        WHERE lower(category::text) = $1
          AND created_at > now() - interval '48 hours'
          AND NOT (lower(source) = ANY($2::text[]))
        ORDER BY created_at DESC LIMIT 10`,
      [meta.domain, TRAVELRISK_HIDDEN_PRODUCERS.map((p) => p.source)],
    ),
  ])

  const globalEntry = (globalRisk?.domains || []).find(
    (d) => (d.domain || '').toLowerCase() === meta.domain,
  )
  const st = domainState(globalEntry)
  const globalAvailable = !!globalEntry && globalEntry.available !== false

  const scored = regionRisk.nodes.filter((n) => n.available && n.score != null)
  const unscored = regionRisk.nodes.filter((n) => !(n.available && n.score != null))
  const ranked = [...scored].sort((a, b) => (b.score as number) - (a.score as number))
  const regionSpread = describeSpread(scored.map((n) => ({ score: n.score, level: n.level, available: n.available })))
  const dc = domainColor(meta.domain)

  const idx = TRAVELRISK_DOMAIN_ORDER.findIndex((d) => d.domain === meta.domain)
  const prev = TRAVELRISK_DOMAIN_ORDER[idx - 1]
  const next = TRAVELRISK_DOMAIN_ORDER[idx + 1]

  return (
    <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '1.25rem 1rem 2rem' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ borderLeft: `3px solid ${dc}`, paddingLeft: '0.875rem', marginBottom: '1.25rem' }}>
        <div style={{ fontFamily: MONO, fontSize: '0.625rem', letterSpacing: '0.14em', color: NEUTRAL_DIM, textTransform: 'uppercase' }}>
          <a href="/travelrisk/risk" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Risk maps</a>
          {' · '}rank #{meta.rank} of {TRAVELRISK_DOMAIN_ORDER.length} by flight impact
        </div>
        <h1 style={{ margin: '0.25rem 0 0.375rem', fontSize: 'clamp(1.35rem, 3vw, 1.9rem)', fontWeight: 700 }}>
          {meta.label}
        </h1>
        <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--fg-muted)', lineHeight: 1.6, maxWidth: '46rem' }}>
          {meta.why}
        </p>
      </div>

      {/* ── The global reading ─────────────────────────────────────────── */}
      <Panel
        title={`${meta.label} — the global index`}
        subtitle="The same reading community.wfmlabs.com shows for this domain. Presentation differs; the number does not."
        accent={dc}
        right={<StateChip state={st.state} title={explain(st) || undefined} />}
      >
        {!globalRisk ? (
          <DataUnavailable
            title="The operational-risk index could not be reached"
            detail="ovix-api did not answer just now. This is a connection issue, not an all-clear — the world is not known to be calm, it is simply unread."
          />
        ) : (
          <>
            <IndexReadout score={st.score} level={st.level} available={globalAvailable} big />
            {st.provisional && (
              <p style={{ margin: '0.75rem 0 0', fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.6 }}>
                {explain(st)}
              </p>
            )}
            {globalEntry?.topEvent && (
              <p style={{ margin: '0.625rem 0 0', fontSize: '0.8125rem', color: 'var(--fg-faint)', lineHeight: 1.5 }}>
                Top-scoring event: {globalEntry.topEvent}
              </p>
            )}
            <Trace
              items={[
                'source: ovix-api /api/ovix/op-risk?scope=global',
                globalEntry?.ruleVersion ? `rule: op_risk_index ${globalEntry.ruleVersion}` : null,
                st.scoreBasis ? `basis: ${st.scoreBasis}` : null,
                globalRisk.lastUpdated ? `computed ${fmtUpdated(globalRisk.lastUpdated)}` : null,
                typeof globalEntry?.eventCount === 'number' ? `${globalEntry.eventCount} events in window` : null,
              ]}
            />
          </>
        )}
      </Panel>

      {/* ── The map ────────────────────────────────────────────────────── */}
      <Panel
        title={`Where ${meta.label.toLowerCase()} risk sits`}
        subtitle="The same index, scored per region. Disc size is the score; a hollow ring means the index publishes no reading for that region — which is not an all-clear."
        accent={dc}
        right={
          <span style={{ fontFamily: MONO, fontSize: '0.625rem', color: NEUTRAL_DIM, letterSpacing: '0.06em' }}>
            {scored.length}/{regionRisk.asked} SCORED
          </span>
        }
      >
        {regionRisk.asked === 0 ? (
          <DataUnavailable
            title="The region taxonomy could not be read"
            detail="ovix-api's /api/ovix/regions did not answer, so there is nothing to place on a map. Nothing is drawn rather than a map of somewhere else."
          />
        ) : (
          <>
            <RegionRiskMap nodes={regionRisk.nodes} domainLabel={meta.label} />
            {regionRisk.unreachable > 0 && (
              <p style={{ margin: '0.75rem 0 0', fontSize: '0.75rem', color: NEUTRAL, lineHeight: 1.6 }}>
                {regionRisk.unreachable} of {regionRisk.asked} regions did not answer on this render and are
                drawn as no-reading. A region we could not read is not a region with no risk, so it stays on
                the map rather than quietly disappearing from it.
              </p>
            )}
            <Trace
              items={[
                'source: ovix-api /api/ovix/op-risk?scope=region (5 macro + 38 sub-regions)',
                'geometry: ovix-api /api/ovix/regions — each node at its own published lat/lon',
                globalEntry?.ruleVersion ? `rule: op_risk_index ${globalEntry.ruleVersion}` : null,
                'cache: 5 min',
              ]}
            />
            <p style={{ margin: '0.625rem 0 0', fontSize: '0.6875rem', color: NEUTRAL_DIM, lineHeight: 1.5 }}>
              The 133 metro nodes the taxonomy also carries are not drawn: 133 overlapping discs at world
              scale is the centroid smear PR#10/#11 taught us about, in a new costume. Named here rather
              than silently omitted.
            </p>
          </>
        )}
      </Panel>

      {/* ── The scorecard ──────────────────────────────────────────────── */}
      <Panel
        title="The scorecard"
        subtitle="Every region with a reading, ranked — and every region without one, named. Both halves are the answer."
        accent={dc}
      >
        {scored.length === 0 ? (
          <GapNotice
            title={`The index publishes no ${meta.label.toLowerCase()} reading for any region right now`}
            detail="Every region reports `available: false` for this domain, which means no events were scored in that scope in the current window. That is a statement about coverage, not a statement that the world is calm."
            owner="API fleet · op_risk_index"
          />
        ) : (
          <>
            {regionSpread && regionSpread.tight && (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.6 }}>
                The {regionSpread.n} scored regions span {regionSpread.min.toFixed(1)}–
                {regionSpread.max.toFixed(1)} on a 0–{INDEX_MAX} scale — a spread of{' '}
                {regionSpread.span.toFixed(1)}. Rank them against each other; do not read a band name as a
                verdict.
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {ranked.map((n) => (
                <div
                  key={n.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap',
                    padding: '0.375rem 0.5rem', background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: MONO, fontSize: '0.5rem', letterSpacing: '0.08em',
                      color: NEUTRAL_DIM, width: '2.4rem', flexShrink: 0,
                    }}
                  >
                    {n.tier === 'macro' ? 'MACRO' : 'SUB'}
                  </span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, flex: '1 1 9rem', minWidth: 0 }}>
                    {n.name}
                  </span>
                  <IndexBar score={n.score} width="5rem" />
                  <span style={{ fontFamily: MONO, fontSize: '0.8125rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', width: '2.2rem', textAlign: 'right' }}>
                    {(n.score as number).toFixed(1)}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: '0.5625rem', color: NEUTRAL_DIM, width: '4.5rem', textAlign: 'right' }}>
                    {n.level || '—'}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: '0.5625rem', color: NEUTRAL_DIM, flexShrink: 0 }}>
                    {n.eventCount != null ? `${n.eventCount} ev` : 'n/a'}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {unscored.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <div
              style={{
                fontFamily: MONO, fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.09em',
                textTransform: 'uppercase', color: NEUTRAL, marginBottom: '0.375rem',
              }}
            >
              ◌ No reading published — {unscored.length} region{unscored.length === 1 ? '' : 's'}
            </div>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.6 }}>
              The index reports <code style={{ fontFamily: MONO }}>available: false</code> for {meta.label.toLowerCase()} in
              these scopes — no events were scored there in the current window. It publishes those as{' '}
              <code style={{ fontFamily: MONO }}>score 1 / NORMAL</code>, and this page deliberately does not pass that
              through: <strong>&ldquo;we have nothing&rdquo; and &ldquo;it is fine&rdquo; are different claims</strong>, and
              rendering the first as the second is the failure this whole surface exists to prevent.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
              {unscored.map((n) => (
                <span
                  key={n.id}
                  style={{
                    fontFamily: MONO, fontSize: '0.625rem', color: NEUTRAL,
                    border: `1px dashed ${CONFIDENCE.line}`, borderRadius: '3px',
                    padding: '0.125rem 0.4rem',
                  }}
                >
                  {n.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </Panel>

      {/* ── What is actually happening in this domain ──────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(21rem, 1fr))', gap: '1.25rem' }}>
        <Panel
          title={`Open ${meta.label.toLowerCase()} incidents`}
          subtitle="Declared, evidence-backed, and the only thing on this page allowed a hazard colour."
          accent={dc}
        >
          {incidents === null ? (
            <DataUnavailable
              title="Incidents could not be read"
              detail="The incident store did not answer. This is a connection issue, not an all-clear."
            />
          ) : incidents.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.6 }}>
              No {meta.label.toLowerCase()} incident is open. This is a read of the incidents table, not an
              absence of monitoring — the index above is still scoring this domain.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {incidents.map((inc) => (
                <a
                  key={inc.id}
                  href={`/incidents/${inc.slug}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
                    padding: '0.5rem 0.625rem', background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius)',
                    borderLeft: `3px solid ${inc.sev_level === 'SEV1' ? HAZARD.severe : inc.sev_level === 'SEV2' ? HAZARD.degraded : NEUTRAL}`,
                    textDecoration: 'none', color: 'inherit',
                  }}
                >
                  <span
                    style={{
                      fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, flexShrink: 0,
                      color: inc.sev_level === 'SEV1' ? HAZARD.severe : inc.sev_level === 'SEV2' ? HAZARD.degraded : NEUTRAL,
                    }}
                  >
                    {inc.sev_level}
                  </span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, minWidth: 0, flex: '1 1 10rem' }}>
                    {inc.title}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: '0.5625rem', color: NEUTRAL_DIM, flexShrink: 0 }}>
                    {inc.location_name || inc.location_country || 'global'} · {timeAgo(inc.declared_at)}
                  </span>
                </a>
              ))}
            </div>
          )}
          <Trace items={['source: Hub incidents (Watchkeeper)', 'status: open only']} />
        </Panel>

        <Panel
          title={`Recent ${meta.label.toLowerCase()} signals`}
          subtitle="The raw stream feeding the index above, last 48 hours."
          accent="#38bdf8"
        >
          {signals === null ? (
            <DataUnavailable
              title="Signals could not be read"
              detail="The signal store did not answer. This is a connection issue, not an all-clear."
            />
          ) : signals.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>
              No {meta.label.toLowerCase()} signals in the last 48 hours.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {signals.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap',
                    padding: '0.35rem 0.5rem', background: 'var(--bg-secondary)',
                    borderRadius: 'var(--radius)', borderLeft: '3px solid #38bdf8',
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', minWidth: 0, flex: '1 1 12rem' }}>{s.title}</span>
                  <span style={{ fontFamily: MONO, fontSize: '0.5625rem', color: NEUTRAL_DIM, flexShrink: 0 }}>
                    {s.source} · {timeAgo(s.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Trace items={['source: Hub signals', 'window: 48 h', 'filter: travelrisk producer deny-list']} />
        </Panel>
      </div>

      {/* ── Move between domains ───────────────────────────────────────── */}
      <nav
        style={{
          display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
          marginTop: '0.5rem', fontSize: '0.8125rem',
        }}
      >
        {prev ? (
          <a href={domainHref(prev.domain)} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            ← #{prev.rank} {prev.label}
          </a>
        ) : <span />}
        <a href="/travelrisk/risk" style={{ color: NEUTRAL_DIM, textDecoration: 'none' }}>All twelve risk maps</a>
        {next ? (
          <a href={domainHref(next.domain)} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            #{next.rank} {next.label} →
          </a>
        ) : <span />}
      </nav>
    </div>
  )
}
