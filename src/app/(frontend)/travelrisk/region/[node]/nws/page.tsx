import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { GapNotice } from '@/components/travelrisk/parts'
import { DataUnavailable } from '@/components/DataUnavailable'
import { AutoRefresh } from '@/components/AutoRefresh'
import { NwsDashboard } from '@/components/travelrisk/NwsDashboard'
import { fetchNwsPanel, fetchRegionWindow } from '@/lib/travelrisk/panels'

/**
 * NWS ACTIVE WARNINGS — tier-2 weather window (2026-10-12). Server reads ovix-api once per refresh;
 * NwsDashboard draws the map, the top-15 airport cards and the auto-scrolling severity columns.
 * Data: /api/ovix/panels/nws (OVIX events nws/nhc/spc + NWS point checks per airport).
 */

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ node: string }> }): Promise<Metadata> {
  const { node } = await params
  return { title: `NWS Active Warnings · ${node}` }
}

export default async function NwsPanelPage({ params }: { params: Promise<{ node: string }> }) {
  const { node } = await params
  const [p, w] = await Promise.all([fetchNwsPanel(node), fetchRegionWindow(node)])
  if (!p.ok && p.status === 404) notFound()
  const regionHref = `/travelrisk/region/${encodeURIComponent(node)}`

  const plain = (body: React.ReactNode) => (
    <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '1.25rem 1rem 2rem' }}>
      <AutoRefresh intervalMs={120_000} />
      <p><a href={regionHref} style={{ color: 'var(--accent)' }}>← region window</a></p>
      {body}
    </div>
  )
  if (!p.ok) return plain(<DataUnavailable title="The NWS panel could not be read" detail="ovix-api did not answer. This is a gap, not an all-clear; the page retries every two minutes." />)
  const d = p.data
  if (d.coverage === 'none') return plain(<GapNotice title={`Outside NWS coverage · ${d.node.name}`} detail={d.note ?? 'The National Weather Service covers the United States only.'} />)
  if (!d.summary) return plain(<DataUnavailable title="The NWS panel answered without data" detail="ovix-api returned no summary for this region. The page retries every two minutes." />)

  const wx = w.ok ? (w.data.opRisk?.domains ?? []).find((x) => x.domain === 'weather') ?? null : null
  const weather = wx && wx.available !== false ? { score: wx.score ?? null, level: wx.level ?? null } : null
  return (
    <>
      <AutoRefresh intervalMs={120_000} />
      <NwsDashboard d={d} weather={weather} regionHref={regionHref} />
    </>
  )
}
