'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Realtime } from 'ably'
import { ChatContext } from '@/lib/chat/ChatContext'

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [connected, setConnected] = useState(false)
  const [clientId, setClientId] = useState('')
  const clientRef = useRef<Realtime | null>(null)

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return

    const ably = new Realtime({
      authCallback: async (_, cb) => {
        try {
          const res = await fetch('/api/chat/auth', { method: 'POST' })
          if (!res.ok) throw new Error('Auth failed')
          cb(null, await res.json())
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Auth failed'
          cb(msg, null)
        }
      },
    })

    clientRef.current = ably

    ably.connection.on('connected', () => {
      setConnected(true)
      setClientId(ably.auth.clientId ?? '')
    })

    ably.connection.on('disconnected', () => setConnected(false))
    ably.connection.on('failed', () => setConnected(false))
    ably.connection.on('closed', () => setConnected(false))

    return () => {
      ably.close()
      clientRef.current = null
      setConnected(false)
      setClientId('')
    }
  }, [status, session?.user])

  return (
    <ChatContext.Provider value={{ client: clientRef.current, clientId, connected }}>
      {children}
    </ChatContext.Provider>
  )
}
