import React from 'react'
import type {
  ArtifactEvidence,
  DecisionLogRow,
  EvidenceProjectionDecision,
} from '@/lib/evidence'
import { ruleKey } from '@/lib/evidence'
import { CorroborationBadge } from '@/components/incidents/CorroborationBadge'
import {
  DecisionCard,
  GeoProvenance,
  SourcesList,
  type DecisionView,
} from '@/components/evidence/EvidencePrimitives'

/**
 * SignalEvidencePanel — hub-027 / WFM-128.
 *
 * The member-facing "why is this a signal?" trace on /signals/[id]. Every signal shows the
 * decision that promoted a raw news_event into a member-facing signal, traced to source:
 * the IWS filter decision (pass + the "math" inputs + pinned model), OVIX volatility (when
 * scored), geo provenance, and the source news_event(s). Renders the `evidence` projection +
 * `decision_log` rows read by `@/lib/evidence` (getSignalEvidence).
 *
 * Read-only, server component, Mission Control theme. Degrades gracefully: signals that
 * predate the traceability instrumentation (no evidence yet) render a muted "not yet
 * available" note rather than breaking. Conforms to EVIDENCE-CONTRACT.md.
 */

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

export function SignalEvidencePanel({
  evidence,
  corroboration,
}: {
  evidence: ArtifactEvidence | null
  /** Optional live corroboration column, if the signal carries one (fallback for the badge). */
  corroboration?: unknown
}) {
  const projection = evidence?.projection ?? null
  const logRows = evidence?.decisions ?? []
  const rules = evidence?.rules ?? {}

  // Prefer decision_log rows (carry `inputs` = "the math"); fall back to the projection.
  const lastLog = (stage: string): DecisionView | null => {
    const matches = logRows.filter((r) => r.stage === stage)
    return matches.length ? fromLog(matches[matches.length - 1]) : null
  }
  const lastProj = (stage: string): DecisionView | null => {
    const matches = (projection?.decisions ?? []).filter((d) => d.stage === stage)
    return matches.length ? fromProjection(matches[matches.length - 1]) : null
  }
  const pick = (stage: string): DecisionView | null => lastLog(stage) || lastProj(stage)

  const iws = pick('iws_filter')
  const ovix = pick('ovix_score')
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
          Evidence / Why this is a signal
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
          Evidence is not yet available for this signal. Older signals predate the
          traceability layer; newly filtered signals will show why they passed the relevance
          filter, their volatility and geo provenance, and their source events here.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {iws && <DecisionCard heading="Why this is a signal" dv={iws} rule={ruleFor(iws)} />}
          {ovix && <DecisionCard heading="Volatility (OVIX)" dv={ovix} rule={ruleFor(ovix)} />}
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
              <SourcesList
                sources={projSources}
                heading="Source Events"
                emptyText="The source news event(s) and any external corroboration are listed below."
                badge={projCorroboration != null ? <CorroborationBadge corroboration={projCorroboration} /> : undefined}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
