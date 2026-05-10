import type { Metadata } from 'next'
import React from 'react'
import '@/styles/globals.css'
import { GlobalNav } from '@/components/nav/GlobalNav'
import { Footer } from '@/components/nav/Footer'

export const metadata: Metadata = {
  title: {
    default: 'WFM Labs Hub',
    template: '%s | WFM Labs Hub',
  },
  description:
    'The practitioner workspace for workforce management professionals. Research, tools, and community.',
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <GlobalNav />
        <main style={{ flex: 1 }}>{children}</main>
        <Footer />
      </body>
    </html>
  )
}
