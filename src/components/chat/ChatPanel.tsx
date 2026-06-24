'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { RealtimeChannel } from 'ably'
import { useChatClient } from '@/lib/chat/ChatContext'
import { PollMessage, type PollOption } from './PollMessage'

interface InternalMessage {
  id: string
  body: string
  sender: string
  senderType: 'human' | 'agent' | 'system'
  senderDisplayName?: string
  messageType?: 'text' | 'alert' | 'poll' | 'system'
  metadata?: Record<string, unknown>
  timestamp?: string
  parentId?: number | null
  edited?: boolean
}

interface ChatPanelProps {
  channel: string
  className?: string
  style?: React.CSSProperties
  /** Called after a member message sends successfully (e.g. to trigger an agent responder). */
  onAfterSend?: (body: string) => void
  /** Render a subtle "thinking" indicator at the end of the list (e.g. while an agent replies). */
  agentThinking?: boolean
  thinkingLabel?: string
  /** Override the input placeholder. */
  placeholder?: string
  /** Override the header label (defaults to the raw channel name). */
  headerLabel?: string
}

function formatTime(ts?: string): string {
  const d = ts ? new Date(ts) : new Date()
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapHistoryMessage(row: any): InternalMessage {
  return {
    id: row.ably_message_id ?? String(row.id),
    body: row.body,
    sender: row.sender_username,
    senderType: row.sender_type,
    senderDisplayName: row.sender_display_name,
    messageType: row.message_type,
    metadata: row.metadata,
    timestamp: row.created_at,
    parentId: row.parent_id,
    edited: row.edited,
  }
}

export function ChatPanel({ channel, className, style, onAfterSend, agentThinking, thinkingLabel, placeholder, headerLabel }: ChatPanelProps) {
  const { client, clientId, connected } = useChatClient()

  const [messages, setMessages] = useState<InternalMessage[]>([])
  const [presenceCount, setPresenceCount] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [oldestTimestamp, setOldestTimestamp] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  // Gates the auto-scroll so the INITIAL history fetch never scrolls (which would
  // jump the whole incident page to the bottom on load — hub-017 Fix A). Armed
  // only after history lands; reset on channel change.
  const initializedRef = useRef(false)
  // Last message id we've already scrolled to — lets us distinguish a genuinely
  // NEW in-session message (scroll) from a prepend of older history (don't).
  const lastSeenIdRef = useRef<string | null>(null)

  // Auto-scroll the CHAT'S OWN container (never scrollIntoView, which would move
  // the document) — and only for a new message after the initial load.
  useEffect(() => {
    if (!initializedRef.current) return
    const lastId = messages.length > 0 ? messages[messages.length - 1].id : null
    if (lastId && lastId !== lastSeenIdRef.current) {
      lastSeenIdRef.current = lastId
      const el = scrollContainerRef.current
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [messages])

  // Load initial history
  useEffect(() => {
    setMessages([])
    setOldestTimestamp(null)
    setHasMore(true)
    setLoadingHistory(true)
    // New channel → disarm auto-scroll until its history lands.
    initializedRef.current = false
    lastSeenIdRef.current = null

    fetch(`/api/chat/history?channel=${encodeURIComponent(channel)}&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const historyMsgs: InternalMessage[] = (data.messages ?? []).reverse().map(mapHistoryMessage)
        setMessages(historyMsgs)
        if (historyMsgs.length > 0) {
          setOldestTimestamp(historyMsgs[0].timestamp ?? null)
        }
        if ((data.messages ?? []).length < 50) {
          setHasMore(false)
        }
        // Seed the last-seen id to the bottom of the initial batch so the effect
        // fired by THIS setMessages does not scroll, then arm for live messages.
        lastSeenIdRef.current =
          historyMsgs.length > 0 ? historyMsgs[historyMsgs.length - 1].id : null
        initializedRef.current = true
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [channel])

  // Subscribe to Ably channel for live messages
  useEffect(() => {
    if (!client) return

    const ch = client.channels.get(channel)
    channelRef.current = ch

    ch.subscribe('message', (msg) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = msg.data as any
      const ablyMsgId = msg.id ?? `${Date.now()}-${Math.random()}`

      setMessages((prev) => {
        // Dedup: if ably_message_id already present, skip
        if (prev.some((m) => m.id === ablyMsgId)) return prev
        return [
          ...prev,
          {
            id: ablyMsgId,
            body: data.body,
            sender: data.sender,
            senderType: data.senderType ?? 'human',
            senderDisplayName: data.senderDisplayName,
            messageType: data.messageType,
            metadata: data.metadata,
            timestamp: data.timestamp ?? new Date().toISOString(),
            parentId: data.parentId ?? null,
          },
        ]
      })
    })

    // Presence
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
      channelRef.current = null
    }
  }, [client, channel])

  // Load more on scroll to top
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el || loadingHistory || !hasMore || !oldestTimestamp) return

    if (el.scrollTop < 80) {
      setLoadingHistory(true)
      fetch(
        `/api/chat/history?channel=${encodeURIComponent(channel)}&limit=50&before=${encodeURIComponent(oldestTimestamp)}`
      )
        .then((r) => r.json())
        .then((data) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const older: InternalMessage[] = (data.messages ?? []).reverse().map(mapHistoryMessage)
          if (older.length === 0) {
            setHasMore(false)
            return
          }
          const prevScrollHeight = el.scrollHeight
          setMessages((prev) => [...older, ...prev])
          setOldestTimestamp(older[0].timestamp ?? null)
          if ((data.messages ?? []).length < 50) setHasMore(false)

          // Preserve scroll position after prepend
          requestAnimationFrame(() => {
            el.scrollTop = el.scrollHeight - prevScrollHeight
          })
        })
        .catch(() => {})
        .finally(() => setLoadingHistory(false))
    }
  }, [channel, loadingHistory, hasMore, oldestTimestamp])

  const sendMessage = useCallback(async () => {
    const body = inputValue.trim()
    if (!body || !connected) return

    const clientMsgId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`

    setInputValue('')

    // Optimistic render. The server publishes to Ably with this same id, so the
    // echo dedupes against this entry instead of duplicating it.
    setMessages((prev) => [
      ...prev,
      {
        id: clientMsgId,
        body,
        sender: clientId,
        senderType: 'human',
        timestamp: new Date().toISOString(),
        parentId: null,
      },
    ])

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, body, clientMsgId, parentId: null }),
      })
      if (!res.ok) throw new Error('send failed')
      onAfterSend?.(body)
    } catch {
      // Roll back the optimistic message and restore the input.
      setMessages((prev) => prev.filter((m) => m.id !== clientMsgId))
      setInputValue(body)
    }
  }, [inputValue, connected, clientId, channel, onAfterSend])

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
            {headerLabel || channel}
          </span>
        </div>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
          {presenceCount > 0 ? `${presenceCount} online` : connected ? '1 online' : 'connecting…'}
        </span>
      </div>

      {/* Message list */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.75rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.625rem',
        }}
      >
        {/* Load more indicator */}
        {loadingHistory && (
          <div
            style={{
              textAlign: 'center',
              color: '#64748b',
              fontSize: '0.75rem',
              padding: '0.25rem 0',
            }}
          >
            Loading…
          </div>
        )}

        {!hasMore && messages.length > 0 && (
          <div
            style={{
              textAlign: 'center',
              color: '#64748b',
              fontSize: '0.75rem',
              padding: '0.25rem 0',
              fontStyle: 'italic',
            }}
          >
            Beginning of conversation
          </div>
        )}

        {messages.length === 0 && !loadingHistory && (
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
                    borderRadius: isOwn
                      ? '0.75rem 0.75rem 0.125rem 0.75rem'
                      : '0.75rem 0.75rem 0.75rem 0.125rem',
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

        {agentThinking && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#a78bfa',
              fontSize: '0.8125rem',
              fontStyle: 'italic',
              padding: '0.25rem 0',
            }}
          >
            <span
              style={{
                width: '0.5rem',
                height: '0.5rem',
                borderRadius: '50%',
                background: '#a78bfa',
                display: 'inline-block',
                animation: 'pulse 1.2s ease-in-out infinite',
              }}
            />
            {thinkingLabel || 'Beacon is researching…'}
          </div>
        )}

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
          placeholder={connected ? (placeholder || 'Send a message…') : 'Connecting…'}
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
