import { Pool } from 'pg'

let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URI,
      max: 5,
      idleTimeoutMillis: 30000,
      ssl: { rejectUnauthorized: false },
    })
  }
  return pool
}
