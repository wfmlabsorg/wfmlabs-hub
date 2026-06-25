/**
 * Beacon Case Canvas — client-safe types (research-018 / WFM-92).
 *
 * Mirrors the persisted JSON contract in `src/lib/beacon/cases.ts` (the research-016 schema), but
 * defined HERE with no server imports so the client workbench bundle never drags in payload / pg /
 * the Anthropic SDK. Keep in sync with `cases.ts` if the contract changes.
 */

export type Grade = 'A' | 'B' | 'C' | 'D' | 'V' | '—'
export type CardState = 'pool' | 'cased' | 'discarded'
export type SourceType = 'internal' | 'web'
/** Source credibility tier (research-020) — see lib/beacon/tiers.ts. */
export type SourceTier = 'peer_reviewed' | 'preprint' | 'institutional' | 'vendor' | 'web_other'
/** How a card bears on the member's position (research-026). See lib/beacon/cases.ts. */
export type CardStance = 'supports' | 'challenges' | 'mixed' | 'neutral'
export type CaseStatus = 'draft' | 'assembled' | 'exported'

export interface EvidenceSource {
  title: string
  authors: string[]
  url: string
  type: SourceType
  paper_id?: number
  /** Credibility tier (research-020). Optional for cards persisted before iteration 2. */
  tier?: SourceTier
  /** Short 2–3 sentence card summary (research-023); the UI renders it under the claim. */
  abstract?: string
  /** True when fetched + ingested into the library this session (research-023) — UI tags it. */
  acquired?: boolean
}

export interface EvidenceCard {
  id: string
  claim: string
  grade: Grade
  source: EvidenceSource
  supports_argument: string
  state: CardState
  /** supports / challenges / neutral toward the member's position (research-026). */
  stance?: CardStance
  /** 1–2 sentence "why this applies to your case" note (research-026); UI falls back to claim. */
  relevance?: string
}

export interface ArgumentBucket {
  key: string
  label: string
  card_ids: string[]
}

/** Maps a `[E#]` token in section prose to the cased card it cites (research-020). */
export interface CitationRef {
  ref: string
  card_id: string
  grade: Grade
  tier?: SourceTier
  label: string
}

export interface CaseSections {
  position: string
  steelman: string
  gaps: string
  bottom_line: string
  /** Inline-citation map for `[E#]` tokens in the prose (research-020); UI renders chips. */
  citations?: CitationRef[]
}

export interface Commission {
  decision: string
  skeptic: string
  context: string
  sharpened_question: string
}

export interface CaseSummary {
  id: number
  title: string
  status: CaseStatus
  pool_count: number
  cased_count: number
  updated_at: string
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

// ── API response shapes (the research-017 engine) ──

export interface CommissionResponse {
  ready: boolean
  reply?: string
  commission?: Commission
  caseId?: number
  error?: string
}

export interface EvidenceResponse {
  caseId: number
  arguments: ArgumentBucket[]
  evidence_pool: EvidenceCard[]
  added?: number
  error?: string
}

export interface AssembleResponse {
  caseId: number
  status: CaseStatus
  sections: CaseSections
  error?: string
}
