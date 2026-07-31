import { headers } from 'next/headers'
import {
  SURFACE_HEADER,
  parseSurface,
  surfaceForHost,
  type Surface,
} from './surface'

/**
 * Read the current surface inside a Server Component / Route Handler.
 *
 * Primary path: the `x-wfm-surface` request header stamped by `src/middleware.ts`.
 * Fallback: re-derive from the Host header, so a request that somehow bypassed
 * the middleware matcher still resolves correctly instead of silently showing
 * community chrome on the travel domain.
 */
export async function currentSurface(): Promise<Surface> {
  const h = await headers()
  const stamped = h.get(SURFACE_HEADER)
  if (stamped) return parseSurface(stamped)
  return surfaceForHost(h.get('host'), process.env as Record<string, string | undefined>)
}
