/**
 * Neon SQL-over-HTTP helper — the single home for the Neon endpoint previously
 * hardcoded in each page that queries incidents directly.
 *
 * The endpoint host is derived from DATABASE_URI so a database move only needs
 * the env var updated; the literal below is a fallback for a malformed URI.
 */

const NEON_SQL_FALLBACK = 'https://ep-fancy-tree-apreo0lj-pooler.c-7.us-east-1.aws.neon.tech/sql'

function neonSqlEndpoint(): string {
  const uri = process.env.DATABASE_URI || ''
  const host = uri.match(/@([^/:?]+)/)?.[1]
  return host ? `https://${host}/sql` : NEON_SQL_FALLBACK
}

export async function neonQuery<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = [],
  fetchOpts: { cache?: RequestCache; next?: { revalidate?: number } } = { cache: 'no-store' },
): Promise<{ rows: T[]; rowCount: number }> {
  const connStr = process.env.DATABASE_URI || ''
  const resp = await fetch(neonSqlEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': connStr },
    body: JSON.stringify({ query, params }),
    ...fetchOpts,
  })
  if (!resp.ok) throw new Error(`Neon ${resp.status}: ${await resp.text()}`)
  return (await resp.json()) as { rows: T[]; rowCount: number }
}
