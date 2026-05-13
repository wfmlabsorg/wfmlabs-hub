import React from 'react'
import { RichTextContent } from '@/components/ui/RichTextContent'
import { ReactionBar } from '@/components/ui/ReactionBar'
import { getPayload } from 'payload'
import config from '@payload-config'

/* eslint-disable @typescript-eslint/no-explicit-any */
interface DiscussionEntryProps {
  discussion: any
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export async function DiscussionEntry({ discussion }: DiscussionEntryProps) {
  const author =
    typeof discussion.author === 'object' && discussion.author !== null
      ? discussion.author
      : null

  const displayName = author?.displayName || 'Anonymous'
  const initial = displayName.charAt(0).toUpperCase()

  // Fetch reaction counts for this discussion
  const payload = await getPayload({ config })
  const reactionTypes = ['like', 'insightful', 'practical'] as const
  const counts = { like: 0, insightful: 0, practical: 0 }

  for (const rType of reactionTypes) {
    const r = await payload.find({
      collection: 'reactions',
      where: {
        'target.relationTo': { equals: 'discussions' },
        'target.value': { equals: discussion.id },
        type: { equals: rType },
      },
      limit: 0,
      overrideAccess: true,
    })
    counts[rType] = r.totalDocs
  }

  return (
    <div className="discussion-entry">
      <div className="discussion-meta">
        <div className="discussion-avatar">{initial}</div>
        <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{displayName}</span>
        <span style={{ color: 'var(--fg-faint)', fontSize: '0.8125rem' }}>
          &middot; {timeAgo(discussion.createdAt)}
        </span>
      </div>
      <div className="discussion-body">
        <RichTextContent content={discussion.body} />
      </div>
      <div style={{ marginTop: '0.5rem' }}>
        <ReactionBar
          targetType="discussions"
          targetId={discussion.id}
          counts={counts}
        />
      </div>
    </div>
  )
}
