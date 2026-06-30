import React from 'react'
import type {
  ArtifactEvidence,
  DecisionLogRow,
  EvidenceProjectionDecision,
} from '@/lib/evidence'
import { ruleKey } from '@/lib/evidence'
import { CorroborationBadge } from '@/components/incidents/CorroborationBadge'

/**
 * IncidentEvidencePanel — hub-026 / WFM-125.
 *
 * The member-facing "trace back" centerpiece on /incidents/[slug]: every incident shows
 * WHY it exists, traced to source — why it was declared, why it carries its severity, the
 * geo provenance, and the constituent sources. Renders the `evidence` projection +
 * `decision_log` (for the "math" inputs) read by `@/lib/evidence`.
 *
 * Read-only, server component, Mission Control theme. Degrades gracefully: incidents that
 * predate instrumentation (no evidence yet) render a muted "not yet available" note rather
 * than breaking.
 */

// A unified decision view — from a decision_log row (preferred; carries `inputs`) or, as a
// fallback, the projection's decision summary (no inputs).
interface DecisionView {
  stage: string
  decision: string
  score: number | null
  inputs: Record<string, unknown> | null
  rule_id: string | null
  rule_version: string | null
  engine: string | null
  model_id: string | null
  prompt_version: string | null
}

function fromLog(r: DecisionLogRow): DecisionView {
  return {
    stage: r.stage,
    decision: r.decision,
    score: r.score,
    inputs: r.inputs,
    rule_id: r.rule_id,
    rule_version: r.rule_version,
    engine: r.engine,
    model_id: r.model_id,
    prompt_version: r.prompt_version,
  }
}

function fromProjection(d: EvidenceProjectionDecision): DecisionView {
  return {
    stage: d.stage,
    decision: d.decision,
    score: d.score ?? null,
    inputs: null,
    rule_id: d.rule_id ?? null,
    rule_version: d.rule_version ?? null,
    engine: d.engine ?? null,
    model_id: null,
    prompt_version: null,
  }
}

const engineConfig: Record<string, { label: string; color: string; border: string; title: string }> = {
  deterministic: {
    label: 'Deterministic',
    color: '#22d3ee',
    border: 'rgba(34,211,238,0.3)',
    title: 'A pure rule/formula made this call',
  },
  hybrid: {
    label: 'Hybrid',
    color: '#10b981',
    border: 'rgba(16,185,129,0.3)',
    title: 'An LLM proposed; a documented rule decided',
  },
  llm: {
    label: 'LLM',
    color: '#94a3b8',
    border: 'var(--border)',
    title: 'An LLM made this call directly',
  },
}

function fmtKey(k: string): string {
  return k.replace(/_/g, ' ')
}

function fmtVal(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2)
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

