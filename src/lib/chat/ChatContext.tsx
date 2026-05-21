'use client'
import { createContext, useContext } from 'react'
import type { Realtime } from 'ably'

interface ChatContextValue {
  client: Realtime | null
  clientId: string
  connected: boolean
}

export const ChatContext = createContext<ChatContextValue>({
  client: null,
  clientId: '',
  connected: false,
})

export function useChatClient() {
  return useContext(ChatContext)
}
