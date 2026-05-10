'use client'

import React, { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface DiscussionFormProps {
  assetType: string
  assetId: number | string
}

export function DiscussionForm({ assetType, assetId }: DiscussionFormProps) {
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim()) return

    setError('')

    try {
      const res = await fetch('/api/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetType, assetId, body: body.trim() }),
      })

      if (res.status === 401) {
        setError('login-required')
        return
      }

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Failed to post comment')
        return
      }

      setBody('')
      startTransition(() => {
        router.refresh()
      })
    } catch {
      setError('Failed to post comment. Please try again.')
    }
  }

  if (error === 'login-required') {
    return (
      <div className="discussion-form">
        <p style={{ color: 'var(--fg-muted)', fontSize: '0.875rem' }}>
          <a href="/admin" style={{ color: 'var(--link)', fontWeight: 500 }}>Log in</a> to join the discussion.
        </p>
      </div>
    )
  }

  return (
    <form className="discussion-form" onSubmit={handleSubmit}>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share your thoughts..."
        rows={3}
        className="input"
        style={{
          resize: 'vertical',
          minHeight: '5rem',
          marginBottom: '0.75rem',
          fontFamily: 'inherit',
        }}
      />
      {error && (
        <p style={{ color: 'var(--error)', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
          {error}
        </p>
      )}
      <button
        type="submit"
        className="btn btn-primary"
        disabled={isPending || !body.trim()}
        style={{ opacity: isPending ? 0.6 : 1 }}
      >
        {isPending ? 'Posting...' : 'Post Comment'}
      </button>
    </form>
  )
}
