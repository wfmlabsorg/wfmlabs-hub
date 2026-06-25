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
export type CaseStatus = 'draft' | 'assembled' | 'exported'

export interface EvidenceSource {
  title: string
  authors: string[]
  url: string
  type: SourceType
  paper_id?: number
}

export interface EvidenceCard {
  id: string
  claim: string
  grade: Grade
  source: EvidenceSource
  supports_argument: string
  state: CardState
}

export interface ArgumentBucket {
  key: string
  label: string
  card_ids: string[]
}

export interface CaseSections {
  position: string
  steelman: string
  gaps: string
  bottom_line: string
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
