import type { Metadata } from 'next'
import React from 'react'
import '@/styles/globals.css'

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
      <body className="min-h-screen bg-background font-sans antialiased">
        <main>{children}</main>
      </body>
    </html>
  )
}
