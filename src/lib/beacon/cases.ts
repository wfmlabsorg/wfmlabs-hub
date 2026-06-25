/**
 * Beacon Case Canvas — shared types, member gate, and `beacon_cases` store (WFM-91 / research-017).
 *
 * The Case Canvas restructures Beacon's output from "one chat brief" (see /api/beacon/respond) into
 * a curatable, exportable artifact. This module is the engine's spine:
 *   - the JSON shapes persisted in the `beacon_cases` table (research-016 schema contract),
 *   - `gateMember()` — the auth + premium-tier gate every Case route shares (mirrors respond/propose),
 *   - raw-SQL CRUD over `beacon_cases` with member ownership enforced in every WHERE clause.
 *
 * `beacon_cases` is a raw table (outside Payload, like research_cards). Columns:
 *   id, member_id, title, status, commission jsonb, evidence_pool jsonb, arguments jsonb,
 *   sections jsonb, created_at, updated_at.  Migration ships as schema/NNN_*.sql (research-016),
 *   applied by FOREMAN pre-deploy — this code is written against that contract.
 */

import { auth } from '@/lib/auth'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getPool } from '@/lib/db'
import type { Pool } from 'pg'
import { randomUUID } from 'crypto'
import type { Grade } from '@/lib/beacon/deepread'

// ── Persisted JSON shapes (the research-016 contract) ──

export type CaseStatus = 'draft' | 'assembled' | 'exported'
/** Where a card lives on the canvas: the pool Beacon filled, kept into The Case, or discarded. */
export type CardState = 'pool' | 'cased' | 'discarded'
/** internal = WFM Labs Research Library; web = fetched via Exa when internal coverage was thin. */
export type SourceType = 'internal' | 'web'

/**
 * Source CREDIBILITY tier (research-020). Orthogonal to `type` (where it came from): `tier` is HOW
 * trustworthy it is. Drives the A–V grade rail — `vendor` forces V, `web_other` caps at C — so a
 * vendor blog can never be treated as research. Classified in `lib/beacon/tiers.ts`.
 */
export type SourceTier = 'peer_reviewed' | 'preprint' | 'institutional' | 'vendor' | 'web_other'

export interface EvidenceSource {
  title: string
  authors: string[]
  url: string
  type: SourceType
  /** Present for internal cards: the papers.id this card traces to (no-fabrication lineage). */
  paper_id?: number
  /** Credibility tier (research-020). Optional for back-compat with cards persisted pre-iter2. */
  tier?: SourceTier
}

/** One graded evidence card in the pool. `id` is a stable uuid the UI moves between regions. */
export interface EvidenceCard {
  id: string
  claim: string
  grade: Grade
  source: EvidenceSource
  /** The argument-bucket key this card sits under. */
  supports_argument: string
  state: CardState
}

/** A proposed argument bucket. `card_ids` orders the cards the UI shows under it. */
export interface ArgumentBucket {
  key: string
  label: string
  card_ids: string[]
}

/**
 * One inline-citation reference emitted by assemble (research-020): maps a `[E#]` token in the
 * section prose to the specific cased card it cites, plus that card's grade/tier so the UI (021) can
 * style and link the chip. The map covers every cased card, so any valid `[E#]` resolves.
 */
export interface CitationRef {
  ref: string // e.g. "E2"
  card_id: string
  grade: Grade
  tier?: SourceTier
  label: string // short source title / claim for the chip tooltip
}

/** The four connective sections, generated at assemble from the CASED evidence only. */
export interface CaseSections {
  position: string
  steelman: string
  gaps: string
  bottom_line: string
  /** Inline-citation map for `[E#]` tokens in the section prose (research-020). */
  citations?: CitationRef[]
}

export interface Commission {
  decision: string
  skeptic: string
  context: string
  sharpened_question: string
}

export interface BeaconCase {
  id: number
  member_id: number
  title: string
  status: CaseStatus
  commission: Commission | null
  evidence_pool: EvidenceCard[]
  arguments: ArgumentBucket[]
  sections: CaseSections | null
  created_at: string
  updated_at: string
}

export interface CaseSummary {
  id: number
  title: string
  status: CaseStatus
  pool_count: number
  cased_count: number
  updated_at: string
}

export const EMPTY_COMMISSION: Commission = { decision: '', skeptic: '', context: '', sharpened_question: '' }

export function newCardId(): string {
  return randomUUID()
}

// ── Auth + premium gate (shared by every Case route) ──

export interface GateOk {
  ok: true
  memberId: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  member: any
  payload: Awaited<ReturnType<typeof getPayload>>
  isAdmin: boolean
  pool: Pool
}

/**
 * Authenticate, load the Payload member, and enforce the premium gate — identical policy to
 * /api/beacon/respond: admins always pass; free-tier members get a 402. Returns either a GateOk
 * bundle (member + payload + pool) or a ready-to-return error `Response`. Every Case route starts
 * with `const gate = await gateMember(); if (gate instanceof Response) return gate`.
 */
