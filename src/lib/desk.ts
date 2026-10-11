/**
 * desk.ts — the hub's one client for desk-api (roc workers/desk-api), the travel desk's API. The rules there
 * OPEN incidents directly (no proposed state since api-075); the hub only reads the rulebook here.
 *
 * Env: DESK_API_BASE (default https://desk-api.tedlango.workers.dev). DESK_ADMIN_TOKEN is no longer used by the hub.
 */
export const DESK_API_BASE = (process.env.DESK_API_BASE || 'https://desk-api.tedlango.workers.dev').replace(/\/$/, '')

export interface DeskRules { rule: { id: string; version: string }; rules: { id: string; version: string; describe: string }[] }
export async function deskRules(): Promise<DeskRules | null> {
  try {
    const res = await fetch(`${DESK_API_BASE}/desk/rules`, { next: { revalidate: 300 } })
    return res.ok ? ((await res.json()) as DeskRules) : null
  } catch {
    return null
  }
}
