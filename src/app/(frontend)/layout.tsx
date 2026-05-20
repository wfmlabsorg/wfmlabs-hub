import type { Metadata } from 'next'
import React from 'react'
import '@/styles/globals.css'
import { GlobalNav } from '@/components/nav/GlobalNav'
import { Footer } from '@/components/nav/Footer'
import { AuthProvider } from '@/components/providers/AuthProvider'
import { ChatSidebar } from '@/components/chat'
import { headers } from 'next/headers'

export const metadata: Metadata = {
  title: {
    default: 'WFM Labs Hub',
    template: '%s | WFM Labs Hub',
  },
  description:
    'The practitioner workspace for workforce management professionals. Research, tools, and community.',
}

export default async function FrontendLayout({ children }: { children: React.ReactNode }) {
  const userAgent = (await headers()).get('user-agent') || ''
  const mobile = /iPhone|iPad|Android|Mobile|webOS|BlackBerry|Opera Mini/i.test(userAgent)

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={mobile ? 'device-mobile' : 'device-desktop'}
        style={{ margin: 0, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
      >
        <AuthProvider>
          <GlobalNav />
          <main style={{ flex: 1 }}>{children}</main>
          <Footer />
          <ChatSidebar />
        </AuthProvider>
      </body>
    </html>
  )
}
