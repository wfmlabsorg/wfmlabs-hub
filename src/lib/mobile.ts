import { headers } from 'next/headers'

/**
 * Server-side mobile browser detection via User-Agent header.
 * Use in server components (page.tsx) to conditionally render mobile layouts.
 * Do NOT use for /roc — ROC requires full screen.
 */
export async function isMobile(): Promise<boolean> {
  const userAgent = (await headers()).get('user-agent') || ''
  return /iPhone|iPad|Android|Mobile|webOS|BlackBerry|Opera Mini/i.test(userAgent)
}
