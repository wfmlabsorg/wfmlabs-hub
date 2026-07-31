import React from 'react'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { neonQuery } from '@/lib/neon'
import { SignalFeed } from '@/components/signals/SignalFeed'
import SignalGlobeHero from '@/components/globe/SignalGlobeHero'
import { DataUnavailable } from '@/components/DataUnavailable'
import {
  Panel, Trace, StateChip, LevelPill, GapNotice, CoverageBar, StatTile, TileGrid, MONO,
} from '@/components/travelrisk/parts'
import {
  TRAVELRISK_VISIBLE_DOMAINS,
  TRAVELRISK_HIDDEN_DOMAINS,
  TRAVELRISK_PRIORITY_CATEGORIES,
  travelRank,
  travelDomainMeta,
} from '@/lib/travelrisk/domains'
import {
  domainState, summarize, explain, fmtUpdated, fmtSettles, levelColor,
  NEUTRAL, NEUTRAL_DIM, NEUTRAL_LINE,
  type OpRiskPayload,
} from '@/lib/scoreState'
import { domainColor } from '@/lib/domainColors'

/**
 * travelrisk.wfmlabs.com — the travel-first landing (hub-047).
 *
 * SAME APP, SAME DATA, DIFFERENT ARRANGEMENT. Every number here comes from the
 * exact endpoints and tables community.wfmlabs.com reads — `ovix-api`'s op-risk
 * index, `travel-intel`, and the Hub plane (01-Source/DATA-PLANE-CONTRACT.md).
 * Nothing is re-derived client-side, and where a number does not exist yet the
 * page says so rather than inventing one (see <GapNotice/>).
 *
 * The one thing this surface changes is ORDER: domains are ranked by impact on
 * a flight in the next 48 hours (src/lib/travelrisk/domains.ts). That is
 * presentation only — scoring, declare logic and the canonical 12-domain
 * taxonomy are untouched.
 *
 * Reachable directly at /travelrisk on any host (so a Vercel preview can be
 * verified), and served at `/` on travelrisk.wfmlabs.com via src/middleware.ts.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Travel Risk — operational risk ranked by flight impact',
  description:
    'Live operational risk for travel: 12 monitored domains ordered by impact on a flight in the next 48 hours, airport monitoring coverage, and open incidents. From the WFM Labs intelligence platform.',
}

const OVIX_API = 'https://ovix-api.tedlango.workers.dev'
const TRAVEL_INTEL = 'https://travel-intel.tedlango.workers.dev'

// ── helpers ────────────────────────────────────────────────────────────────

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

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0

async function j<T>(url: string, revalidate = 120): Promise<T | null> {
  try {
    const r = await fetch(url, { next: { revalidate } })
    if (!r.ok) return null
    return (await r.json()) as T
  } catch {
    return null
  }
}

async function sql<T>(query: string, params: unknown[] = []): Promise<T[] | null> {
  try {
    const { rows } = await neonQuery<T>(query, params)
    return rows
  } catch {
    return null
  }
}

// ── row types ──────────────────────────────────────────────────────────────

interface SweepRow {
  sweep_id: string; observed_at: string; degraded: string; nominal: string
  unknown: string; total: string; rule_id: string | null; rule_version: string | null
}
interface DegradedRow {
  iata: string | null; icao: string; status: string; status_reason: string | null
  program_type: string | null; avg_delay_min: string | null; max_delay_min: string | null
  departures_cancelled: number | null; observed_at: string; source: string | null
  rule_id: string | null; rule_version: string | null
  name: string | null; city: string | null; country: string | null
  business_travel_weight: number | null; monitor_tier: number | null
}
interface CoverageRow { coverage_class: string; n: string; checked_at: string; rule_version: string | null }
interface LatencyRow {
  source: string; events_in_scope: string; events_detected: string; coverage_pct: string | null
  lag_measured_n: string; median_lag_vs_onset_min: string | null; p90_lag_vs_onset_min: string | null
  press_comparisons_n: string; ahead_of_press: string | null; behind_press: string | null
  win_rate_vs_press_pct: string | null; median_lead_vs_press_min: string | null
}
interface BriefRow { slug: string; title: string; excerpt: string | null; published_at: string }
interface IncidentRow {
  id: number; title: string; slug: string; domain: string; severity: number
  sev_level: string; status: string; declared_at: string
  location_name: string | null; location_country: string | null
}
interface TravelScores {
  composite?: number; level?: string
  domains?: { domain: string; score: number; level: string; eventCount: number; topEvent: string }[]
  events?: {
    domain: string; location?: string; source?: string; scope?: string; title?: string
    severity?: number; detail?: string; lifecycle?: string; url?: string
    sourceCheckedAt?: string; timestamp?: string
  }[]
}
interface TravelHealth {
  status?: string; lastUpdate?: string
  rules?: Record<string, string>
  observationStore?: {
    lastSweepId?: string; lastSweepAt?: string; lastSweepAgeMinutes?: number
    observationsLastSweep?: number; sweepsLast24h?: number; cadenceMinutes?: number; stale?: boolean
  }
}

// ── page ───────────────────────────────────────────────────────────────────

export default async function TravelRiskPage() {
  const userAgent = (await headers()).get('user-agent') || ''
  const isMobile = /iPhone|iPad|Android|Mobile|webOS|BlackBerry|Opera Mini/i.test(userAgent)

  const [opRisk, travelScores, travelHealth, sweep, degraded, coverage, latency, incidents, briefs] =
    await Promise.all([
      j<OpRiskPayload>(`${OVIX_API}/api/ovix/op-risk?scope=global`),
      j<TravelScores>(`${TRAVEL_INTEL}/api/travel/scores`),
      j<TravelHealth>(`${TRAVEL_INTEL}/api/travel/health`),
      // Airport observation store (api-060, migration 045) — Hub plane, the same
      // database the incidents page reads. Latest sweep, three states, counted.
      sql<SweepRow>(`
        WITH s AS (
          SELECT sweep_id, MAX(observed_at) AS observed_at
          FROM airport_observations GROUP BY sweep_id ORDER BY 2 DESC LIMIT 1
        )
        SELECT s.sweep_id, s.observed_at,
               COUNT(*) FILTER (WHERE o.status = 'degraded')::text AS degraded,
               COUNT(*) FILTER (WHERE o.status = 'nominal')::text  AS nominal,
               COUNT(*) FILTER (WHERE o.status IS NULL OR o.status NOT IN ('degraded','nominal'))::text AS unknown,
               COUNT(*)::text AS total,
               MAX(o.rule_id) AS rule_id, MAX(o.rule_version) AS rule_version
        FROM airport_observations o JOIN s ON o.sweep_id = s.sweep_id
        GROUP BY s.sweep_id, s.observed_at`),
      sql<DegradedRow>(`
        WITH s AS (SELECT sweep_id FROM airport_observations ORDER BY observed_at DESC LIMIT 1)
        SELECT o.iata, o.icao, o.status, o.status_reason, o.program_type,
               o.avg_delay_min::text, o.max_delay_min::text, o.departures_cancelled,
               o.observed_at, o.source, o.rule_id, o.rule_version,
               a.name, a.city, a.country, a.business_travel_weight, a.monitor_tier
        FROM airport_observations o
        JOIN s ON o.sweep_id = s.sweep_id
        LEFT JOIN airports a ON a.icao = o.icao
        WHERE o.status = 'degraded'
        ORDER BY COALESCE(a.business_travel_weight, 0) DESC, COALESCE(o.avg_delay_min, 0) DESC
        LIMIT 8`),
      sql<CoverageRow>(`
        SELECT coverage_class, COUNT(*)::text AS n,
               MAX(checked_at) AS checked_at, MAX(rule_version) AS rule_version
        FROM airport_feed_coverage GROUP BY coverage_class`),
      // Latency ledger (agents-051, migration 046). Views may not exist, and may
      // exist but be empty until the worker's first refresh — both are gaps, and
      // both are reported as gaps rather than rendered as a flattering blank.
      sql<LatencyRow>(`
        SELECT source, events_in_scope::text, events_detected::text, coverage_pct::text,
               lag_measured_n::text, median_lag_vs_onset_min::text, p90_lag_vs_onset_min::text,
               press_comparisons_n::text, ahead_of_press::text, behind_press::text,
               win_rate_vs_press_pct::text, median_lead_vs_press_min::text
        FROM latency_by_source
        ORDER BY events_in_scope DESC NULLS LAST LIMIT 8`),
      sql<IncidentRow>(`
        SELECT id, title, slug, domain, severity, sev_level, status, declared_at,
               location_name, location_country
        FROM incidents WHERE status <> 'closed'
        ORDER BY declared_at DESC LIMIT 60`),
      sql<BriefRow>(`
        SELECT slug, title, excerpt, published_at
        FROM briefs
        WHERE brief_type = 'summary' AND status = 'published'
        ORDER BY published_at DESC LIMIT 1`),
    ])

  const sum = summarize(opRisk)
  const entries = opRisk?.domains || []
  const byDomain = new Map(entries.map((e) => [(e.domain || '').toLowerCase(), e]))

  // Travel-first board. Ordering is the ONLY thing this surface changes.
  const board = TRAVELRISK_VISIBLE_DOMAINS.map((meta) => {
    const entry = byDomain.get(meta.domain)
    return { meta, entry, st: domainState(entry) }
  })

  // Domains ovix-api published that the visible set does not show — named, so a
  // curated set can never quietly become a hidden one.
  const unshown = entries
    .map((e) => (e.domain || '').toLowerCase())
    .filter((d) => d && !TRAVELRISK_VISIBLE_DOMAINS.some((m) => m.domain === d))

  const sweepRow = sweep?.[0] || null
  const coverageMap = new Map((coverage || []).map((c) => [c.coverage_class, c]))
  const covTotal = (coverage || []).reduce((a, c) => a + num(c.n), 0)
  const store = travelHealth?.observationStore || null

  const rankedIncidents = (incidents || [])
    .map((i, idx) => ({ i, idx, r: travelRank(i.domain) }))
    .sort((a, b) => a.r - b.r || a.idx - b.idx)
    .slice(0, 8)
    .map((x) => x.i)

  const latestBrief = briefs?.[0] || null
  const airportEvents = (travelScores?.events || []).filter((e) => e.scope === 'airport').slice(0, 6)

  const opRiskTrace = [
    'source: ovix-api /api/ovix/op-risk?scope=global',
    sum.ruleVersion ? `rule: op_risk_index ${sum.ruleVersion}` : null,
    sum.lastUpdated ? `computed ${fmtUpdated(sum.lastUpdated)}` : null,
  ]

  return (
    <>
      <SignalGlobeHero
        mobile={isMobile}
        eyebrow="Travel Risk · Live"
        title="Operational risk, ranked by flight impact"
        ctaHref="/travelrisk#board"
        ctaLabel="See the risk board ↓"
        priorityCategories={TRAVELRISK_PRIORITY_CATEGORIES}
      />

      <div style={{ maxWidth: '80rem', margin: '0 auto', padding: '1.25rem 1rem 2rem' }}>

        {/* ── 1. Headline: composite + state ───────────────────────────── */}
        {!opRisk ? (
          <div style={{ marginBottom: '1.25rem' }}>
            <DataUnavailable
              title="The operational-risk index could not be reached"
              detail="ovix-api did not answer just now. This is a connection issue, not an all-clear — the world is not known to be calm, it is simply unread."
            />
          </div>
        ) : (
          <Panel
            title="Global operational risk"
            subtitle="One composite across all 12 monitored domains — the same index community.wfmlabs.com reads, arranged travel-first."
            right={<LevelPill level={sum.compositeLevel} score={typeof opRisk.composite === 'number' ? opRisk.composite : null} />}
          >
            <TileGrid>
              <StatTile label="Composite" value={typeof opRisk.composite === 'number' ? opRisk.composite.toFixed(1) : '—'} sub={sum.compositeLevel || 'unknown'} color={levelColor(sum.compositeLevel)} />
              <StatTile label="Basis" value={`${sum.basis.settled}/${sum.total}`} sub="settled" color={NEUTRAL} hatched={sum.provisional} />
              <StatTile label="Provisional" value={sum.basis.provisional} sub="scored on an absolute basis" color={NEUTRAL} hatched={sum.provisional} />
              <StatTile label="Unavailable" value={sum.basis.unavailable} sub="no reading" color={NEUTRAL} hatched />
            </TileGrid>

            {sum.provisional && (
              <div
                style={{
                  marginTop: '0.875rem', padding: '0.75rem 0.875rem',
                  border: `1px dashed ${NEUTRAL_LINE}`, borderRadius: 'var(--radius)',
                  fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.6,
                }}
              >
                <strong style={{ color: NEUTRAL, fontFamily: MONO, fontSize: '0.6875rem', letterSpacing: '0.08em' }}>
                  PROVISIONAL{sum.mixed ? ' · MIXED BASIS' : ''}
                </strong>
                <div style={{ marginTop: '0.375rem' }}>{explain(sum)}</div>
                {sum.mixed && (
                  <div style={{ marginTop: '0.375rem' }}>
                    Some domains are settled and some are provisional. Comparing across that boundary is not valid —
                    rank them against each other today, not against their own history.
                  </div>
                )}
                {fmtSettles(sum.settlesAt) && (
                  <div style={{ marginTop: '0.375rem' }}>Baseline expected to settle about {fmtSettles(sum.settlesAt)}.</div>
                )}
              </div>
            )}
            <Trace items={opRiskTrace} />
          </Panel>
        )}

        {/* ── 2. The board — travel-first ordering ─────────────────────── */}
        <Panel
          id="board"
          title="The risk board — ordered by impact on a flight"
          subtitle="Rank is presentation only. Scores, thresholds and the canonical 12-domain taxonomy are identical to the rest of the platform; only the order and the emphasis differ."
          right={
            <span style={{ fontFamily: MONO, fontSize: '0.625rem', color: NEUTRAL_DIM, letterSpacing: '0.06em' }}>
              {TRAVELRISK_VISIBLE_DOMAINS.length} OF {TRAVELRISK_VISIBLE_DOMAINS.length + TRAVELRISK_HIDDEN_DOMAINS.length} DOMAINS
            </span>
          }
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(19rem, 1fr))', gap: '0.75rem' }}>
            {board.map(({ meta, entry, st }) => {
              const dc = domainColor(meta.domain)
              const missing = !entry
              return (
                <article
                  key={meta.domain}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderLeft: `3px solid ${dc}`,
                    borderRadius: 'var(--radius)',
                    padding: '0.75rem 0.875rem',
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
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {meta.label}
                    </span>
                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <StateChip state={st.state} title={explain(st) || undefined} compact />
                      <LevelPill level={st.level} score={st.score} />
                    </span>
                  </div>

                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
                    {meta.why}
                  </p>

                  {missing ? (
                    <div style={{ fontFamily: MONO, fontSize: '0.625rem', color: NEUTRAL_DIM }}>
                      no reading published for this domain in the current index
                    </div>
                  ) : (
                    <>
                      {entry.topEvent && (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', lineHeight: 1.45, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {entry.topEvent}
                        </div>
                      )}
                      <Trace
                        items={[
                          entry.topSource ? `src ${entry.topSource}` : null,
                          typeof entry.eventCount === 'number' ? `${entry.eventCount} events` : null,
                          st.scoreBasis ? `basis ${st.scoreBasis}` : null,
                          entry.ruleVersion ? `rule ${entry.ruleVersion}` : null,
                        ]}
                      />
                    </>
                  )}
                </article>
              )
            })}
          </div>

          {TRAVELRISK_HIDDEN_DOMAINS.length > 0 && (
            <p style={{ margin: '0.875rem 0 0', fontSize: '0.75rem', color: NEUTRAL_DIM }}>
              Also monitored, not shown on this board:{' '}
              {TRAVELRISK_HIDDEN_DOMAINS.map((d) => d.label).join(', ')} — demoted for aviation relevance, not removed
              from the platform.
            </p>
          )}
          {unshown.length > 0 && (
            <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: NEUTRAL_DIM }}>
              The index also published {unshown.join(', ')}, which this board does not rank.
            </p>
          )}
        </Panel>

        {/* ── 3. Airports — three states, never two ────────────────────── */}
        <Panel
          title="Airport monitoring — checked, degraded, or unknown"
          subtitle="An airport we did not check is never drawn as an airport that is fine. Three states, three treatments."
          accent="#38bdf8"
          right={
            store?.cadenceMinutes ? (
              <span style={{ fontFamily: MONO, fontSize: '0.625rem', color: NEUTRAL_DIM, letterSpacing: '0.06em' }}>
                SWEEP EVERY {store.cadenceMinutes} MIN
              </span>
            ) : null
          }
        >
          {!sweepRow ? (
            <GapNotice
              title="No airport sweep is readable from this surface right now"
              detail="The observation store (api-060, migration 045) either has no rows yet or could not be queried. Rather than show a calm map of unchecked airports, this panel shows nothing."
              owner="API fleet · api-060"
            />
          ) : (
            <>
              <TileGrid min="8rem">
                <StatTile label="Degraded" value={num(sweepRow.degraded)} sub="disruption observed" color="#ef4444" />
                <StatTile label="Nominal" value={num(sweepRow.nominal)} sub={`checked ${timeAgo(sweepRow.observed_at)}`} color="#10b981" />
                <StatTile label="Unknown" value={num(sweepRow.unknown)} sub="not covered / no answer" color={NEUTRAL} hatched />
                <StatTile label="In registry" value={num(sweepRow.total)} sub="airports swept" color={NEUTRAL} />
              </TileGrid>
              <div style={{ marginTop: '0.75rem' }}>
                <CoverageBar degraded={num(sweepRow.degraded)} nominal={num(sweepRow.nominal)} unknown={num(sweepRow.unknown)} />
              </div>

              {covTotal > 0 && (
                <p style={{ margin: '0.75rem 0 0', fontSize: '0.75rem', color: 'var(--fg-muted)', lineHeight: 1.6 }}>
                  Feed coverage is measured, not assumed:{' '}
                  <strong>{num(coverageMap.get('live')?.n)} live</strong>,{' '}
                  {num(coverageMap.get('schedule_only')?.n)} schedule-only,{' '}
                  {num(coverageMap.get('delays_only')?.n)} delays-only,{' '}
                  <strong>{num(coverageMap.get('none')?.n)} with no commercial feed at all</strong> — those last are
                  NOTAM-driven or genuinely unknown, and are counted as unknown above rather than as calm.
                </p>
              )}

              {(degraded || []).length > 0 && (
                <div style={{ marginTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {(degraded || []).map((d) => (
                    <div
                      key={d.icao}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
                        padding: '0.5rem 0.625rem', background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius)', borderLeft: '3px solid #ef4444',
                      }}
                    >
                      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.8125rem', color: '#ef4444', flexShrink: 0 }}>
                        {d.iata || d.icao}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.city || d.name || d.icao}
                        {d.country ? `, ${d.country}` : ''}
                      </span>
                      {d.avg_delay_min && (
                        <span style={{ fontFamily: MONO, fontSize: '0.6875rem', color: '#eab308' }}>
                          {Math.round(num(d.avg_delay_min))} min avg
                        </span>
                      )}
                      {d.status_reason && (
                        <span style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)' }}>{d.status_reason}</span>
                      )}
                      <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: '0.5625rem', color: NEUTRAL_DIM, flexShrink: 0 }}>
                        tier {d.monitor_tier ?? '?'} · {timeAgo(d.observed_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <Trace
                items={[
                  'source: Hub airport_observations (api-060)',
                  sweepRow.rule_id ? `rule: ${sweepRow.rule_id} ${sweepRow.rule_version || ''}`.trim() : null,
                  `sweep ${sweepRow.sweep_id}`,
                  `checked ${timeAgo(sweepRow.observed_at)}`,
                  coverageMap.get('live')?.rule_version ? `coverage rule: airport_feed_coverage ${coverageMap.get('live')?.rule_version}` : null,
                ]}
              />
              <p style={{ margin: '0.625rem 0 0', fontSize: '0.6875rem', color: NEUTRAL_DIM, lineHeight: 1.5 }}>
                Tier 1 airports are actively polled; Tier 3 are event-driven only. A fast reading on a Tier 3 field is
                not the same confidence as a Tier 1 one. The airports map itself is hub-048.
              </p>
            </>
          )}
        </Panel>

        {/* ── 4. Live travel disruption (travel-intel) ─────────────────── */}
        <Panel
          title="Live travel disruption"
          subtitle="Direct regulator and operator feeds — FAA programmes and ATCSCC advisories, transit, road and maritime."
          accent="#38bdf8"
          right={
            travelScores?.level ? <LevelPill level={travelScores.level} score={typeof travelScores.composite === 'number' ? travelScores.composite : null} /> : null
          }
        >
          {!travelScores ? (
            <DataUnavailable
              title="travel-intel could not be reached"
              detail="The travel feed did not answer just now. This is a connection issue, not an all-clear."
            />
          ) : (
            <>
              <TileGrid min="8rem">
                {(travelScores.domains || []).map((d) => (
                  <StatTile
                    key={d.domain}
                    label={d.domain}
                    value={typeof d.score === 'number' ? d.score.toFixed(1) : '—'}
                    sub={`${d.level} · ${d.eventCount} event${d.eventCount === 1 ? '' : 's'}`}
                    color={levelColor(d.level === 'SIGNIFICANT' ? 'HIGH' : d.level === 'NOMINAL' ? 'NORMAL' : d.level)}
                  />
                ))}
              </TileGrid>

              {airportEvents.length > 0 && (
                <div style={{ marginTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  {airportEvents.map((e, i) => (
                    <div
                      key={`${e.location}-${i}`}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
                        padding: '0.5rem 0.625rem', background: 'var(--bg-secondary)',
                        borderRadius: 'var(--radius)',
                        borderLeft: `3px solid ${num(e.severity) >= 6 ? '#ef4444' : '#eab308'}`,
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, minWidth: 0 }}>{e.title || e.location}</span>
                      {e.detail && <span style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)' }}>{e.detail}</span>}
                      <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: '0.5625rem', color: NEUTRAL_DIM, flexShrink: 0 }}>
                        {e.source || 'feed'} · {e.lifecycle || 'live'} · {timeAgo(e.sourceCheckedAt || e.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <Trace
                items={[
                  'source: travel-intel /api/travel/scores',
                  travelHealth?.rules?.faa_airport_events ? `rule: ${travelHealth.rules.faa_airport_events}` : null,
                  travelHealth?.rules?.faa_atcscc_advisories ? `rule: ${travelHealth.rules.faa_atcscc_advisories}` : null,
                  travelHealth?.lastUpdate ? `updated ${timeAgo(travelHealth.lastUpdate)}` : null,
                ]}
              />
            </>
          )}
        </Panel>

        {/* ── 5. How fast did we know ──────────────────────────────────── */}
        <Panel
          title="How fast did we know"
          subtitle="Time-to-know, measured per source against the event's own onset and against the press. Being first is the point of this platform, so the scoreboard is published including when we lose."
        >
          {latency === null ? (
            <GapNotice
              title="The latency ledger is not readable from this database"
              detail="The time-to-know views (latency_by_source / latency_by_domain, migration 046) did not answer. Until they do, this surface states no time-to-know figure at all rather than a favourable one."
              owner="AGENTS fleet · agents-051"
            />
          ) : latency.length === 0 ? (
            <GapNotice
              title="The ledger is provisioned but has recorded nothing yet"
              detail="The schema is in place and the views resolve, but no detections have been written — the latency-ledger worker has not run a refresh against live incidents. A blank scoreboard is not a good score, so no median, coverage or win-rate is shown here."
              owner="AGENTS fleet · agents-051 (worker deploy + first refresh)"
            />
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', minWidth: '38rem' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: NEUTRAL_DIM, fontFamily: MONO, fontSize: '0.5625rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      <th style={{ padding: '0.375rem 0.5rem' }}>Source</th>
                      <th style={{ padding: '0.375rem 0.5rem' }}>Coverage</th>
                      <th style={{ padding: '0.375rem 0.5rem' }}>Median lag vs onset</th>
                      <th style={{ padding: '0.375rem 0.5rem' }}>vs press</th>
                      <th style={{ padding: '0.375rem 0.5rem' }}>Win rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latency.map((r) => {
                      const cmp = num(r.press_comparisons_n)
                      return (
                        <tr key={r.source} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.4rem 0.5rem', fontFamily: MONO, fontWeight: 600 }}>{r.source}</td>
                          <td style={{ padding: '0.4rem 0.5rem', color: 'var(--fg-muted)' }}>
                            {r.coverage_pct ? `${num(r.coverage_pct).toFixed(1)}%` : '—'}
                            <span style={{ color: NEUTRAL_DIM }}> ({r.events_detected}/{r.events_in_scope})</span>
                          </td>
                          <td style={{ padding: '0.4rem 0.5rem', fontFamily: MONO }}>
                            {r.median_lag_vs_onset_min ? `${num(r.median_lag_vs_onset_min).toFixed(1)} min` : '—'}
                          </td>
                          <td style={{ padding: '0.4rem 0.5rem', fontFamily: MONO, color: num(r.median_lead_vs_press_min) >= 0 ? '#10b981' : '#ef4444' }}>
                            {cmp === 0 || !r.median_lead_vs_press_min ? '—' : `${num(r.median_lead_vs_press_min).toFixed(0)} min`}
                          </td>
                          <td style={{ padding: '0.4rem 0.5rem', fontFamily: MONO, color: cmp === 0 ? NEUTRAL_DIM : num(r.win_rate_vs_press_pct) > 0 ? '#10b981' : '#ef4444' }}>
                            {cmp === 0 ? '—' : `${num(r.win_rate_vs_press_pct).toFixed(1)}%`}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p style={{ margin: '0.75rem 0 0', fontSize: '0.75rem', color: 'var(--fg-muted)', lineHeight: 1.6 }}>
                Read coverage before any median: a fast median over a handful of events is not a fast feed. A source with
                no conclusive press comparison shows <span style={{ fontFamily: MONO }}>—</span>, never a flattering blank
                win-rate.
              </p>
              <Trace items={['source: Hub latency_by_source (agents-051, migration 046)', 'rule: latency_ledger v1']} />
            </>
          )}
        </Panel>

        {/* ── 6. Open incidents, ranked by flight impact ───────────────── */}
        <Panel
          title="Open incidents"
          subtitle="Declared by Watchkeeper against the same thresholds as the rest of the platform, re-ordered here by flight impact."
          right={<a href="/incidents" style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>All incidents →</a>}
        >
          {incidents === null ? (
            <DataUnavailable
              title="Incidents could not be read"
              detail="The incident store did not answer just now. This is a connection issue, not an all-clear."
            />
          ) : rankedIncidents.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>
              No incidents are open. This is a read of the incidents table, not an absence of monitoring.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {rankedIncidents.map((inc) => {
                const meta = travelDomainMeta(inc.domain)
                const dc = domainColor(inc.domain)
                return (
                  <a
                    key={inc.id}
                    href={`/incidents/${inc.slug}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
                      padding: '0.5rem 0.625rem', background: 'var(--bg-secondary)',
                      borderRadius: 'var(--radius)', borderLeft: `3px solid ${dc}`,
                      textDecoration: 'none', color: 'inherit',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, flexShrink: 0,
                        color: inc.sev_level === 'SEV1' ? '#ef4444' : inc.sev_level === 'SEV2' ? '#eab308' : NEUTRAL,
                        border: `1px solid ${inc.sev_level === 'SEV1' ? '#ef4444' : inc.sev_level === 'SEV2' ? '#eab308' : NEUTRAL_LINE}`,
                        borderRadius: '3px', padding: '0.0625rem 0.3rem',
                      }}
                    >
                      {inc.sev_level}
                    </span>
                    {meta && (
                      <span style={{ fontFamily: MONO, fontSize: '0.5625rem', color: dc, flexShrink: 0 }}>
                        #{meta.rank} {meta.label}
                      </span>
                    )}
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {inc.title}
                    </span>
                    <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: '0.5625rem', color: NEUTRAL_DIM, flexShrink: 0 }}>
                      {inc.location_name || inc.location_country || 'global'} · {timeAgo(inc.declared_at)}
                    </span>
                  </a>
                )
              })}
            </div>
          )}
          <Trace items={['source: Hub incidents (Watchkeeper)', 'ordering: travelrisk flight-impact rank (presentation only)']} />
        </Panel>

        {/* ── 7. Signals + brief ───────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))', gap: '1.25rem' }}>
          <Panel title="Live travel signals" subtitle="The travel domain of the member intel feed." accent="#38bdf8">
            <SignalFeed limit={8} category="travel" compact />
            <Trace items={['source: Hub signals (scouts · travel-intel · web-scout · sentinel)']} />
          </Panel>

          <Panel title="Latest brief" subtitle="Compass publishes an operational brief as events develop.">
            {latestBrief ? (
              <a
                href={`/briefs/${latestBrief.slug}`}
                style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
              >
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, lineHeight: 1.35, marginBottom: '0.375rem' }}>
                  {latestBrief.title}
                </div>
                <div style={{ fontFamily: MONO, fontSize: '0.625rem', color: NEUTRAL_DIM, marginBottom: '0.5rem' }}>
                  published {timeAgo(latestBrief.published_at)}
                </div>
                <span style={{ fontSize: '0.8125rem', color: 'var(--accent)', fontWeight: 600 }}>Read full →</span>
              </a>
            ) : (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--fg-muted)' }}>No brief published yet.</p>
            )}
          </Panel>
        </div>

        {/* ── 8. What this surface is ──────────────────────────────────── */}
        <Panel title="What you are looking at">
          <p style={{ margin: '0 0 0.625rem', fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.65 }}>
            Travel Risk is a travel-first presentation of the WFM Labs operational intelligence platform — the same
            monitored domains, the same scores, the same incident and evidence layer that powers{' '}
            <a href="https://community.wfmlabs.com" style={{ color: 'var(--accent)' }}>community.wfmlabs.com</a>. It is
            not a separate dataset and not a separate product. What differs is the ordering: domains are ranked by their
            effect on a flight in the next 48 hours.
          </p>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.65 }}>
            Every figure on this page names its source, its rule version and when it was last checked. Where a figure
            does not exist yet, the page says so rather than filling the space.
          </p>
          <Trace items={['surface: travelrisk', 'app: wfmlabs-hub', 'data plane: 01-Source/DATA-PLANE-CONTRACT.md']} />
        </Panel>
      </div>
    </>
  )
}
