import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Panel, Trace, StatTile, TileGrid, IndexReadout, GapNotice, MONO } from '@/components/travelrisk/parts'
import { DataUnavailable } from '@/components/DataUnavailable'
import { AutoRefresh } from '@/components/AutoRefresh'
import { NEUTRAL, NEUTRAL_DIM, NEUTRAL_LINE } from '@/lib/scoreState'
import { fetchNwsPanel, fetchRegionWindow, fmtZ } from '@/lib/travelrisk/panels'

/**
 * NWS ACTIVE WARNINGS — the first tier-2 panel and the template for the rest (2026-10-12).
 * ============================================================================
 * Ported from the ovix6 NWS box, rebuilt on the OVIX `events` table: active NWS and NHC alerts plus
 * 24 h SPC storm reports inside this region's box — the same rows and box the weather authority
 * floor reads, so the list is the evidence for the weather score shown at the top.
 *
 * Severity here is the ISSUER's word (Extreme / Severe / Moderate / Minor), a checked fact about
 * the atmosphere, so it sits on the hazard ramp. No orange on this surface.
 */

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ node: string }> }): Promise<Metadata> {
  const { node } = await params
  return { title: `NWS warnings · ${node}` }
}

const SEV: Record<string, string> = { Extreme: '#ef4444', Severe: '#eab308', Moderate: NEUTRAL, Minor: NEUTRAL_DIM }
const sevColor = (l: string) => SEV[l] ?? NEUTRAL_DIM

function Chip({ label, count, worst }: { label: string; count: number; worst: string }) {
  return (
    <span style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'baseline', fontFamily: MONO, fontSize: '0.6875rem',
      border: `1px solid ${NEUTRAL_LINE}`, borderLeft: `3px solid ${sevColor(worst)}`, borderRadius: 3, padding: '0.15rem 0.45rem' }}>
      <b>{label}</b><span style={{ color: NEUTRAL }}>{count}</span>
    </span>
  )
}

