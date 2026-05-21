'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter } from 'next/navigation'
import { useChatClient } from '@/lib/chat/ChatContext'

interface Channel {
  name: string
  label: string
  section: string
  channelType: string
  description?: string
}

interface ChannelsResponse {
  channels: Channel[]
}

export function ChatSidebar() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const { client } = useChatClient()

  const [expanded, setExpanded] = useState(false)
  const [channels, setChannels] = useState<Channel[]>([])
  const [unread, setUnread] = useState<Record<string, number>>({})

  const subscriptionsRef = useRef<string[]>([])

  // Derive active channel from URL
  const activeChannel = useCallback((): string | null => {
    if (!pathname) return null
    const incidentMatch = pathname.match(/^\/incidents\/([^/]+)/)
    if (incidentMatch) return `incident:${incidentMatch[1]}`
    if (pathname === '/chat') return '__chat_page__'
    return null
  }, [pathname])

  // Fetch channels list
  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/chat/channels')
      .then((r) => r.json())
      .then((data: ChannelsResponse) => setChannels(data.channels ?? []))
      .catch(() => {})
  }, [status])

  // Subscribe to all channels via shared client for unread tracking
  useEffect(() => {
    if (!client || channels.length === 0) return

    // Unsubscribe previous
    subscriptionsRef.current.forEach((name) => {
      try { client.channels.get(name).unsubscribe() } catch { /* ignore */ }
    })
    subscriptionsRef.current = []

    const active = activeChannel()

    channels.forEach((ch) => {
      const ablyChannel = client.channels.get(ch.name)
      subscriptionsRef.current.push(ch.name)

      ablyChannel.subscribe('message', () => {
        const isActive =
          ch.name === active ||
          (active === '__chat_page__' && (ch.section === 'community' || ch.section === 'dm' || ch.channelType === 'community' || ch.channelType === 'dm'))

        if (!isActive) {
          setUnread((prev) => ({ ...prev, [ch.name]: (prev[ch.name] ?? 0) + 1 }))
        }
      })
    })

    return () => {
      subscriptionsRef.current.forEach((name) => {
        try { client.channels.get(name).unsubscribe() } catch { /* ignore */ }
      })
      subscriptionsRef.current = []
    }
  }, [client, channels, activeChannel])

  // Clear unread for currently active channel
  useEffect(() => {
    const active = activeChannel()
    if (!active) return

    setUnread((prev) => {
      const next = { ...prev }
      if (active === '__chat_page__') {
        Object.keys(next).forEach((k) => {
          const ch = channels.find((c) => c.name === k)
          if (ch && (ch.section === 'community' || ch.section === 'dm' || ch.channelType === 'community' || ch.channelType === 'dm')) {
            delete next[k]
          }
        })
      } else {
        delete next[active]
      }
      return next
    })
  }, [pathname, channels, activeChannel])

  if (status !== 'authenticated' || !session?.user) return null

  const totalUnread = Object.values(unread).reduce((sum, n) => sum + n, 0)

  const handleChannelClick = (ch: Channel) => {
    setUnread((prev) => {
      const next = { ...prev }
      delete next[ch.name]
      return next
    })

    const type = ch.channelType || ch.section

    if (type === 'dm') {
      const parts = ch.name.split(':')
      const me = session?.user?.name ?? ''
      const other = parts.find((p) => p !== 'dm' && p !== me) ?? parts[parts.length - 1]
      router.push(`/chat?dm=${other}`)
    } else if (type === 'incident') {
      const slug = ch.name.replace('incident:', '')
      router.push(`/incidents/${slug}`)
    } else {
      // operational, community, regional — go to /chat
      router.push('/chat')
    }
  }

  // Group channels into ordered sections
  const sectionDefs: Array<{ key: string; label: string; match: (ch: Channel) => boolean }> = [
    {
      key: 'incident',
      label: 'INCIDENTS',
      match: (ch) => ch.channelType === 'incident' || ch.section === 'incidents',
    },
    {
      key: 'operational',
      label: 'OPERATIONS',
      match: (ch) => ch.channelType === 'operational',
    },
    {
      key: 'community',
      label: 'COMMUNITY',
      match: (ch) => ch.channelType === 'community',
    },
    {
      key: 'regional',
      label: 'REGIONAL',
      match: (ch) => ch.channelType === 'regional',
    },
    {
      key: 'dm',
      label: 'DIRECT MESSAGES',
      match: (ch) => ch.channelType === 'dm' || ch.section === 'dm',
    },
  ]

  return (
    <>
      {/* Toggle button — fixed bottom-right */}
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-label="Toggle chat"
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          width: '3rem',
          height: '3rem',
          borderRadius: '50%',
          background: '#111827',
          border: '1px solid #1e293b',
          color: '#22d3ee',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50,
          flexShrink: 0,
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}
      >
        {/* Chat bubble icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>

        {/* Unread badge on toggle */}
        {!expanded && totalUnread > 0 && (
          <span
            style={{
              position: 'absolute',
              top: '-0.25rem',
              right: '-0.25rem',
              minWidth: '1.125rem',
              height: '1.125rem',
              borderRadius: '0.625rem',
              background: '#22d3ee22',
              border: '1px solid #22d3ee',
              color: '#22d3ee',
              fontSize: '0.625rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 0.25rem',
            }}
          >
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {/* Sidebar panel */}
      {expanded && (
        <div
          style={{
            position: 'fixed',
            bottom: '5rem',
            right: '1.5rem',
            width: '18.75rem',
            maxHeight: 'calc(100vh - 7rem)',
            background: '#111827',
            border: '1px solid #1e293b',
            borderRadius: '0.75rem',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            fontFamily: "'IBM Plex Sans', sans-serif",
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
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f1f5f9' }}>Chat</span>
            <button
              onClick={() => setExpanded(false)}
              aria-label="Close chat"
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '0.125rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '0.25rem',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Channel list */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '0.5rem 0' }}>
            {sectionDefs.map(({ key, label, match }) => {
              const sectionChannels = channels.filter(match)
              if (sectionChannels.length === 0) return null

              return (
                <div key={key}>
                  {/* Section header */}
                  <div
                    style={{
                      padding: '0.5rem 1rem 0.25rem',
                      fontSize: '0.625rem',
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {label}
                  </div>

                  {sectionChannels.map((ch) => {
                    const count = unread[ch.name] ?? 0
                    const isIncident = ch.channelType === 'incident' || ch.section === 'incidents'
                    const isActive =
                      activeChannel() === ch.name ||
                      (activeChannel() === '__chat_page__' &&
                        (ch.section === 'community' || ch.section === 'dm' || ch.channelType === 'community' || ch.channelType === 'dm'))

                    return (
                      <button
                        key={ch.name}
                        onClick={() => handleChannelClick(ch)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.375rem 1rem',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          borderRadius: 0,
                          gap: '0.5rem',
                        }}
                        onMouseEnter={(e) => {
                          ;(e.currentTarget as HTMLButtonElement).style.background = '#1e293b'
                        }}
                        onMouseLeave={(e) => {
                          ;(e.currentTarget as HTMLButtonElement).style.background = 'none'
                        }}
                      >
                        <span
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.375rem',
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          {/* Active incident dot */}
                          {isIncident && (
                            <span
                              style={{
                                width: '0.4375rem',
                                height: '0.4375rem',
                                borderRadius: '50%',
                                background: '#22d3ee',
                                flexShrink: 0,
                              }}
                            />
                          )}
                          <span
                            style={{
                              fontSize: '0.8125rem',
                              color: isActive ? '#f1f5f9' : count > 0 ? '#f1f5f9' : '#94a3b8',
                              fontWeight: count > 0 || isActive ? 600 : 400,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {ch.label}
                          </span>
                        </span>

                        {/* Unread badge */}
                        {count > 0 && (
                          <span
                            style={{
                              minWidth: '1.125rem',
                              height: '1.125rem',
                              borderRadius: '0.625rem',
                              background: '#22d3ee22',
                              border: '1px solid #22d3ee44',
                              color: '#22d3ee',
                              fontSize: '0.625rem',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0 0.25rem',
                              flexShrink: 0,
                            }}
                          >
                            {count > 99 ? '99+' : count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}

            {channels.length === 0 && (
              <div
                style={{
                  padding: '2rem 1rem',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '0.8125rem',
                }}
              >
                Loading channels…
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
