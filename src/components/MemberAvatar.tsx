import React from 'react'

/**
 * Renders a member's avatar image if available, falls back to initial letter.
 * Works with Payload's resolved avatar object (depth >= 1).
 */
export function MemberAvatar({
  member,
  size = '2.75rem',
  fontSize = '1.125rem',
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  member: any
  size?: string
  fontSize?: string
}) {
  const displayName = member?.displayName || member?.username || '?'
  const avatar = member?.avatar
  // Priority: uploaded R2 avatar > OAuth avatar URL > initial letter
  const avatarUrl = (typeof avatar === 'object' && avatar?.url)
    ? avatar.url
    : (member?.avatarUrl || null)

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${displayName}`}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    )
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--accent-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        fontWeight: 600,
        color: 'var(--accent)',
        flexShrink: 0,
      }}
    >
      {displayName.charAt(0).toUpperCase()}
    </div>
  )
}
