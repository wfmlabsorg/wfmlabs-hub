'use client'

import React, { useState } from 'react'
import { useSession } from 'next-auth/react'

const categories = [
  { value: 'think-tank', label: 'Think Tank', desc: 'Deep analysis and strategic thinking' },
  { value: 'opinion', label: 'Opinion', desc: 'Your perspective on WFM topics' },
  { value: 'tutorial', label: 'Tutorial', desc: 'How-to guides and walkthroughs' },
  { value: 'topic-surface', label: 'Topic Surface', desc: 'Emerging topics worth discussing' },
  { value: 'research-finding', label: 'Research Finding', desc: 'Insights from research or data' },
  { value: 'industry-analysis', label: 'Industry Analysis', desc: 'Trends and market observations' },
]

export default function SubmitArticlePage() {
  const { data: session } = useSession()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; message?: string } | null>(null)

  if (!session?.user) {
    return (
      <div style={{ maxWidth: '40rem', margin: '0 auto', padding: '4rem 1rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Submit an Article</h1>
        <p style={{ color: 'var(--fg-muted)', marginBottom: '1.5rem' }}>
          You need to be signed in to submit an article.
        </p>
        <a href="/login" className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>
          Sign In
        </a>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !category || !body.trim()) return

    setSubmitting(true)
    setResult(null)

    try {
      const resp = await fetch('/api/articles/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category, excerpt, body }),
      })
      const data = await resp.json()
      if (resp.ok) {
        setResult({ success: true, message: 'Article submitted for review. An admin will publish it shortly.' })
        setTitle('')
        setCategory('')
        setExcerpt('')
        setBody('')
      } else {
        setResult({ success: false, message: data.error || 'Submission failed' })
      }
    } catch {
      setResult({ success: false, message: 'Network error — please try again' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '2rem 1rem 4rem' }}>
      {/* Breadcrumbs */}
      <div style={{ fontSize: '0.75rem', color: 'var(--fg-faint)', marginBottom: '1.5rem' }}>
        <a href="/" style={{ color: 'var(--fg-faint)', textDecoration: 'none' }}>Home</a>
        <span style={{ margin: '0 0.5rem' }}>/</span>
        <a href="/articles" style={{ color: 'var(--fg-faint)', textDecoration: 'none' }}>Articles</a>
        <span style={{ margin: '0 0.5rem' }}>/</span>
        <span style={{ color: 'var(--fg-muted)' }}>Submit</span>
      </div>

      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        Submit an Article
      </h1>
      <p style={{ color: 'var(--fg-muted)', fontSize: '0.875rem', marginBottom: '2rem' }}>
        Share your perspective, analysis, or tutorial with the WFM Labs community. Articles are reviewed by an admin before publishing.
      </p>

      {result && (
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '1.5rem',
            background: result.success ? '#d1fae5' : '#fee2e2',
            color: result.success ? '#065f46' : '#991b1b',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          {result.message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Title */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
            Title
          </label>
          <input
            type="text"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Your article title"
            required
            style={{ width: '100%' }}
          />
        </div>

        {/* Category */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
            Category
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))', gap: '0.5rem' }}>
            {categories.map((cat) => (
              <label
                key={cat.value}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-lg)',
                  border: `2px solid ${category === cat.value ? 'var(--accent)' : 'var(--border)'}`,
                  background: category === cat.value ? 'var(--accent-bg)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
              >
                <input
                  type="radio"
                  name="category"
                  value={cat.value}
                  checked={category === cat.value}
                  onChange={() => setCategory(cat.value)}
                  style={{ display: 'none' }}
                />
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.125rem' }}>
                  {cat.label}
                </span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)' }}>
                  {cat.desc}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Excerpt */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
            Excerpt <span style={{ fontWeight: 400, color: 'var(--fg-faint)' }}>(optional — shown on the card)</span>
          </label>
          <textarea
            className="input"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="A brief summary of your article (1-2 sentences)"
            rows={2}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>

        {/* Body */}
        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.375rem' }}>
            Body <span style={{ fontWeight: 400, color: 'var(--fg-faint)' }}>(Markdown supported)</span>
          </label>
          <textarea
            className="input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your article here. Use Markdown for formatting — **bold**, *italic*, ## headings, - lists, [links](url)."
            rows={16}
            required
            style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.875rem', lineHeight: 1.6 }}
          />
          <div style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', marginTop: '0.375rem' }}>
            {body.split(/\s+/).filter(Boolean).length} words
          </div>
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || !title.trim() || !category || !body.trim()}
            style={{
              padding: '0.75rem 2rem',
              fontSize: '0.9375rem',
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? 'Submitting...' : 'Submit for Review'}
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)' }}>
            Articles are reviewed before publishing
          </span>
        </div>
      </form>
    </div>
  )
}
