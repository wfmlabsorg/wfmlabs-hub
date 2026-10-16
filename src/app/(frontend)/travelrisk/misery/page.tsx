import React from 'react'
import type { Metadata } from 'next'
import { DataUnavailable } from '@/components/DataUnavailable'
import { AutoRefresh } from '@/components/AutoRefresh'
import { MiseryDashboard } from '@/components/travelrisk/MiseryDashboard'
import { readMisery, type MiseryPayload } from '@/lib/misery'

/**
 * TRAVEL MISERY INDEX — the flat-map dashboard of the 15-minute airport sweep (api-083, 2026-10-16).
 * The server reads Neon once per refresh through the same `readMisery()` the globe's /api/roc-misery
 * uses, so both surfaces show one number; MiseryDashboard draws the map, the worst-airport cards and
 * the band columns. A failed read is shown as a gap, never as an empty calm map.
 */

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Travel Misery Index' }

export default async function MiseryPage() {
  let d: MiseryPayload | null = null
  try { d = await readMisery() } catch (e) { console.error('misery page read error:', e) }
  if (!d) {
    return (
      <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '1.25rem 1rem 2rem' }}>
        <AutoRefresh intervalMs={120_000} />
        <p style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <a href="/travelrisk" style={{ color: 'var(--accent)' }}>← Travel Risk</a>
          <a href="/roc/globe/world-glass.html" style={{ color: 'var(--accent)' }}>Globe →</a>
        </p>
        <DataUnavailable title="The Travel Misery Index could not be read" detail="The database did not answer. This is a gap, not an all-clear; the page retries every two minutes." />
      </div>
    )
  }
  return (
    <>
      <AutoRefresh intervalMs={120_000} />
      <MiseryDashboard d={d} />
    </>
  )
}