export default async function NwsPanelPage({ params }: { params: Promise<{ node: string }> }) {
  const { node } = await params
  const [p, w] = await Promise.all([fetchNwsPanel(node), fetchRegionWindow(node)])
  if (!p.ok && p.status === 404) notFound()

  const wrap = (body: React.ReactNode) => (
    <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '1.25rem 1rem 2rem' }}>
      <AutoRefresh intervalMs={120_000} />
      {body}
    </div>
  )
  if (!p.ok) {
    return wrap(<DataUnavailable title="The NWS panel could not be read" detail="ovix-api did not answer. This is a gap, not an all-clear; the page retries every two minutes." />)
  }

  const d = p.data
  const weather = w.ok ? (w.data.opRisk?.domains ?? []).find((x) => x.domain === 'weather') ?? null : null
  const head = (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={{ fontFamily: MONO, fontSize: '0.625rem', letterSpacing: '0.14em', color: NEUTRAL_DIM, textTransform: 'uppercase' }}>
        <a href={`/travelrisk/region/${encodeURIComponent(d.node.id)}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{d.node.name}</a>
        {' · weather · '}{d.panel.title}
      </div>
      <h1 style={{ margin: '0.25rem 0 0.5rem', fontSize: 'clamp(1.35rem, 3vw, 1.9rem)', fontWeight: 700 }}>NWS active warnings · {d.node.name}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.8125rem' }}>
        <span style={{ fontFamily: MONO, fontSize: '0.625rem', color: NEUTRAL_DIM, letterSpacing: '0.08em' }}>OVIX WEATHER</span>
        <IndexReadout score={weather && weather.available !== false ? (weather.score ?? null) : null} level={weather?.level ?? null} available={!!weather && weather.available !== false} big />
      </div>
    </div>
  )

  if (d.coverage === 'none') {
    return wrap(<>{head}<GapNotice title="Outside NWS coverage" detail={d.note ?? 'The National Weather Service covers the United States only.'} /></>)
  }

  if (!d.summary) {
    return wrap(<>{head}<DataUnavailable title="The NWS panel answered without data" detail="ovix-api returned no summary for this region. This is a gap, not an all-clear; the page retries every two minutes." /></>)
  }
  const s = d.summary
  const alerts = d.alerts ?? []
  const reports = d.reports ?? []
  return wrap(
    <>
      {head}
      {d.coverage === 'partial' && d.note && <GapNotice title="US only" detail={d.note} />}
      <p style={{ fontSize: '0.8125rem', lineHeight: 1.6, margin: '0 0 1rem', color: 'var(--fg-muted)', maxWidth: '52rem' }}>
        {d.floor
          ? <>Weather is held at <b style={{ color: 'var(--fg)' }}>≥ {d.floor.floor.toFixed(1)}</b> here by rule <b style={{ color: 'var(--fg)' }}>{d.floor.rule}</b> ({d.floor.count} in force): {d.floor.reason}.</>
          : <>No official floor applies here. The weather score is ranked from signal volume; these warnings are context, none crossing the floor thresholds (1 Extreme, 5 Severe or a tropical cyclone warning).</>}
      </p>

      <TileGrid min="8rem">
        <StatTile label="Extreme" value={s.extreme} color={s.extreme ? SEV.Extreme : undefined} />
        <StatTile label="Severe" value={s.severe} color={s.severe ? SEV.Severe : undefined} />
        <StatTile label="Moderate" value={s.moderate} />
        <StatTile label="Minor" value={s.minor} />
        <StatTile label="Tropical (NHC)" value={s.tropical} />
        <StatTile label="Storm reports 24h" value={s.reports} />
      </TileGrid>

      {(d.byState?.length ?? 0) > 0 && (
        <Panel title="By state" subtitle="Worst warning in force, by state named in the alert area.">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {d.byState!.map((g) => <Chip key={g.key} label={g.key} count={g.count} worst={g.worst} />)}
          </div>
        </Panel>
      )}

      {(d.byEvent?.length ?? 0) > 0 && (
        <Panel title="By warning type">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {d.byEvent!.map((g) => <Chip key={g.key} label={g.key} count={g.count} worst={g.worst} />)}
          </div>
        </Panel>
      )}

      <Panel title={`Alerts in force · ${s.alerts}`} subtitle="Worst first. Each links to the NWS original.">
        {alerts.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: NEUTRAL }}>No NWS alerts in force in this region on the last ingest.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', fontFamily: MONO, fontSize: '0.5625rem', letterSpacing: '0.08em', color: NEUTRAL_DIM }}>
                  <th style={{ padding: '0.3rem' }}>SEVERITY</th><th style={{ padding: '0.3rem' }}>EVENT</th><th style={{ padding: '0.3rem' }}>AREA</th>
                  <th style={{ padding: '0.3rem', whiteSpace: 'nowrap' }}>ISSUED</th><th style={{ padding: '0.3rem', whiteSpace: 'nowrap' }}>EXPIRES</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a, i) => (
                  <tr key={(a.url ?? '') + i} style={{ borderTop: `1px solid ${NEUTRAL_LINE}`, verticalAlign: 'top' }}>
                    <td style={{ padding: '0.35rem 0.3rem', fontFamily: MONO, fontWeight: 700, color: sevColor(a.severityLabel), whiteSpace: 'nowrap' }}>{a.severityLabel}</td>
                    <td style={{ padding: '0.35rem 0.3rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {a.url ? <a href={a.url} target="_blank" rel="noopener" style={{ color: 'var(--fg)' }}>{a.event}</a> : a.event}
                    </td>
                    <td style={{ padding: '0.35rem 0.3rem', color: 'var(--fg-muted)', minWidth: '14rem' }} title={a.headline ?? undefined}>
                      {a.area.length > 160 ? a.area.slice(0, 157) + '…' : a.area}
                    </td>
                    <td style={{ padding: '0.35rem 0.3rem', fontFamily: MONO, whiteSpace: 'nowrap' }}>{fmtZ(a.issued)}</td>
                    <td style={{ padding: '0.35rem 0.3rem', fontFamily: MONO, whiteSpace: 'nowrap' }}>{fmtZ(a.expires)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(d.truncated?.alerts ?? 0) > 0 && <p style={{ fontSize: '0.6875rem', color: NEUTRAL_DIM }}>+{d.truncated!.alerts} more, lower severity.</p>}
          </div>
        )}
      </Panel>

      <Panel title={`Storm reports · last 24h · ${s.reports}`} subtitle={(d.reportTypes ?? []).map((t) => `${t.type} ${t.count}`).join(' · ') || 'SPC local storm reports'}>
        {reports.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: NEUTRAL }}>No SPC storm reports in this region in the last 24 hours.</p>
        ) : (
          <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.75rem' }}>
            {reports.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', borderTop: i ? `1px solid ${NEUTRAL_LINE}` : undefined, paddingTop: i ? '0.3rem' : 0 }}>
                <span style={{ fontFamily: MONO, color: NEUTRAL_DIM, whiteSpace: 'nowrap' }}>{fmtZ(r.at)}</span>
                <span style={{ fontWeight: 600 }}>{r.title}</span>
                {r.detail && <span style={{ color: 'var(--fg-muted)' }}>{r.detail}</span>}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Trace items={['ovix-api /api/ovix/panels/nws', `sources ${d.panel.sources.join(', ')}`, 'region box = authority-floor box', `generated ${fmtZ(d.generatedAt)}`]} />
    </>,
  )
}
