import type { Metadata } from 'next'
import React from 'react'
import '@/styles/globals.css'
import { GlobalNav } from '@/components/nav/GlobalNav'
import { Footer, type FooterGroup } from '@/components/nav/Footer'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { ChatSidebar, ChatProvider } from '@/components/chat'
import { headers } from 'next/headers'
import { SURFACE_CHROME } from '@/lib/surface'
import { currentSurface } from '@/lib/surface.server'

/**
 * Frontend layout, shared by BOTH domains (hub-047).
 *
 * community.wfmlabs.com → surface 'community' → exactly the chrome it has always
 * had. travelrisk.wfmlabs.com → surface 'travelrisk' → the same components with
 * travel-first nav, wordmark and metadata. One app, two presentations.
 */

// Metadata is resolved per-surface at request time. (Next.js forbids exporting
// both `metadata` and `generateMetadata` from the same file — this replaces the
// former static export; the community values are unchanged, see SURFACE_CHROME.)
export async function generateMetadata(): Promise<Metadata> {
  const chrome = SURFACE_CHROME[await currentSurface()]
  return {
    title: { default: chrome.title, template: chrome.titleTemplate },
    description: chrome.description,
  }
}

const TRAVELRISK_FOOTER: FooterGroup[] = [
  {
    title: 'Travel Risk',
    links: [
      { href: '/travelrisk#board', label: 'Risk Board' },
      { href: '/incidents', label: 'Incidents' },
      { href: '/signals', label: 'Signals' },
      { href: '/briefs', label: 'Briefs' },
    ],
  },
  {
    title: 'How it works',
    links: [
      { href: '/data-sources', label: 'Data sources' },
      { href: '/roc', label: 'ROC dashboards' },
      { href: '/research', label: 'Research' },
      { href: '/about', label: 'About' },
    ],
  },
  {
    title: 'WFM Labs',
    links: [
      { href: 'https://community.wfmlabs.com', label: 'community.wfmlabs.com' },
      { href: 'https://wfmlabs.com', label: 'wfmlabs.com' },
    ],
  },
]

export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  const userAgent = (await headers()).get('user-agent') || ''
  const mobile = /iPhone|iPad|Android|Mobile|webOS|BlackBerry|Opera Mini/i.test(userAgent)
  const surface = await currentSurface()
  const chrome = SURFACE_CHROME[surface]
  const travel = surface === 'travelrisk'

  // community keeps its exact class list; the surface hook is additive and only
  // appears on the travel domain.
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={
          (mobile ? 'device-mobile' : 'device-desktop') + (travel ? ' surface-travelrisk' : '')
        }
        style={{ margin: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
      >
        <AuthProvider>
          <ChatProvider>
            <GlobalNav
              links={chrome.navLinks}
              brand={chrome.brand}
              mark={chrome.mark}
              homeHref={chrome.homeHref}
            />
            <main style={{ flex: 1 }}>{children}</main>
            {travel ? (
              <Footer groups={TRAVELRISK_FOOTER} tagline="Travel Risk is a surface of the WFM Labs platform." />
            ) : (
              <Footer />
            )}
            <ChatSidebar />
          </ChatProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
