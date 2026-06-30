/**
 * evidence.ts — HUB-side reader for the Evidence Layer (hub-026 / WFM-125).
 *
 * The member-facing half of the platform traceability layer. Workers (API + AGENTS)
 * WRITE the spine via `_shared/decisionLog.ts` (logDecision + upsertEvidence); this lib
 * READS it so the incident Evidence panel can answer "why does this exist?" — traced to
 * its source.
 *
 * Spec:     ~/cloud/projects/wfmlabs-master/01-Source/EVIDENCE-LAYER-SPEC.md
 * Contract: ~/projects/roc/workers/_shared/EVIDENCE-CONTRACT.md  (authoritative shapes,
 *           stage + engine enums, evidence-projection payload). This file conforms to it.
 *
 * Read-only. Best-effort, like the worker writer: any failure (missing table before
 * migration 028, transient Neon, malformed JSON) resolves to "no evidence" rather than
 * throwing — older incidents simply won't have it yet and the panel degrades gracefully.
 *
 * Framework-free, mirroring the inline `neonQuery` the incident page already uses and the
 * worker helper: a raw POST to the Neon serverless SQL endpoint with DATABASE_URI.
 */

/** Neon serverless SQL HTTP endpoint — same one the incident page + worker helper use. */
const NEON_SQL = 'https://ep-fancy-tree-apreo0lj-pooler.c-7.us-east-1.aws.neon.tech/sql'

// ── Contract types (conform to EVIDENCE-CONTRACT.md) ──

/** A decision as carried in the read-optimized `evidence` projection (no `inputs`). */
export interface EvidenceProjectionDecision {
  stage: string
  decision: string
  score?: number | null
  rule_id?: string | null
  rule_version?: string | null
  engine?: string | null
}

/** The canonical `evidence.payload` JSONB shape (read-model for the UI). */
export interface EvidenceProjection {
  sources?: unknown[]
  decisions?: EvidenceProjectionDecision[]
  corroboration?: unknown
  generated_at?: string | null
  [k: string]: unknown
}

/** One row from `decision_log` — the source of truth, carries `inputs` ("the math"). */
export interface DecisionLogRow {
  id: number
  stage: string
  decision: string
  score: number | null
  inputs: Record<string, unknown> | null
  rule_id: string
  rule_version: string
  engine: string
  model_id: string | null
  prompt_version: string | null
  created_at: string
}

/** One row from the `decision_rules` registry — what a (rule_id, version) MEANS. */
export interface DecisionRule {
  rule_id: string
  version: string
  title: string | null
  description: string | null
  formula_or_criteria: string | null
  owning_fleet: string | null
}

/** Everything the Evidence panel needs for one artifact. */
export interface ArtifactEvidence {
  /** The denormalized projection (sources + decisions + corroboration), or null. */
  projection: EvidenceProjection | null
  /** Full decision_log rows (carry `inputs`), oldest → newest. */
  decisions: DecisionLogRow[]
  /** Resolved rule registry, keyed `${rule_id}@${version}`. */
  rules: Record<string, DecisionRule>
  /** When the projection was generated (ISO), or null. */
  generatedAt: string | null
}

/** Stable key for a (rule_id, version) pair in {@link ArtifactEvidence.rules}. */
export function ruleKey(ruleId: string, version: string): string {
  return `${ruleId}@${version}`
}

// ── Neon HTTP query (mirrors the incident page's inline helper) ──

async function neonQuery<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = [],
): Promise<{ rows: T[] }> {
  const connStr = process.env.DATABASE_URI || ''
  if (!connStr) return { rows: [] }
  const resp = await fetch(NEON_SQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Neon-Connection-String': connStr },
    body: JSON.stringify({ query, params }),
    cache: 'no-store',
  })
  if (!resp.ok) throw new Error(`Neon ${resp.status}: ${await resp.text()}`)
  return (await resp.json()) as { rows: T[] }
}

/**
 * Defensive parse of an `evidence.payload` value — may arrive as a JSON string, an object,
 * null, or malformed. Never throws; returns null when absent/unparseable.
 */
export function parseEvidenceProjection(raw: unknown): EvidenceProjection | null {
  if (raw == null) return null
  let obj: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    try {
      obj = JSON.parse(trimmed)
    } catch {
      return null
    }
  }
  if (typeof obj !== 'object' || obj === null) return null
  return obj as EvidenceProjection
}

function parseInputs(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null
  let obj: unknown = raw
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return null
    try {
      obj = JSON.parse(trimmed)
    } catch {
      return null
    }
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null
  return obj as Record<string, unknown>
}

/**
 * Read the full evidence chain for one incident.
 *
 * The `artifact_id` convention used by the (separately-built) AGENTS instrumentation is not
 * yet pinned, so we look up by BOTH the numeric id AND the slug — whichever the writer used
 * will match. Returns `null` only on a hard failure; an incident with no evidence yet
 * resolves to an all-empty {@link ArtifactEvidence} so the caller can render the graceful
 * "not yet available" state uniformly.
 */
export async function getIncidentEvidence(opts: {
  id: number | string
  slug: string
}): Promise<ArtifactEvidence | null> {
  const candidates = Array.from(
    new Set([String(opts.id), opts.slug].filter((v) => v && v.length > 0)),
  )
  if (candidates.length === 0) return { projection: null, decisions: [], rules: {}, generatedAt: null }

  try {
    // Projection (latest) + full decision_log rows, in parallel.
    const [projRes, logRes] = await Promise.all([
      neonQuery<{ payload: unknown; generated_at: string }>(
        `SELECT payload, generated_at
           FROM evidence
          WHERE artifact_type = 'incident' AND artifact_id = ANY($1)
          ORDER BY generated_at DESC
          LIMIT 1`,
        [candidates],
      ),
      neonQuery<DecisionLogRow & { inputs: unknown }>(
        `SELECT id, stage, decision, score, inputs, rule_id, rule_version,
                engine, model_id, prompt_version, created_at
           FROM decision_log
          WHERE artifact_type = 'incident' AND artifact_id = ANY($1)
          ORDER BY created_at ASC`,
        [candidates],
      ),
    ])

    const projection = parseEvidenceProjection(projRes.rows[0]?.payload)
    const generatedAt = projRes.rows[0]?.generated_at ?? projection?.generated_at ?? null

    const decisions: DecisionLogRow[] = logRes.rows.map((r) => ({
      ...r,
      score: r.score == null ? null : Number(r.score),
      inputs: parseInputs(r.inputs),
    }))

    // Resolve named rules referenced by either source. Fetch all versions of each rule_id
    // referenced, then index by (rule_id, version) — keeps the IN-list simple over HTTP.
    const ruleIds = new Set<string>()
    for (const d of decisions) if (d.rule_id) ruleIds.add(d.rule_id)
    for (const d of projection?.decisions ?? []) if (d.rule_id) ruleIds.add(d.rule_id)

    const rules: Record<string, DecisionRule> = {}
    if (ruleIds.size > 0) {
      const ruleRes = await neonQuery<DecisionRule>(
        `SELECT rule_id, version, title, description, formula_or_criteria, owning_fleet
           FROM decision_rules
          WHERE rule_id = ANY($1)`,
        [Array.from(ruleIds)],
      )
      for (const r of ruleRes.rows) rules[ruleKey(r.rule_id, r.version)] = r
    }

    return { projection, decisions, rules, generatedAt }
  } catch {
    // Best-effort: missing tables (pre-migration), transient Neon, malformed rows → absent.
    return null
  }
}
