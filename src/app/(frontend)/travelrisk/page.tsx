import React from 'react'
import type { Metadata } from 'next'
import { isMobile } from '@/lib/mobile'

/**
 * travelrisk.wfmlabs.com — THE LANDING IS WORLD GLASS (Ted, 2026-10-11)
 * ============================================================================
 * "The current page ('272 airports, every open incident, and the live signal stream — on one map') is
 * basic and not nearly as powerful as World Glass. Retire that view into something we can reference if
 * needed, but not core to the layout."  The old landing lives on at /travelrisk/classic.
 *
 * This page is a thin shell: one strip from the desk (posture, open incidents, where to go next) and the
 * World Glass board framed full-bleed. One globe, one classifier, one place to fix a bug — the board is
 * the real page (/roc/globe/world-glass.html), not a port of it. On a phone (hub-010: Cesium does not go
 * on a phone) the strip carries the open incidents and a button opens the board deliberately.
 */
export const metadata: Metadata = {
  title: "Travel Risk — God's Eye",
  description: 'Live business-travel risk: airports, flights, weather, hazards, rail and incidents on one globe, read from the travel desk.',
}

const DESK = process.env.DESK_API_BASE || 'https://desk-api.tedlango.workers.dev'
const BOARD = '/roc/globe/world-glass.html'

interface DeskItem { item_id: string; class: string; layer: number; severity: number; sev_level: string | null; status: string | null; title: string; why: string | null; place: string | null; country: string | null; onset_at: string | null; href: string | null; geo?: string }
interface Posture { domains?: { domain: string; layer: number; level: string | null; composite: number | null }[] }

async function j<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { next: { revalidate: 30 }, signal: AbortSignal.timeout(8000) })
    return r.ok ? ((await r.json()) as T) : null
  } catch {
    return null
  }
}
const SEV_COLOR: Record<string, string> = { SEV1: '#ef4444', SEV2: '#f97316', SEV3: '#eab308', SEV4: '#94a3b8' }
const LEVEL_COLOR = (l: string) => (l === 'SEVERE' || l === 'CRITICAL' ? '#ef4444' : l === 'SIGNIFICANT' ? '#f97316' : l === 'ELEVATED' ? '#eab308' : '#18BC9C')
const ago = (iso: string | null) => { if (!iso) return ''; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d` }

export default async function TravelRiskPage() {
  const mobile = await isMobile()
  const [inc, posture] = await Promise.all([
    j<{ items: DeskItem[] }>(`${DESK}/desk/items?layer=all&class=incident&exclude=proposed&limit=50`),
    j<Posture>(`${DESK}/desk/posture`),
  ])
  const incidents = (inc?.items || []).filter((i) => !['closed', 'resolved', 'dismissed', 'proposed'].includes(String(i.status || '')))
  const travel = posture?.domains?.find((d) => d.domain === 'travel') || null
  const level = travel?.level ? String(travel.level).toUpperCase() : null
  const deskDown = !inc && !posture

  const link: React.CSSProperties = { color: 'var(--fg-muted)', textDecoration: 'none', fontSize: '0.75rem', whiteSpace: 'nowrap' }
  const strip = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem 1rem', flexWrap: 'wrap', padding: '0.5rem 1rem', borderBottom: '1px solid var(--border)', background: '#060610', fontSize: '0.8125rem' }}>
      <span style={{ fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '0.6875rem', color: '#22d3ee' }}>Travel Risk · God&apos;s Eye</span>
      {deskDown ? (
        <span style={{ color: '#f59e0b' }}>desk unreachable — the board below reads it directly</span>
      ) : (
        <>
          <span style={{ color: level ? LEVEL_COLOR(level) : 'var(--fg-faint)' }}>
            posture {level ? <b>{level}</b> : '—'}{travel?.composite != null ? ` · ${travel.composite}/10` : ''}
          </span>
          <a href="/incidents" style={{ ...link, color: incidents.length ? '#ef4444' : 'var(--fg-muted)', fontWeight: 600 }}>
            {incidents.length} open incident{incidents.length === 1 ? '' : 's'} →
          </a>
        </>
      )}
      <span style={{ marginLeft: 'auto', display: 'flex', gap: '0.9rem', flexWrap: 'wrap' }}>
        <a href="/incidents/rules" style={link}>How incidents open</a>
        <a href={BOARD} style={link}>Full screen ↗</a>
        <a href="/travelrisk/classic" style={{ ...link, color: 'var(--fg-faint)' }}>Classic view</a>
      </span>
    </div>
  )

  if (mobile) {
    return (
      <>
        {strip}
        <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
          <a href={BOARD} style={{ display: 'block', textAlign: 'center', padding: '0.9rem 1rem', borderRadius: 'var(--radius)', border: '1px solid #22d3ee', color: '#22d3ee', fontWeight: 700, textDecoration: 'none' }}>
            Open World Glass (3D globe, heavy on a phone) →
          </a>
          {incidents.slice(0, 8).map((i) => {
            const slug = i.href?.startsWith('/incidents/') ? i.href.slice('/incidents/'.length) : null
            const sev = i.sev_level || 'SEV4'
            return (
              <a key={i.item_id} href={slug ? `/incidents/${slug}` : '/incidents'} style={{ display: 'block', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.75rem', textDecoration: 'none', color: 'var(--fg)' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: SEV_COLOR[sev] || '#94a3b8' }}>{sev} · {i.place || i.country || '—'} · {ago(i.onset_at)} ago</div>
                <div style={{ fontWeight: 600, marginTop: '0.2rem' }}>{i.title}</div>
                {i.why && <div style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', marginTop: '0.25rem' }}>{i.why.slice(0, 160)}</div>}
              </a>
            )
          })}
          {!incidents.length && !deskDown && <div style={{ color: 'var(--fg-faint)', fontSize: '0.875rem' }}>No open incidents right now.</div>}
        </div>
      </>
    )
  }

  return (
    <>
      {strip}
      <iframe
        src={`${BOARD}?embed=1`}
        title="World Glass — live travel risk globe"
        style={{ display: 'block', width: '100%', height: 'calc(100vh - 7.5rem)', minHeight: '640px', border: 0, background: '#060610' }}
        allow="fullscreen"
        loading="eager"
      />
    </>
  )
}
