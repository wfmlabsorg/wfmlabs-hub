'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Realtime, type RealtimeChannel } from 'ably'
import { PollMessage, type PollOption } from './PollMessage'

interface ChatMessage {
  body: string
  sender: string
  senderType: 'human' | 'agent' | 'system'
  senderDisplayName?: string
  messageType?: 'text' | 'alert' | 'poll' | 'system'
  metadata?: Record<string, unknown>
  timestamp?: string
}

interface InternalMessage extends ChatMessage {
  id: string
}

interface ChatPanelProps {
  channel: string
  className?: string
  style?: React.CSSProperties
}

function formatTime(ts?: string): string {
  const d = ts ? new Date(ts) : new Date()
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ChatPanel({ channel, className, style }: ChatPanelProps) {
  const [messages, setMessages] = useState<InternalMessage[]>([])
  const [presenceCount, setPresenceCount] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [connected, setConnected] = useState(false)
  const [clientId, setClientId] = useState<string>('')

  const clientRef = useRef<Realtime | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Ably connection lifecycle
  useEffect(() => {
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

    const ch = ably.channels.get(channel)
    channelRef.current = ch

    // Subscribe to messages
    ch.subscribe('message', (msg) => {
      const data = msg.data as ChatMessage
      setMessages((prev) => [
        ...prev,
        {
          ...data,
          id: msg.id ?? `${Date.now()}-${Math.random()}`,
          timestamp: data.timestamp ?? new Date().toISOString(),
        },
      ])
    })

    // Subscribe to presence
    const updatePresence = async () => {
      try {
        const members = await ch.presence.get()
        setPresenceCount(members.length)
      } catch {
        // ignore
      }
    }

    ch.presence.enter({ status: 'online' }).catch(() => {})
    ch.presence.subscribe(() => { updatePresence() })
    updatePresence()

    return () => {
      ch.presence.leave().catch(() => {})
      ch.unsubscribe()
      ch.presence.unsubscribe()
      ably.close()
      clientRef.current = null
      channelRef.current = null
    }
  }, [channel])

  const sendMessage = useCallback(async () => {
    const body = inputValue.trim()
    if (!body || !channelRef.current || !connected) return

    setInputValue('')

    const data: ChatMessage = {
      body,
      sender: clientId,
      senderType: 'human',
      timestamp: new Date().toISOString(),
    }

    try {
      await channelRef.current.publish('message', data)
    } catch {
      // Restore on failure
      setInputValue(body)
    }
  }, [inputValue, connected, clientId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '400px',
        background: '#111827',
        borderRadius: '0.75rem',
        border: '1px solid #1e293b',
        overflow: 'hidden',
        fontFamily: "'IBM Plex Sans', sans-serif",
        ...style,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid #1e293b',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            style={{
              width: '0.5rem',
              height: '0.5rem',
              borderRadius: '50%',
              background: connected ? '#22d3ee' : '#64748b',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f1f5f9' }}>
            {channel}
          </span>
        </div>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
          {presenceCount > 0 ? `${presenceCount} online` : connected ? '1 online' : 'connecting…'}
        </span>
      </div>

      {/* Message list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.75rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.625rem',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              fontSize: '0.875rem',
            }}
          >
            No messages yet
          </div>
        )}

        {messages.map((msg) => {
          if (msg.senderType === 'system' || msg.messageType === 'system') {
            return (
              <div
                key={msg.id}
                style={{
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '0.75rem',
                  padding: '0.25rem 0',
                  fontStyle: 'italic',
                }}
              >
                {msg.body}
              </div>
            )
          }

          const isOwn = msg.sender === clientId
          const isAgent = msg.senderType === 'agent'
          const isAlert = msg.messageType === 'alert'
          const isPoll = msg.messageType === 'poll' && Array.isArray(msg.metadata?.options)

          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isOwn ? 'flex-end' : 'flex-start',
              }}
            >
              {/* Sender row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  marginBottom: '0.25rem',
                  flexDirection: isOwn ? 'row-reverse' : 'row',
                }}
              >
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: isAgent ? '#a78bfa' : '#22d3ee',
                  }}
                >
                  {msg.senderDisplayName || msg.sender}
                </span>
                {isAgent && (
                  <span
                    style={{
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      background: '#a78bfa22',
                      color: '#a78bfa',
                      border: '1px solid #a78bfa44',
                      borderRadius: '0.25rem',
                      padding: '0.0625rem 0.375rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    Agent
                  </span>
                )}
                <span style={{ fontSize: '0.625rem', color: '#64748b' }}>
                  {formatTime(msg.timestamp)}
                </span>
              </div>

              {/* Poll or Bubble */}
              {isPoll ? (
                <PollMessage
                  body={msg.body}
                  options={msg.metadata!.options as PollOption[]}
                  incidentSlug={msg.metadata?.incidentSlug as string | undefined}
                  pollType={msg.metadata?.pollType as string | undefined}
                  messageId={msg.id}
                />
              ) : (
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '0.5rem 0.75rem',
                    borderRadius: isOwn ? '0.75rem 0.75rem 0.125rem 0.75rem' : '0.75rem 0.75rem 0.75rem 0.125rem',
                    background: isOwn
                      ? '#0e7490'
                      : isAlert
                      ? '#451a0333'
                      : '#1e293b',
                    border: isAlert ? '1px solid #f59e0b44' : '1px solid transparent',
                    fontSize: '0.875rem',
                    color: isAlert ? '#f59e0b' : '#f1f5f9',
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.body}
                </div>
              )}
            </div>
          )
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          borderTop: '1px solid #1e293b',
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={connected ? 'Send a message…' : 'Connecting…'}
          disabled={!connected}
          style={{
            flex: 1,
            background: '#0b1120',
            border: '1px solid #1e293b',
            borderRadius: '0.5rem',
            padding: '0.5rem 0.75rem',
            color: '#f1f5f9',
            fontSize: '0.875rem',
            outline: 'none',
            fontFamily: "'IBM Plex Sans', sans-serif",
            opacity: connected ? 1 : 0.5,
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!connected || !inputValue.trim()}
          style={{
            padding: '0.5rem 1rem',
            background: connected && inputValue.trim() ? '#22d3ee' : '#1e293b',
            color: connected && inputValue.trim() ? '#0b1120' : '#64748b',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: connected && inputValue.trim() ? 'pointer' : 'default',
            fontFamily: "'IBM Plex Sans', sans-serif",
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
