import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Panel, Trace, StateChip, IndexReadout, MONO } from '@/components/travelrisk/parts'
import { DataUnavailable } from '@/components/DataUnavailable'
import { AutoRefresh } from '@/components/AutoRefresh'
import { TRAVELRISK_DOMAIN_ORDER } from '@/lib/travelrisk/domains'
import { NEUTRAL, NEUTRAL_DIM, NEUTRAL_LINE, fmtUpdated } from '@/lib/scoreState'
import { fetchRegionWindow, type OpRiskDomainFull, type PanelDef } from '@/lib/travelrisk/panels'

/**
 * REGION WINDOW — tier 2 under World Glass (2026-10-12)
 * ============================================================================
 * Opened in a new tab from the OVIX tower / region card. One region, its twelve op-risk domains in
 * flight-impact order, and for each domain the panel that explains it. Ted: "I don't want to
 * complicate the world glass, so this should all be tier-2 new window dashboards".
 *
 * Nothing is computed here. ovix-api's panel registry says which panel explains which domain;
 * a domain lifted by an official source (authority floor) says so beside its score.
 */

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ node: string }> }): Promise<Metadata> {
  const { node } = await params
  const r = await fetchRegionWindow(node)
  return { title: r.ok ? `${r.data.node.name} · OVIX region` : 'OVIX region' }
}

const TIER: Record<string, string> = { global: 'global', macro: 'macro region', sub: 'sub-region', metro: 'metro' }

export default async function RegionWindowPage({ params }: { params: Promise<{ node: string }> }) {
  const { node } = await params
  const r = await fetchRegionWindow(node)
  if (!r.ok && r.status === 404) notFound()

  const shell = (body: React.ReactNode) => (
    <div style={{ maxWidth: '64rem', margin: '0 auto', padding: '1.25rem 1rem 2rem' }}>
      <AutoRefresh intervalMs={120_000} />
      {body}
    </div>
  )
  if (!r.ok) {
    return shell(
      <DataUnavailable
        title="ovix-api did not answer for this region"
        detail="This is a connection gap, not an all-clear. The page retries every two minutes."
      />,
    )
  }

  const { node: n, parent, opRisk, panels, registry } = r.data
  const byDomain = new Map((opRisk?.domains ?? []).map((d) => [d.domain, d as OpRiskDomainFull]))
  const panelFor = new Map<string, PanelDef>()
  for (const p of panels) if (!panelFor.has(p.domain)) panelFor.set(p.domain, p)
  const reading = (opRisk?.domains ?? []).filter((d) => d.available !== false).length
  const planned = registry.filter((p) => p.status === 'planned')
  const href = (p: PanelDef) => `/travelrisk/region/${encodeURIComponent(n.id)}/${p.id}`

  return shell(
    <>
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontFamily: MONO, fontSize: '0.625rem', letterSpacing: '0.14em', color: NEUTRAL_DIM, textTransform: 'uppercase' }}>
          <a href="/travelrisk" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Travel Risk</a>
          {' · OVIX · '}
          {n.id !== 'global' && <><a href="/travelrisk/region/global" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Global</a>{' › '}</>}
          {parent && <><a href={`/travelrisk/region/${parent.id}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{parent.name}</a>{' › '}</>}
          {TIER[n.tier]}
        </div>
        <h1 style={{ margin: '0.25rem 0 0.5rem', fontSize: 'clamp(1.35rem, 3vw, 1.9rem)', fontWeight: 700 }}>{n.name}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <IndexReadout score={opRisk?.composite ?? null} level={opRisk?.compositeLevel ?? null} available={!!opRisk && reading > 0} big />
          <StateChip state={opRisk?.compositeState ?? null} />
          <span style={{ fontFamily: MONO, fontSize: '0.6875rem', color: NEUTRAL }}>reading on {reading} of 12 domains</span>
        </div>
        <Trace items={['ovix-api /api/ovix/op-risk', opRisk?.ruleVersion ?? null, opRisk?.lastUpdated ? `updated ${fmtUpdated(opRisk.lastUpdated)}` : null]} />
      </div>

      <Panel
        title="Domains"
        subtitle="Flight-impact order. A score marked OFFICIAL was lifted by an issuing authority (NWS, USGS, GDACS, SWPC, IODA); the rest rank event volume. Open a panel to see the evidence."
      >
        <div style={{ display: 'grid', gap: '0.25rem' }}>
          {TRAVELRISK_DOMAIN_ORDER.map((meta) => {
            const d = byDomain.get(meta.domain)
            const has = !!d && d.available !== false
            const floored = d?.guardApplied === 'authority_floor'
            const p = panelFor.get(meta.domain)
            return (
              <div key={meta.domain} id={`d-${meta.domain}`} style={{ padding: '0.5rem 0.25rem', borderBottom: `1px solid ${NEUTRAL_LINE}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', width: '8rem' }}>{meta.label}</span>
                  <IndexReadout score={has ? d!.score : null} level={has ? d!.level : null} available={has} />
                  {floored && <span title="Lifted by an issuing authority's own warning level" style={{ fontFamily: MONO, fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', border: `1px solid ${NEUTRAL_LINE}`, borderRadius: 3, padding: '0 0.3rem', color: 'var(--fg)' }}>OFFICIAL</span>}
                  {p && <a href={href(p)} target="_blank" rel="noopener" style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: '0.6875rem', color: 'var(--accent)', whiteSpace: 'nowrap', textDecoration: 'none' }}>{p.title} ↗</a>}
                </div>
                {has && d!.topEvent && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', marginTop: '0.2rem', overflowWrap: 'anywhere' }}>
                    {d!.topEvent}{d!.topSource ? <span style={{ color: NEUTRAL_DIM }}> — {d!.topSource}</span> : null}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Panel>

      {panels.length > 0 && (
        <Panel title="Panels" subtitle="Each opens in its own window and reads the same official rows that move the score.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(16rem, 1fr))', gap: '0.75rem' }}>
            {panels.map((p) => (
              <a key={p.id} href={href(p)} target="_blank" rel="noopener"
                style={{ display: 'block', padding: '0.75rem 0.875rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', textDecoration: 'none', color: 'inherit' }}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{p.title} <span style={{ color: 'var(--accent)' }}>↗</span></div>
                <div style={{ fontFamily: MONO, fontSize: '0.5625rem', letterSpacing: '0.08em', color: NEUTRAL_DIM, margin: '0.2rem 0' }}>{p.domain.toUpperCase()} · {p.sources.join(' · ')}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>{p.blurb}</div>
              </a>
            ))}
          </div>
        </Panel>
      )}

      {planned.length > 0 && (
        <p style={{ fontSize: '0.75rem', color: NEUTRAL_DIM, lineHeight: 1.6 }}>
          Coming next, each mapped to its domain: {planned.map((p) => `${p.title} (${p.domain.replace('_', ' ')})`).join(' · ')}.
        </p>
      )}
    </>,
  )
}
