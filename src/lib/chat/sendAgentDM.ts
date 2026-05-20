// Server-only utility — agents (CF Workers or server actions) use this to send DMs via Ably REST API
export async function sendAgentDM({
  agentUsername,
  targetUsername,
  body,
  messageType = 'text',
  metadata,
}: {
  agentUsername: string
  targetUsername: string
  body: string
  messageType?: 'text' | 'alert' | 'poll'
  metadata?: Record<string, unknown>
}) {
  const apiKey = process.env.ABLY_API_KEY
  if (!apiKey) throw new Error('ABLY_API_KEY not set')

  const sorted = [agentUsername, targetUsername].sort()
  const channel = `dm:${sorted[0]}:${sorted[1]}`

  const [keyName, keySecret] = apiKey.split(':')
  const authHeader = Buffer.from(`${keyName}:${keySecret}`).toString('base64')

  const res = await fetch(
    `https://rest.ably.io/channels/${encodeURIComponent(channel)}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify({
        name: 'message',
        clientId: agentUsername,
        data: JSON.stringify({
          body,
          sender: agentUsername,
          senderType: 'agent',
          messageType,
          metadata,
          timestamp: new Date().toISOString(),
        }),
      }),
    },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`Ably publish failed (${res.status}): ${text}`)
  }

  return { channel }
}
