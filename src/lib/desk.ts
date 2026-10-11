/**
 * desk.ts — the hub's one client for desk-api (roc workers/desk-api), the travel desk's API and the
 * single writer of proposed incidents (roc PR #158, one-source-of-truth phase 4).
 *
 * Proposals are MEMBERS-ONLY (Ted, 2026-10-11): desk-api hides them behind DESK_ADMIN_TOKEN, the hub
 * keeps that token in Vercel env and proxies after its own NextAuth check. Never expose the token to
 * the browser; never build a second writer here — confirm/dismiss go through desk-api so the rules,
 * the audit row and the status transition live in one place.
 *
 * Env: DESK_API_BASE (default https://desk-api.tedlango.workers.dev), DESK_ADMIN_TOKEN (required).
 */
export const DESK_API_BASE = (process.env.DESK_API_BASE || 'https://desk-api.tedlango.workers.dev').replace(/\/$/, '')

export function deskConfigured(): boolean {
  return Boolean(process.env.DESK_ADMIN_TOKEN)
}

export interface DeskProposal {
  id: number
  slug: string
  title: string
  description: string | null
  domain: string
  severity: number
  sev_level: string
  status: string
  location_name: string | null
  location_country: string | null
  location_lat: number | null
  location_lon: number | null
  related_signal_ids: number[] | null
  created_at: string
  updated_at: string | null
  declared_at: string | null
  proposed_by: string | null
  proposal_rule: string | null
  proposal_payload: Record<string, unknown> | null
  decided_by: string | null
  decided_at: string | null
}

async function deskFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = process.env.DESK_ADMIN_TOKEN
  if (!token) throw new Error('DESK_ADMIN_TOKEN is not set')
  return fetch(`${DESK_API_BASE}${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
}

export async function listDeskProposals(status: 'proposed' | 'open' | 'dismissed' = 'proposed'): Promise<DeskProposal[]> {
  const res = await deskFetch(`/desk/proposals?status=${status}`)
  if (!res.ok) throw new Error(`desk-api ${res.status}`)
  const data = (await res.json()) as { proposals?: DeskProposal[] }
  return data.proposals || []
}

export async function decideDeskProposal(
  id: number,
  action: 'confirm' | 'dismiss',
  by: string,
  reason?: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await deskFetch(`/desk/proposals/${id}/${action}`, { method: 'POST', body: JSON.stringify({ by, reason }) })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body }
}

export interface DeskRules { rule: { id: string; version: string }; rules: { id: string; version: string; describe: string }[] }
export async function deskRules(): Promise<DeskRules | null> {
  try {
    const res = await fetch(`${DESK_API_BASE}/desk/rules`, { next: { revalidate: 300 } })
    return res.ok ? ((await res.json()) as DeskRules) : null
  } catch {
    return null
  }
}
