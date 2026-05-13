'use client'

import React, { useState, useOptimistic } from 'react'

interface ReactionBarProps {
  targetType: string
  targetId: number | string
  counts: { like: number; insightful: number; practical: number }
}

const reactionConfig = [
  { type: 'like', emoji: '\u2665', label: 'Like' },
  { type: 'insightful', emoji: '\uD83D\uDCA1', label: 'Insightful' },
  { type: 'practical', emoji: '\uD83D\uDD27', label: 'Practical' },
] as const

export function ReactionBar({ targetType, targetId, counts }: ReactionBarProps) {
  const [currentCounts, setCurrentCounts] = useState(counts)
  const [optimisticCounts, setOptimisticCounts] = useOptimistic(currentCounts)
  const [loading, setLoading] = useState<string | null>(null)

  async function handleReaction(reactionType: string) {
    if (loading) return
    setLoading(reactionType)

    // Optimistic update (increment — we don't track user state client-side)
    setOptimisticCounts((prev) => ({
      ...prev,
      [reactionType]: prev[reactionType as keyof typeof prev] + 1,
    }))

    try {
      const res = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reactionType }),
      })

      if (res.ok) {
        const data = await res.json()
        setCurrentCounts(data.counts)
      }
    } catch {
      // Revert on error
      setCurrentCounts(currentCounts)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="reaction-bar">
      {reactionConfig.map(({ type, emoji, label }) => (
        <button
          key={type}
          className="reaction-btn"
          onClick={() => handleReaction(type)}
          disabled={loading === type}
          title={label}
          type="button"
        >
          <span className="reaction-emoji">{emoji}</span>
          <span className="reaction-count">
            {optimisticCounts[type as keyof typeof optimisticCounts]}
          </span>
        </button>
      ))}
    </div>
  )
}
