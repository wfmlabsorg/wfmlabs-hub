import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DataUnavailable } from '@/components/DataUnavailable'
import { AutoRefresh } from '@/components/AutoRefresh'
import { SpaceDashboard } from '@/components/travelrisk/SpaceDashboard'
import { fetchSpacePanel, fetchRegionWindow } from '@/lib/travelrisk/panels'

/**
 * SPACE WEATHER — tier-2 window (2026-10-15), rebuilt from ovix6's Space Weather Command. Planetary, so
 * every node shows the same sun; the node only names the page. Server reads ovix-api once per refresh
 * (/api/ovix/panels/space: NOAA SWPC scales, Kp, GOES X-ray and proton flux, solar wind, alerts, the
 * swpc OVIX events and the infrastructure floor they earn); SpaceDashboard draws it.
 */

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ node: string }> }): Promise<Metadata> {
  const { node } = await params
  return { title: `Space Weather · ${node}` }
}

export default async function SpacePanelPage({ params }: { params: Promise<{ node: string }> }) {
  const { node } = await params
  const [p, w] = await Promise.all([fetchSpacePanel(node), fetchRegionWindow(node)])
  if (!p.ok && p.status === 404) notFound()

  if (!p.ok) {
    return (
      <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '1.25rem 1rem 2rem' }}>
        <AutoRefresh intervalMs={60_000} />
        <p><a href="/travelrisk" style={{ color: 'var(--accent)' }}>← Travel Risk</a></p>
        <DataUnavailable title="The space weather panel could not be read" detail="ovix-api did not answer. This is a gap, not a quiet sun; the page retries every minute." />
      </div>
    )
  }
  const infra = w.ok ? (w.data.opRisk?.domains ?? []).find((x) => x.domain === 'infrastructure') ?? null : null
  const infrastructure = infra && infra.available !== false ? { score: infra.score ?? null, level: infra.level ?? null } : null
  return (
    <>
      <AutoRefresh intervalMs={60_000} />
      <SpaceDashboard d={p.data} infrastructure={infrastructure} regionHref="/travelrisk" />
    </>
  )
}