// ── Engine pill ──
function EnginePill({ engine }: { engine: string | null }) {
  if (!engine) return null
  const cfg = engineConfig[engine] || engineConfig.llm
  return (
    <span
      title={cfg.title}
      style={{
        fontSize: '0.625rem',
        fontWeight: 700,
        fontFamily: "'IBM Plex Mono', monospace",
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        padding: '0.1rem 0.4rem',
        borderRadius: '4px',
        background: 'transparent',
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label}
    </span>
  )
}

// ── "The math" — inputs grid ──
function InputsGrid({ inputs }: { inputs: Record<string, unknown> | null }) {
  if (!inputs) return null
  const entries = Object.entries(inputs).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return null
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))',
        gap: '0.375rem',
        marginTop: '0.625rem',
      }}
    >
      {entries.map(([k, v]) => (
        <div
          key={k}
          style={{
            padding: '0.4rem 0.55rem',
            background: 'var(--bg)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            style={{
              fontSize: '0.625rem',
              fontWeight: 600,
              color: 'var(--fg-faint)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '0.1rem',
            }}
          >
            {fmtKey(k)}
          </div>
          <div
            style={{
              fontSize: '0.8125rem',
              fontWeight: 500,
              fontFamily: "'IBM Plex Mono', monospace",
              color: 'var(--fg)',
              wordBreak: 'break-word',
            }}
          >
            {fmtVal(v)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── One decision step (why declared / why severity) ──
function DecisionCard({
  heading,
  dv,
  rule,
}: {
  heading: string
  dv: DecisionView
  rule: { title: string | null; description: string | null; formula_or_criteria: string | null } | null
}) {
  const isLlm = dv.engine === 'llm' || dv.engine === 'hybrid'
  return (
    <div
      style={{
        padding: '1rem 1.1rem',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--accent)',
      }}
    >
      {/* Heading row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            color: 'var(--fg-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {heading}
        </span>
        {/* Verdict chip */}
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            fontFamily: "'IBM Plex Mono', monospace",
            padding: '0.15rem 0.5rem',
            borderRadius: '4px',
            background: 'var(--accent-light)',
            border: '1px solid rgba(34,211,238,0.3)',
            color: 'var(--accent)',
          }}
        >
          {dv.decision}
        </span>
        {dv.score != null && (
          <span style={{ fontSize: '0.75rem', fontFamily: "'IBM Plex Mono', monospace", color: 'var(--fg-muted)' }}>
            score {fmtVal(dv.score)}
          </span>
        )}
        <span style={{ marginLeft: 'auto' }}>
          <EnginePill engine={dv.engine} />
        </span>
      </div>

      {/* Named, versioned rule */}
      {(rule || dv.rule_id) && (
        <div style={{ fontSize: '0.8125rem', color: 'var(--fg)', lineHeight: 1.5 }}>
          <span style={{ fontWeight: 600 }}>{rule?.title || dv.rule_id}</span>
          {dv.rule_version && (
            <span
              style={{
                fontSize: '0.625rem',
                fontFamily: "'IBM Plex Mono', monospace",
                color: 'var(--fg-faint)',
                marginLeft: '0.4rem',
                padding: '0.05rem 0.3rem',
                border: '1px solid var(--border)',
                borderRadius: '3px',
              }}
            >
              {dv.rule_version}
            </span>
          )}
          {(rule?.formula_or_criteria || rule?.description) && (
            <div style={{ color: 'var(--fg-muted)', marginTop: '0.2rem', fontSize: '0.8125rem' }}>
              {rule?.formula_or_criteria || rule?.description}
            </div>
          )}
        </div>
      )}

      {/* The math */}
      <InputsGrid inputs={dv.inputs} />

      {/* Reproducibility footnote for LLM-in-the-loop steps */}
      {isLlm && (dv.model_id || dv.prompt_version) && (
        <div style={{ fontSize: '0.625rem', color: 'var(--fg-faint)', fontFamily: "'IBM Plex Mono', monospace", marginTop: '0.625rem' }}>
          {dv.model_id && <span>model {dv.model_id}</span>}
          {dv.model_id && dv.prompt_version && <span> · </span>}
          {dv.prompt_version && <span>prompt {dv.prompt_version}</span>}
        </div>
      )}
    </div>
  )
}

// ── Geo provenance (tier + source) ──
function GeoProvenance({ dv }: { dv: DecisionView }) {
  const inputs = dv.inputs || {}
  const tier =
    (inputs.tier as string) ||
    (inputs.geo_tier as string) ||
    (inputs.resolution as string) ||
    dv.decision ||
    null
  const source = (inputs.source as string) || (inputs.geo_source as string) || null
  return (
    <div
      style={{
        padding: '0.875rem 1.1rem',
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border)',
        borderLeft: '3px solid var(--accent)',
      }}
    >
      <div
        style={{
          fontSize: '0.6875rem',
          fontWeight: 700,
          color: 'var(--fg-faint)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.4rem',
        }}
      >
        Geo Provenance
      </div>
      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
        {tier && (
          <div>
            <span style={{ fontSize: '0.625rem', color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '0.4rem' }}>
              Tier
            </span>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, fontFamily: "'IBM Plex Mono', monospace" }}>{tier}</span>
          </div>
        )}
        {source && (
          <div>
            <span style={{ fontSize: '0.625rem', color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '0.4rem' }}>
              Source
            </span>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, fontFamily: "'IBM Plex Mono', monospace" }}>{source}</span>
          </div>
        )}
        <span style={{ marginLeft: 'auto' }}>
          <EnginePill engine={dv.engine} />
        </span>
      </div>
      <InputsGrid inputs={dv.inputs && (tier || source) ? null : dv.inputs} />
    </div>
  )
}

// ── Provenance-recorded sources (constituent signals + external links) ──
interface NormalizedSource {
  title: string
  url: string | null
  publisher: string | null
}

function normalizeSource(raw: unknown): NormalizedSource | null {
  if (raw == null) return null
  if (typeof raw === 'string') return { title: raw, url: null, publisher: null }
  if (typeof raw !== 'object') return null
  const s = raw as Record<string, unknown>
  const url = (s.url as string) || (s.link as string) || null
  const title =
    (s.title as string) ||
    (s.name as string) ||
    (s.headline as string) ||
    url ||
    null
  if (!title) return null
  const publisher =
    (s.publisher as string) || (s.source as string) || (url ? hostOf(url) : null) || null
  return { title, url, publisher }
}

