'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Keeps a server-rendered live surface (e.g. /incidents) current by re-fetching
 * the route's RSC payload on an interval. Ticks are skipped while the tab is
 * hidden or the user is mid-interaction (has a text selection). router.refresh()
 * preserves URL filters, scroll position, and uncontrolled DOM state such as
 * open <details> elements.
 */
export function AutoRefresh({ intervalMs = 60_000 }: { intervalMs?: number }) {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) return
      const sel = window.getSelection()
      if (sel && !sel.isCollapsed) return
      router.refresh()
    }, intervalMs)
    return () => clearInterval(id)
  }, [router, intervalMs])

  return null
}
