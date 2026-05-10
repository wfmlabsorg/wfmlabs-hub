'use client'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>Admin Error</h1>
      <p><strong>Message:</strong> {error.message}</p>
      <p><strong>Digest:</strong> {error.digest}</p>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#f0f0f0', padding: '1rem' }}>
        {error.stack}
      </pre>
      <button onClick={reset}>Try Again</button>
    </div>
  )
}