function SourcesList({ sources, corroboration }: { sources: unknown[]; corroboration: unknown }) {
  const normalized = sources
    .map(normalizeSource)
    .filter((s): s is NormalizedSource => s !== null)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '0.6875rem',
            fontWeight: 700,
            color: 'var(--fg-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Sources
        </span>
        <CorroborationBadge corroboration={corroboration} />
      </div>

      {normalized.length === 0 ? (
        <div style={{ fontSize: '0.8125rem', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
          Constituent signals and external corroboration are listed below.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {normalized.map((s, i) => {
            const inner = (
              <>
                <span style={{ fontSize: '0.8125rem', fontWeight: 500, flex: 1, lineHeight: 1.4 }}>
                  {s.title}
                  {s.url && <span style={{ color: 'var(--accent)', marginLeft: '0.375rem', fontSize: '0.75rem' }}>{'↗'}</span>}
                </span>
                {s.publisher && (
                  <span style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', whiteSpace: 'nowrap' }}>
                    {s.publisher}
                  </span>
                )}
              </>
            )
            const style: React.CSSProperties = {
              display: 'flex',
              alignItems: 'baseline',
              gap: '0.75rem',
              padding: '0.55rem 0.9rem',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              borderLeft: '3px solid var(--accent)',
              textDecoration: 'none',
              color: 'inherit',
            }
            return s.url ? (
              <a key={`${s.url}-${i}`} href={s.url} target="_blank" rel="noopener noreferrer" style={style}>
                {inner}
              </a>
            ) : (
              <div key={`src-${i}`} style={style}>
                {inner}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Panel ──
export function IncidentEvidencePanel({
  evidence,
  corroboration,
  sevLabel,
}: {
  evidence: ArtifactEvidence | null
  /** Fallback live corroboration column when the projection has none folded in. */
  corroboration: unknown
  /** e.g. "SEV3" — used for the "Why SEV3" heading. */
  sevLabel: string
}) {
  const projection = evidence?.projection ?? null
  const logRows = evidence?.decisions ?? []
  const rules = evidence?.rules ?? {}

  // Prefer decision_log rows (carry `inputs`); fall back to the projection's summary.
  const lastLog = (stage: string): DecisionView | null => {
    const matches = logRows.filter((r) => r.stage === stage)
    return matches.length ? fromLog(matches[matches.length - 1]) : null
  }
  const lastProj = (stage: string): DecisionView | null => {
    const matches = (projection?.decisions ?? []).filter((d) => d.stage === stage)
    return matches.length ? fromProjection(matches[matches.length - 1]) : null
  }
  const pick = (stage: string): DecisionView | null => lastLog(stage) || lastProj(stage)

  const declare = pick('declare')
  const severity = pick('severity')
  const geo = pick('geo_resolve')

  const ruleFor = (dv: DecisionView | null) =>
    dv && dv.rule_id && dv.rule_version ? rules[ruleKey(dv.rule_id, dv.rule_version)] ?? null : null

  const projSources = Array.isArray(projection?.sources) ? (projection!.sources as unknown[]) : []
  const projCorroboration = projection?.corroboration ?? corroboration
  const hasSourcesSection = projSources.length > 0 || projCorroboration != null

  const hasEvidence = !!projection || logRows.length > 0

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.875rem', flexWrap: 'wrap' }}>
        <h2
          style={{
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'var(--fg-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: 0,
          }}
        >
          Evidence / Why this?
        </h2>
        <span style={{ fontSize: '0.75rem', color: 'var(--fg-faint)' }}>
          Traced to source — read-only
        </span>
        {evidence?.generatedAt && (
          <span style={{ fontSize: '0.6875rem', color: 'var(--fg-faint)', marginLeft: 'auto' }}>
            Updated {new Date(evidence.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC
          </span>
        )}
      </div>

      {!hasEvidence ? (
        <div
          style={{
            padding: '1.25rem',
            border: '1px dashed var(--border)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--fg-muted)',
            fontSize: '0.875rem',
            lineHeight: 1.5,
          }}
        >
          Evidence is not yet available for this incident. Older incidents predate the
          traceability layer; newly declared incidents will show why they were declared,
          why their severity was set, geo provenance, and their sources here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {declare && <DecisionCard heading="Why declared" dv={declare} rule={ruleFor(declare)} />}
          {severity && (
            <DecisionCard heading={`Why ${sevLabel || 'this severity'}`} dv={severity} rule={ruleFor(severity)} />
          )}
          {geo && <GeoProvenance dv={geo} />}
          {hasSourcesSection && (
            <div
              style={{
                padding: '1rem 1.1rem',
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
              }}
            >
              <SourcesList sources={projSources} corroboration={projCorroboration} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