export async function gateMember(): Promise<GateOk | Response> {
  const session = await auth()
  if (!session?.user?.payloadMemberId) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  const memberId = Number(session.user.payloadMemberId)
  const payload = await getPayload({ config })
  const member = await payload.findByID({ collection: 'members', id: memberId, overrideAccess: true })
  if (!member) return Response.json({ error: 'member not found' }, { status: 404 })

  const isAdmin = session.user.role === 'admin'
  if (!isAdmin && member.membershipTier === 'free') {
    return Response.json(
      { error: 'Beacon commissioned research is a premium feature.' },
      { status: 402 },
    )
  }
  return { ok: true, memberId, member, payload, isAdmin, pool: getPool() }
}

// ── beacon_cases store (raw SQL; ownership enforced in every query) ──

const CASE_COLS =
  'id, member_id, title, status, commission, evidence_pool, arguments, sections, created_at, updated_at'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToCase(r: any): BeaconCase {
  return {
    id: Number(r.id),
    member_id: Number(r.member_id),
    title: String(r.title || ''),
    status: (['draft', 'assembled', 'exported'].includes(r.status) ? r.status : 'draft') as CaseStatus,
    commission: r.commission ?? null,
    evidence_pool: Array.isArray(r.evidence_pool) ? r.evidence_pool : [],
    arguments: Array.isArray(r.arguments) ? r.arguments : [],
    sections: r.sections ?? null,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  }
}

/** Load one case the member owns; null if it doesn't exist OR belongs to someone else. */
export async function loadCase(pool: Pool, id: number, memberId: number): Promise<BeaconCase | null> {
  const res = await pool.query(
    `SELECT ${CASE_COLS} FROM beacon_cases WHERE id = $1 AND member_id = $2`,
    [id, memberId],
  )
  return res.rows[0] ? rowToCase(res.rows[0]) : null
}

/** List the member's cases, newest-updated first, with pool/cased counts for the dashboard. */
export async function listCases(pool: Pool, memberId: number): Promise<CaseSummary[]> {
  const res = await pool.query(
    `SELECT id, title, status, updated_at,
            COALESCE(jsonb_array_length(evidence_pool), 0) AS pool_count,
            COALESCE((
              SELECT count(*) FROM jsonb_array_elements(evidence_pool) c
              WHERE c->>'state' = 'cased'
            ), 0) AS cased_count
       FROM beacon_cases
      WHERE member_id = $1
      ORDER BY updated_at DESC
      LIMIT 200`,
    [memberId],
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return res.rows.map((r: any) => ({
    id: Number(r.id),
    title: String(r.title || ''),
    status: r.status as CaseStatus,
    pool_count: Number(r.pool_count) || 0,
    cased_count: Number(r.cased_count) || 0,
    updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  }))
}

/** Create a new draft case for the member. */
export async function createCase(
  pool: Pool,
  memberId: number,
  data: { title?: string; commission?: Commission | null },
): Promise<BeaconCase> {
  const res = await pool.query(
    `INSERT INTO beacon_cases (member_id, title, status, commission, evidence_pool, arguments, sections)
     VALUES ($1, $2, 'draft', $3::jsonb, '[]'::jsonb, '[]'::jsonb, NULL)
     RETURNING ${CASE_COLS}`,
    [memberId, data.title?.trim() || 'Untitled case', data.commission ? JSON.stringify(data.commission) : null],
  )
  return rowToCase(res.rows[0])
}

export interface CasePatch {
  title?: string
  status?: CaseStatus
  commission?: Commission | null
  evidence_pool?: EvidenceCard[]
  arguments?: ArgumentBucket[]
  sections?: CaseSections | null
}

/**
 * Patch a case the member owns (only the provided keys are written; `updated_at` always bumps).
 * Ownership is enforced in the WHERE clause, so a member can never mutate another member's case.
 * Returns the updated case, or null if no owned row matched.
 */
export async function updateCase(
  pool: Pool,
  id: number,
  memberId: number,
  patch: CasePatch,
): Promise<BeaconCase | null> {
  const sets: string[] = []
  const vals: unknown[] = []
  let i = 1
  const add = (sql: string, val: unknown) => {
    sets.push(sql.replace('$$', `$${i}`))
    vals.push(val)
    i++
  }
  if (patch.title !== undefined) add('title = $$', patch.title.trim() || 'Untitled case')
  if (patch.status !== undefined) add('status = $$', patch.status)
  if (patch.commission !== undefined) add('commission = $$::jsonb', patch.commission ? JSON.stringify(patch.commission) : null)
  if (patch.evidence_pool !== undefined) add('evidence_pool = $$::jsonb', JSON.stringify(patch.evidence_pool))
  if (patch.arguments !== undefined) add('arguments = $$::jsonb', JSON.stringify(patch.arguments))
  if (patch.sections !== undefined) add('sections = $$::jsonb', patch.sections ? JSON.stringify(patch.sections) : null)
  sets.push('updated_at = now()')

  if (sets.length === 1) {
    // nothing but the timestamp would change — just return the current row.
    return loadCase(pool, id, memberId)
  }
  vals.push(id, memberId)
  const res = await pool.query(
    `UPDATE beacon_cases SET ${sets.join(', ')} WHERE id = $${i} AND member_id = $${i + 1} RETURNING ${CASE_COLS}`,
    vals,
  )
  return res.rows[0] ? rowToCase(res.rows[0]) : null
}
