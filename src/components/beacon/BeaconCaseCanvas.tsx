'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { gradeStyle, GRADE_LEGEND, tierStyle, tierCaution } from './grades'
import { isWeakTier, tierLabel } from '@/lib/beacon/tiers'
import type {
  ArgumentBucket,
  AssembleResponse,
  BeaconCase,
  CardStance,
  CasePaper,
  CaseSections,
  CaseStatus,
  CaseSummary,
  CitationRef,
  Commission,
  CommissionResponse,
  EvidenceCard,
  EvidenceResponse,
  PaperEngagement,
  PaperFinding,
  PaperReference,
  PaperResponse,
  PublishResponse,
  SourceTier,
} from './types'

/**
 * Beacon Case Canvas — the analyst workbench (research-018 / WFM-92).
 *
 * Replaces the chat-dump brief with a scannable, card-based curation surface. The member commissions
 * a decision (a short terse intake), Beacon fills an Evidence Pool of GRADED, source-linked cards
 * grouped by argument, the member ADD/REMOVEs cards into The Case, then Assembles four discrete
 * structured sections (never one giant message — that's the truncation fix). Cases save & reload.
 *
 * Drives the research-017 engine: /api/beacon/{commission,evidence,assemble,cases}. Auth + the 402
 * premium gate are handled gracefully here. As of research-022 this canvas IS the /research
 * experience — the old chat Beacon was removed.
 */

// ── Mission-Control palette (matches globals.css; NO orange) ──
const T = {
  bg: '#0b1120',
  card: '#111927',
  card2: '#0f1729',
  fg: '#f1f5f9',
  muted: '#94a3b8',
  faint: '#475569',
  accent: '#22d3ee',
  accentText: '#0b1120',
  border: '#1e293b',
  borderHover: '#334155',
  violet: '#a78bfa',
  amber: '#f59e0b',
}

type Phase = 'intake' | 'canvas'
type Gate = 'ok' | 'signin' | 'premium'

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

const OTHER_KEY = '__other'

const HARD_RESEARCH_TIERS: SourceTier[] = ['peer_reviewed', 'preprint', 'institutional']
/** A card backed by hard research (peer-reviewed / preprint / institutional) — the load-bearing tiers. */
const isHardResearch = (c: EvidenceCard): boolean => !!c.source.tier && HARD_RESEARCH_TIERS.includes(c.source.tier)

export function BeaconCaseCanvas() {
  const { data: session, status } = useSession()
  const memberId = session?.user?.payloadMemberId

  const [gate, setGate] = useState<Gate>('ok')
  const [error, setError] = useState<string | null>(null)

  const [phase, setPhase] = useState<Phase>('intake')
  const [caseId, setCaseId] = useState<number | null>(null)
  const [title, setTitle] = useState<string>('')

  // commission intake
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [commission, setCommission] = useState<Commission | null>(null)

  // canvas state
  const [pool, setPool] = useState<EvidenceCard[]>([])
  const [buckets, setBuckets] = useState<ArgumentBucket[]>([])
  const [sections, setSections] = useState<CaseSections | null>(null)
  const [caseStatus, setCaseStatus] = useState<CaseStatus>('draft')

  // ui flags
  const [loadingEvidence, setLoadingEvidence] = useState(false)
  const [expanding, setExpanding] = useState<string | null>(null)
  const [webBusy, setWebBusy] = useState(false)
  const [assembling, setAssembling] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [showDiscarded, setShowDiscarded] = useState(false)
  const [addOwnFor, setAddOwnFor] = useState<string | null>(null)
  const [addOwnText, setAddOwnText] = useState('')

  // paper pipeline (research-028)
  const [paper, setPaper] = useState<CasePaper | null>(null)
  const [developing, setDeveloping] = useState(false)
  const [publishState, setPublishState] = useState<'idle' | 'publishing' | 'published' | 'unavailable' | 'error'>('idle')
  const [publishMsg, setPublishMsg] = useState<string | null>(null)

  // saved cases
  const [savedCases, setSavedCases] = useState<CaseSummary[]>([])
  const [loadingCaseId, setLoadingCaseId] = useState<number | null>(null)

  // citation-chip jump-to-source highlight
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const chatEndRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, thinking])

  // Clicking a [E#] citation chip scrolls to its source card and pulses a highlight ring.
  const highlightCard = useCallback((cardId: string) => {
    if (typeof document !== 'undefined') {
      document.getElementById(`beacon-card-${cardId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    setHighlightId(cardId)
    if (highlightTimer.current) clearTimeout(highlightTimer.current)
    highlightTimer.current = setTimeout(() => setHighlightId(null), 2200)
  }, [])
  useEffect(() => () => { if (highlightTimer.current) clearTimeout(highlightTimer.current) }, [])

  // ── gated fetch — surfaces 401/402 as graceful prompts, never crashes ──
  const callApi = useCallback(async <T2,>(url: string, body?: unknown, method = 'POST'): Promise<T2 | null> => {
    try {
      const res = await fetch(url, {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
      if (res.status === 401) {
        setGate('signin')
        return null
      }
      if (res.status === 402) {
        setGate('premium')
        return null
      }
      const json = (await res.json().catch(() => ({}))) as T2 & { error?: string }
      if (!res.ok) {
        setError(json?.error || 'Beacon hit a snag. Try again in a moment.')
        return null
      }
      setError(null)
      return json
    } catch {
      setError('Beacon is unreachable right now.')
      return null
    }
  }, [])

  const refreshSaved = useCallback(async () => {
    const j = await callApi<{ cases: CaseSummary[] }>('/api/beacon/cases', undefined, 'GET')
    if (j?.cases) setSavedCases(j.cases)
  }, [callApi])

  useEffect(() => {
    if (memberId) void refreshSaved()
  }, [memberId, refreshSaved])

  // ── evidence pool builder (also creates the case on first call) ──
  const buildEvidence = useCallback(
    async (commissionArg: Commission, existingCaseId: number | null) => {
      setLoadingEvidence(true)
      setError(null)
      const j = await callApi<EvidenceResponse>('/api/beacon/evidence', {
        ...(existingCaseId != null ? { caseId: existingCaseId } : { commission: commissionArg }),
        mode: 'initial',
      })
      setLoadingEvidence(false)
      if (!j) return
      setCaseId(j.caseId)
      setPool(j.evidence_pool || [])
      setBuckets(j.arguments || [])
      setSections(null)
      setCaseStatus('draft')
      setPhase('canvas')
      void refreshSaved()
    },
    [callApi, refreshSaved],
  )

  // ── commission intake turn ──
  const sendCommission = useCallback(async () => {
    const text = input.trim()
    if (!text || thinking) return
    const next = [...messages, { role: 'user' as const, content: text }]
    setMessages(next)
    setInput('')
    setThinking(true)
    const j = await callApi<CommissionResponse>('/api/beacon/commission', {
      messages: next,
      ...(caseId != null ? { caseId } : {}),
    })
    setThinking(false)
    if (!j) return
    if (!j.ready) {
      setMessages((m) => [...m, { role: 'assistant', content: (j.reply || '').trim() || '…' }])
      return
    }
    // Commission locked → show it, then fill the evidence pool.
    const c = j.commission!
    setCommission(c)
    setTitle(c.decision?.slice(0, 80) || 'Untitled case')
    setMessages((m) => [
      ...m,
      { role: 'assistant', content: 'Commission locked. Pulling the evidence and grouping it by argument…' },
    ])
    await buildEvidence(c, j.caseId ?? caseId)
  }, [input, thinking, messages, callApi, caseId, buildEvidence])

  // ── persist curate moves (re-send the full pool with updated states) ──
  const persist = useCallback(
    async (patch: { evidence_pool?: EvidenceCard[]; arguments?: ArgumentBucket[] }) => {
      if (caseId == null) return
      setSaveState('saving')
      const j = await callApi<{ case: BeaconCase }>('/api/beacon/cases', { id: caseId, ...patch })
      setSaveState(j ? 'saved' : 'idle')
      if (j) setTimeout(() => setSaveState('idle'), 1500)
    },
    [caseId, callApi],
  )

  const moveCard = useCallback(
    (id: string, to: EvidenceCard['state']) => {
      setPool((prev) => {
        const next = prev.map((c) => (c.id === id ? { ...c, state: to } : c))
        void persist({ evidence_pool: next })
        return next
      })
    },
    [persist],
  )

  const expandBucket = useCallback(
    async (bucketKey: string) => {
      if (caseId == null || expanding) return
      setExpanding(bucketKey)
      const j = await callApi<EvidenceResponse>('/api/beacon/evidence', { caseId, mode: 'expand', bucketKey })
      setExpanding(null)
      if (!j) return
      setPool(j.evidence_pool || [])
      setBuckets(j.arguments || [])
    },
    [caseId, expanding, callApi],
  )

  const webPass = useCallback(async () => {
    if (caseId == null || webBusy) return
    setWebBusy(true)
    const j = await callApi<EvidenceResponse>('/api/beacon/evidence', { caseId, mode: 'web' })
    setWebBusy(false)
    if (!j) return
    setPool(j.evidence_pool || [])
    setBuckets(j.arguments || [])
    setSections(null)
    setCaseStatus('draft')
    setPaper(null)
    setPublishState('idle')
    setPublishMsg(null)
  }, [caseId, webBusy, callApi])

  const submitOwnPoint = useCallback(
    (bucketKey: string) => {
      const claim = addOwnText.trim()
      if (!claim) return
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `own-${Date.now()}`
      const card: EvidenceCard = {
        id,
        claim,
        grade: '—',
        source: { title: 'Your data point', authors: [], url: '', type: 'internal' },
        supports_argument: bucketKey,
        state: 'cased',
      }
      const nextPool = [...pool, card]
      const nextBuckets = buckets.map((b) =>
        b.key === bucketKey ? { ...b, card_ids: [...b.card_ids, id] } : b,
      )
      setPool(nextPool)
      setBuckets(nextBuckets)
      setAddOwnText('')
      setAddOwnFor(null)
      void persist({ evidence_pool: nextPool, arguments: nextBuckets })
    },
    [addOwnText, pool, buckets, persist],
  )

  const assemble = useCallback(async () => {
    if (caseId == null || assembling) return
    setAssembling(true)
    const j = await callApi<AssembleResponse>('/api/beacon/assemble', { caseId })
    setAssembling(false)
    if (!j) return
    setSections(j.sections)
    setCaseStatus(j.status || 'assembled')
    // Re-assembling invalidates any paper drafted from the prior position.
    setPaper(null)
    setPublishState('idle')
    setPublishMsg(null)
  }, [caseId, assembling, callApi])

  // ── Paper Pipeline: develop the assembled case into a deep, cited paper (research-028) ──
  // A multi-call deep pass (full-text read + counter-search + synthesis) — can take a while.
  const developIntoPaper = useCallback(async () => {
    if (caseId == null || developing) return
    setDeveloping(true)
    setError(null)
    const j = await callApi<PaperResponse>('/api/beacon/paper', { caseId })
    setDeveloping(false)
    if (!j?.paper) return
    setPaper(j.paper)
    setPublishState('idle')
    setPublishMsg(null)
  }, [caseId, developing, callApi])

  // ── Publish to corpus (research-029 contract). 029 may not be merged yet: a 404 disables the
  // control with an explanatory tooltip rather than erroring — FOREMAN merges 029 alongside this PR. ──
  const publishToCorpus = useCallback(async () => {
    if (caseId == null || publishState === 'publishing' || publishState === 'published') return
    setPublishState('publishing')
    setPublishMsg(null)
    try {
      const res = await fetch('/api/beacon/paper/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      })
      if (res.status === 404) {
        setPublishState('unavailable')
        setPublishMsg('Publishing to the corpus ships with the next release.')
        return
      }
      if (res.status === 401) {
        setGate('signin')
        setPublishState('idle')
        return
      }
      if (res.status === 402) {
        setGate('premium')
        setPublishState('idle')
        return
      }
      const json = (await res.json().catch(() => ({}))) as PublishResponse
      if (!res.ok) {
        setPublishState('error')
        setPublishMsg(json?.error || 'Publish failed — try again in a moment.')
        return
      }
      setPublishState('published')
      setPublishMsg(
        json?.status
          ? `Proposed to the corpus (${json.status}) — awaiting curator ratification.`
          : 'Proposed to the corpus — awaiting curator ratification.',
      )
    } catch {
      setPublishState('error')
      setPublishMsg('Publish is unreachable right now.')
    }
  }, [caseId, publishState])

  const loadCase = useCallback(
    async (id: number) => {
      setLoadingCaseId(id)
      const j = await callApi<{ case: BeaconCase; paper: CasePaper | null }>('/api/beacon/cases', {
        action: 'load',
        id,
      })
      setLoadingCaseId(null)
      if (!j?.case) return
      const c = j.case
      setCaseId(c.id)
      setTitle(c.title)
      setCommission(c.commission)
      setPool(c.evidence_pool || [])
      setBuckets(c.arguments || [])
      setSections(c.sections)
      setCaseStatus(c.status)
      setPaper(j.paper ?? null)
      setPublishState('idle')
      setPublishMsg(null)
      setMessages([])
      setError(null)
      setPhase(c.commission || (c.evidence_pool && c.evidence_pool.length) ? 'canvas' : 'intake')
    },
    [callApi],
  )

  const newCase = useCallback(() => {
    setPhase('intake')
    setCaseId(null)
    setTitle('')
    setMessages([])
    setInput('')
    setCommission(null)
    setPool([])
    setBuckets([])
    setSections(null)
    setCaseStatus('draft')
    setPaper(null)
    setPublishState('idle')
    setPublishMsg(null)
    setError(null)
    void refreshSaved()
  }, [refreshSaved])

  // ── grouping: cards under each bucket, filtered by state, ordered by card_ids ──
  const displayBuckets = useMemo<ArgumentBucket[]>(() => {
    const known = new Set(buckets.map((b) => b.key))
    const orphanKeys = Array.from(new Set(pool.map((c) => c.supports_argument).filter((k) => !known.has(k))))
    const out = [...buckets]
    if (orphanKeys.length) {
      out.push({ key: OTHER_KEY, label: 'Other evidence', card_ids: [] })
    }
    return out
  }, [buckets, pool])

  const cardsFor = useCallback(
    (bucket: ArgumentBucket, state: EvidenceCard['state']): EvidenceCard[] => {
      const known = new Set(buckets.map((b) => b.key))
      const match = pool.filter(
        (c) =>
          c.state === state &&
          (bucket.key === OTHER_KEY ? !known.has(c.supports_argument) : c.supports_argument === bucket.key),
      )
      const order = bucket.card_ids
      return match.sort((a, b) => {
        const ia = order.indexOf(a.id)
        const ib = order.indexOf(b.id)
        return (ia === -1 ? 9999 : ia) - (ib === -1 ? 9999 : ib)
      })
    },
    [pool, buckets],
  )

  const casedCount = useMemo(() => pool.filter((c) => c.state === 'cased').length, [pool])
  const poolCount = useMemo(() => pool.filter((c) => c.state === 'pool').length, [pool])
  const discardedCount = useMemo(() => pool.filter((c) => c.state === 'discarded').length, [pool])

  // ── render gates ──
  if (status === 'loading') {
    return <Notice>Loading your workbench…</Notice>
  }
  if (!memberId || gate === 'signin') {
    return (
      <Notice>
        <strong style={{ color: T.fg }}>Beacon Case Canvas</strong> — bring a real decision and build a
        defensible, cited case you can take into the room.{' '}
        <Link href="/login" style={{ color: T.accent }}>
          Sign in
        </Link>{' '}
        to start.
      </Notice>
    )
  }
  if (gate === 'premium') {
    return (
      <Notice>
        <strong style={{ color: T.fg }}>Beacon is a premium feature.</strong> Commissioned, evidence-graded
        cases are part of the premium membership.{' '}
        <Link href="/pricing" style={{ color: T.accent }}>
          See plans
        </Link>
        .
      </Notice>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AgentPill />
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: T.fg }}>Beacon Case Canvas</h1>
          </div>
          <p style={{ margin: '0.35rem 0 0', color: T.muted, fontSize: '0.875rem', maxWidth: '44rem', lineHeight: 1.5 }}>
            Commission a decision, curate graded evidence into your case, then assemble a defensible position —
            as scannable cards, never a wall of text.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {phase === 'canvas' && (
            <button onClick={newCase} style={btnGhost}>
              + New case
            </button>
          )}
        </div>
      </div>

      {error && (
        <div style={errorBox}>
          {error}
          <button onClick={() => setError(null)} style={{ ...btnGhost, padding: '0.1rem 0.45rem', marginLeft: '0.5rem' }}>
            dismiss
          </button>
        </div>
      )}

      {phase === 'intake' ? (
        <IntakeView
          messages={messages}
          input={input}
          setInput={setInput}
          thinking={thinking}
          onSend={sendCommission}
          loadingEvidence={loadingEvidence}
          chatEndRef={chatEndRef}
          savedCases={savedCases}
          loadingCaseId={loadingCaseId}
          onLoadCase={loadCase}
        />
      ) : (
        <>
          {/* Commission header card */}
          {commission && <CommissionHeader title={title} commission={commission} status={caseStatus} />}

          {/* Toolbar */}
          <div style={toolbar}>
            <GradeLegend />
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: '0.75rem', color: T.muted }}>
              {poolCount} in pool · {casedCount} cased{discardedCount ? ` · ${discardedCount} discarded` : ''}
            </span>
            <button onClick={webPass} disabled={webBusy} style={btnGhost} title="Force a fresh web (Exa) pass and rebuild the pool">
              {webBusy ? 'Searching the web…' : '+ web sources'}
            </button>
            <label style={{ fontSize: '0.75rem', color: T.muted, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <input type="checkbox" checked={showDiscarded} onChange={(e) => setShowDiscarded(e.target.checked)} />
              show discarded
            </label>
            <SaveIndicator state={saveState} />
          </div>

          {loadingEvidence && <Notice>Pulling the evidence and grouping it by argument… this can take a moment.</Notice>}

          {/* Two regions */}
          <div style={twoCol}>
            {/* Evidence Pool */}
            <section style={region}>
              <RegionHeader
                label="Evidence Pool"
                hint="Beacon's graded candidates — hard research first; web & vendor claims are grouped below and read as claims, not evidence."
              />
              {displayBuckets.length === 0 && !loadingEvidence && (
                <p style={{ color: T.muted, fontSize: '0.85rem' }}>No evidence yet.</p>
              )}
              {displayBuckets.map((bucket) => {
                const poolCards = cardsFor(bucket, 'pool')
                const discarded = showDiscarded ? cardsFor(bucket, 'discarded') : []
                return (
                  <div key={bucket.key} style={bucketBlock}>
                    <div style={bucketHeader}>
                      <span style={{ fontWeight: 600, color: T.fg, fontSize: '0.9rem' }}>{bucket.label}</span>
                      <span style={{ flex: 1 }} />
                      {bucket.key !== OTHER_KEY && (
                        <>
                          <button
                            onClick={() => expandBucket(bucket.key)}
                            disabled={expanding === bucket.key}
                            style={miniBtn}
                          >
                            {expanding === bucket.key ? '…' : '+ more'}
                          </button>
                          <button
                            onClick={() => {
                              setAddOwnFor(addOwnFor === bucket.key ? null : bucket.key)
                              setAddOwnText('')
                            }}
                            style={miniBtn}
                          >
                            + my data
                          </button>
                        </>
                      )}
                    </div>
                    {addOwnFor === bucket.key && (
                      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
                        <input
                          autoFocus
                          value={addOwnText}
                          onChange={(e) => setAddOwnText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && submitOwnPoint(bucket.key)}
                          placeholder="Your own data point (no citation)…"
                          style={ownInput}
                        />
                        <button onClick={() => submitOwnPoint(bucket.key)} style={btnPrimarySm}>
                          Add
                        </button>
                      </div>
                    )}
                    {poolCards.length === 0 && discarded.length === 0 && (
                      <p style={{ color: T.faint, fontSize: '0.78rem', margin: '0.25rem 0 0.5rem' }}>
                        All cards in this argument are cased.
                      </p>
                    )}
                    <TieredCards
                      cards={poolCards}
                      render={(card) => (
                        <CardView
                          key={card.id}
                          card={card}
                          highlightId={highlightId}
                          primary={{ label: 'Add to Case →', onClick: () => moveCard(card.id, 'cased') }}
                          secondary={{ label: 'Discard', onClick: () => moveCard(card.id, 'discarded') }}
                        />
                      )}
                    />
                    {discarded.map((card) => (
                      <CardView
                        key={card.id}
                        card={card}
                        dimmed
                        highlightId={highlightId}
                        primary={{ label: 'Restore', onClick: () => moveCard(card.id, 'pool') }}
                      />
                    ))}
                  </div>
                )
              })}
            </section>

            {/* The Case */}
            <section style={{ ...region, borderColor: 'rgba(34,211,238,0.3)' }}>
              <RegionHeader label="The Case" hint="The cards you'll defend — grouped by argument." accent />
              {casedCount === 0 && (
                <p style={{ color: T.muted, fontSize: '0.85rem' }}>
                  Add cards from the pool to build your case. Then press <strong style={{ color: T.fg }}>Assemble</strong>.
                </p>
              )}
              {displayBuckets.map((bucket) => {
                const casedCards = cardsFor(bucket, 'cased')
                if (casedCards.length === 0) return null
                const claimsOnly =
                  casedCards.some((c) => isWeakTier(c.source.tier)) && !casedCards.some((c) => isHardResearch(c))
                return (
                  <div key={bucket.key} style={bucketBlock}>
                    <div style={bucketHeader}>
                      <span style={{ fontWeight: 600, color: T.accent, fontSize: '0.9rem' }}>{bucket.label}</span>
                      <span style={{ flex: 1 }} />
                      <span style={{ fontSize: '0.72rem', color: T.muted }}>{casedCards.length}</span>
                    </div>
                    {claimsOnly && <ArgumentWarning />}
                    <TieredCards
                      cards={casedCards}
                      render={(card) => (
                        <CardView
                          key={card.id}
                          card={card}
                          cased
                          highlightId={highlightId}
                          primary={{ label: '← Remove', onClick: () => moveCard(card.id, 'pool') }}
                        />
                      )}
                    />
                  </div>
                )
              })}

              {/* Assemble */}
              <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button onClick={assemble} disabled={assembling || casedCount === 0} style={btnPrimary}>
                  {assembling ? 'Assembling…' : sections ? 'Re-assemble' : 'Assemble the case'}
                </button>
                <span style={{ fontSize: '0.75rem', color: T.muted }}>
                  Generates the four sections from your cased evidence only.
                </span>
              </div>
            </section>
          </div>

          {/* Assembled sections — discrete collapsible blocks (the truncation fix) */}
          {sections && <SectionsView sections={sections} onCite={highlightCard} />}

          {/* Paper Pipeline — develop the assembled case into a deep, balanced, cited paper (research-028) */}
          {sections && (
            <PaperPipeline
              paper={paper}
              developing={developing}
              onDevelop={developIntoPaper}
              caseId={caseId}
              onPublish={publishToCorpus}
              publishState={publishState}
              publishMsg={publishMsg}
            />
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────── sub-components ───────────────────────────

function IntakeView(props: {
  messages: ChatMsg[]
  input: string
  setInput: (v: string) => void
  thinking: boolean
  onSend: () => void
  loadingEvidence: boolean
  chatEndRef: React.RefObject<HTMLDivElement | null>
  savedCases: CaseSummary[]
  loadingCaseId: number | null
  onLoadCase: (id: number) => void
}) {
  const { messages, input, setInput, thinking, onSend, loadingEvidence, chatEndRef, savedCases, loadingCaseId, onLoadCase } =
    props
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: '1rem', alignItems: 'start' }}>
      {/* commission rail */}
      <div style={{ ...region }}>
        <RegionHeader label="Commission" hint="Tell Beacon the decision you need to defend. It locks a sharp question, then fills the pool." />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            minHeight: '12rem',
            maxHeight: '26rem',
            overflowY: 'auto',
            padding: '0.25rem',
          }}
        >
          {messages.length === 0 && (
            <p style={{ color: T.muted, fontSize: '0.85rem', lineHeight: 1.55, margin: 0 }}>
              e.g. <em>“I want to drop after-call work targets and let agents self-pace. I have to defend it to my
              ops director for a 400-seat sales center.”</em>
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: m.role === 'user' ? 'rgba(34,211,238,0.1)' : T.card2,
                border: `1px solid ${m.role === 'user' ? 'rgba(34,211,238,0.3)' : T.border}`,
                borderRadius: '0.6rem',
                padding: '0.55rem 0.75rem',
                color: m.role === 'user' ? T.fg : T.muted,
                fontSize: '0.875rem',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.content}
            </div>
          ))}
          {(thinking || loadingEvidence) && (
            <div style={{ alignSelf: 'flex-start', color: T.muted, fontSize: '0.8rem', fontStyle: 'italic' }}>
              {loadingEvidence ? 'Pulling and grading the evidence…' : 'Beacon is thinking…'}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
            }}
            placeholder="Describe the decision you need to defend…"
            rows={2}
            disabled={thinking || loadingEvidence}
            style={{
              flex: 1,
              resize: 'vertical',
              background: T.bg,
              border: `1px solid ${T.border}`,
              borderRadius: '0.5rem',
              color: T.fg,
              padding: '0.6rem 0.75rem',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
            }}
          />
          <button onClick={onSend} disabled={thinking || loadingEvidence || !input.trim()} style={btnPrimary}>
            Send
          </button>
        </div>
      </div>

      {/* saved cases */}
      <SavedCasesPanel savedCases={savedCases} loadingCaseId={loadingCaseId} onLoadCase={onLoadCase} />
    </div>
  )
}

function SavedCasesPanel(props: {
  savedCases: CaseSummary[]
  loadingCaseId: number | null
  onLoadCase: (id: number) => void
}) {
  const { savedCases, loadingCaseId, onLoadCase } = props
  return (
    <div style={region}>
      <RegionHeader label="My cases" hint="Reload a case you started earlier." />
      {savedCases.length === 0 ? (
        <p style={{ color: T.muted, fontSize: '0.82rem' }}>No saved cases yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {savedCases.map((c) => (
            <button
              key={c.id}
              onClick={() => onLoadCase(c.id)}
              disabled={loadingCaseId === c.id}
              style={{
                textAlign: 'left',
                background: T.card2,
                border: `1px solid ${T.border}`,
                borderRadius: '0.5rem',
                padding: '0.6rem 0.7rem',
                color: T.fg,
                cursor: 'pointer',
                fontSize: '0.82rem',
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>
                {loadingCaseId === c.id ? 'Loading…' : c.title || 'Untitled case'}
              </div>
              <div style={{ color: T.muted, fontSize: '0.72rem' }}>
                <StatusTag status={c.status} /> · {c.cased_count}/{c.pool_count} cased ·{' '}
                {new Date(c.updated_at).toLocaleDateString()}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CommissionHeader({ title, commission, status }: { title: string; commission: Commission; status: CaseStatus }) {
  const fields: [string, string][] = [
    ['Decision', commission.decision],
    ['Skeptic', commission.skeptic],
    ['Context', commission.context],
    ['Question', commission.sharpened_question],
  ]
  return (
    <div style={{ ...region, borderColor: 'rgba(34,211,238,0.25)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: T.fg }}>{title || 'Commission'}</span>
        <StatusTag status={status} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))', gap: '0.5rem 1.25rem' }}>
        {fields
          .filter(([, v]) => v && v.trim())
          .map(([label, v]) => (
            <div key={label}>
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: T.faint }}>
                {label}
              </div>
              <div style={{ fontSize: '0.85rem', color: T.muted, lineHeight: 1.45 }}>{v}</div>
            </div>
          ))}
      </div>
    </div>
  )
}

function CardView(props: {
  card: EvidenceCard
  cased?: boolean
  dimmed?: boolean
  highlightId?: string | null
  primary: { label: string; onClick: () => void }
  secondary?: { label: string; onClick: () => void }
}) {
  const { card, cased, dimmed, highlightId, primary, secondary } = props
  const g = gradeStyle(card.grade)
  const isWeb = card.source.type === 'web'
  const isOwn = !card.source.url && card.source.title === 'Your data point'
  const authors = card.source.authors.slice(0, 4).join(', ')
  const abstract = card.source.abstract?.trim()
  const tier = card.source.tier
  const weak = isWeakTier(tier) // vendor / web_other → muted + caution
  const caution = tierCaution(tier)
  const highlighted = highlightId === card.id
  // research-026 anatomy: Title → Authors → Type → Abstract → Why-applies(support/challenge) → actions.
  // Title leads with the source title; own data points have no real title, so the claim is the title.
  const title = isOwn ? card.claim : card.source.title || card.claim
  return (
    <div
      id={`beacon-card-${card.id}`}
      style={{
        // Weak (vendor/web) cards read as claims: hollow, dashed, muted — never like research.
        background: weak ? 'transparent' : cased ? 'rgba(34,211,238,0.06)' : T.card2,
        border: `1px ${weak ? 'dashed' : 'solid'} ${
          highlighted ? T.accent : weak ? T.borderHover : cased ? 'rgba(34,211,238,0.25)' : T.border
        }`,
        borderRadius: '0.55rem',
        padding: weak ? '0.5rem 0.65rem' : '0.65rem 0.75rem',
        marginBottom: '0.5rem',
        opacity: dimmed ? 0.55 : weak ? 0.82 : 1,
        boxShadow: highlighted ? `0 0 0 2px ${T.accent}` : 'none',
        transition: 'box-shadow 0.25s ease, border-color 0.25s ease',
        scrollMarginTop: '1.5rem',
      }}
    >
      {/* 1. TITLE (+ grade badge, kept) */}
      <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <p
          style={{
            margin: 0,
            fontSize: weak ? '0.86rem' : '0.92rem',
            fontWeight: 600,
            color: weak ? T.muted : T.fg,
            lineHeight: 1.4,
            overflowWrap: 'anywhere',
          }}
        >
          {title}
        </p>
        <span
          title={g.label}
          style={{
            flexShrink: 0,
            width: '1.5rem',
            height: '1.5rem',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.8rem',
            color: g.color,
            background: g.bg,
            border: `1px solid ${g.border}`,
            borderRadius: '0.35rem',
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          {card.grade}
        </span>
      </div>

      {/* 2. AUTHORS */}
      {authors && (
        <p style={{ margin: '0.2rem 0 0', fontSize: '0.74rem', color: T.faint, overflowWrap: 'anywhere' }}>{authors}</p>
      )}

      {/* 3. TYPE BADGE (tier) + provenance tags */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
        <SourceTag isWeb={isWeb} isOwn={isOwn} />
        <TierTag tier={tier} />
        {card.source.acquired && <AcquiredTag />}
        {caution && <CautionBadge text={caution} />}
        {card.source.url && (
          <a
            href={card.source.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.75rem', fontWeight: 600, color: T.accent, textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            Read full ↗
          </a>
        )}
      </div>

      {/* 4. ABSTRACT */}
      {abstract && <CardAbstract text={abstract} weak={weak} />}

      {/* 5. WHY THIS APPLIES (relevance rationale + supports/challenges) */}
      <WhyApplies stance={card.stance} relevance={card.relevance} claim={card.claim} isOwn={isOwn} />

      {/* 6. ACTIONS */}
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.55rem', justifyContent: 'flex-end' }}>
        {secondary && (
          <button onClick={secondary.onClick} style={miniBtn}>
            {secondary.label}
          </button>
        )}
        <button onClick={primary.onClick} style={cased ? miniBtn : btnPrimarySm}>
          {primary.label}
        </button>
      </div>
    </div>
  )
}

/**
 * "Why this applies to your case" (research-026) — the relevance rationale from the appraiser, with a
 * support/challenge marker. The body is the grounded `relevance` note; when a card predates iter-4 (no
 * note), it falls back to the extracted claim so the block is never empty. No fabrication: every word
 * here came from the deepRead appraisal or the card's own finding.
 */
function WhyApplies({
  stance,
  relevance,
  claim,
  isOwn,
}: {
  stance?: CardStance
  relevance?: string
  claim: string
  isOwn: boolean
}) {
  const note = relevance?.trim()
  // Own data points carry no appraisal; the claim IS the member's assertion. Otherwise fall back to the
  // extracted finding when no appraiser note exists (legacy cards), so the block is never empty.
  const body = note || claim
  const showClaimToo = !!note && !isOwn && claim.trim() !== '' && claim.trim() !== note
  return (
    <div
      style={{
        marginTop: '0.5rem',
        paddingTop: '0.45rem',
        borderTop: `1px solid ${T.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '0.64rem',
            fontWeight: 700,
            color: T.faint,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {isOwn ? 'Your point' : 'Why this applies to your case'}
        </span>
        <StanceMarker stance={stance} />
      </div>
      <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem', color: T.muted, lineHeight: 1.5 }}>{body}</p>
      {showClaimToo && (
        <p style={{ margin: '0.3rem 0 0', fontSize: '0.74rem', color: T.faint, lineHeight: 1.45 }}>
          <span style={{ fontWeight: 600, color: T.muted }}>Finding: </span>
          {claim}
        </p>
      )}
    </div>
  )
}

/**
 * The supports/challenges marker (research-026): a small, visually distinct chip so a member reads a
 * card's direction at a glance — ↑ supports (green), ↯ challenges (violet, the steelman colour), ⇅
 * mixed (amber). Neutral/context renders a muted dot; an unset stance (legacy cards) renders nothing.
 */
function StanceMarker({ stance }: { stance?: CardStance }) {
  if (!stance) return null
  const map: Record<CardStance, { symbol: string; label: string; color: string; bg: string; border: string }> = {
    supports: { symbol: '↑', label: 'Supports', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.4)' },
    challenges: { symbol: '↯', label: 'Challenges', color: T.violet, bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.4)' },
    mixed: { symbol: '⇅', label: 'Mixed', color: T.amber, bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.4)' },
    neutral: { symbol: '·', label: 'Context', color: T.faint, bg: 'transparent', border: T.border },
  }
  const s = map[stance]
  return (
    <span
      title={`This source ${stance === 'neutral' ? 'is context for' : stance === 'mixed' ? 'is mixed on' : stance + ' '}your position`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.2rem',
        fontSize: '0.64rem',
        fontWeight: 700,
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: '0.25rem',
        padding: '0.05rem 0.35rem',
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        flexShrink: 0,
      }}
    >
      <span aria-hidden>{s.symbol}</span>
      {s.label}
    </span>
  )
}

/** A card's 2–3 sentence abstract (research-023). Clamped to 2 lines for scannability; long ones expand. */
function CardAbstract({ text, weak }: { text: string; weak: boolean }) {
  const [open, setOpen] = useState(false)
  // Heuristic: short abstracts (a sentence or two) render whole — no toggle clutter.
  const long = text.length > 160
  return (
    <div style={{ marginTop: '0.35rem' }}>
      <p
        style={{
          margin: 0,
          fontSize: weak ? '0.74rem' : '0.78rem',
          color: T.muted,
          lineHeight: 1.5,
          ...(long && !open
            ? {
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical' as const,
                overflow: 'hidden',
              }
            : {}),
        }}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            marginTop: '0.15rem',
            background: 'transparent',
            border: 'none',
            padding: 0,
            color: T.faint,
            fontSize: '0.7rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {open ? 'Show less' : 'More'}
        </button>
      )}
    </div>
  )
}

/** Tags a card fetched + ingested into the library this session (research-023). */
function AcquiredTag() {
  return (
    <span
      title="Fetched and added to the library this session"
      style={{
        fontSize: '0.6rem',
        fontWeight: 700,
        color: T.violet,
        background: 'rgba(167,139,250,0.13)',
        border: '1px solid rgba(167,139,250,0.35)',
        borderRadius: '0.25rem',
        padding: '0.05rem 0.35rem',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        flexShrink: 0,
      }}
    >
      Added to library
    </span>
  )
}

function SectionsView({ sections, onCite }: { sections: CaseSections; onCite: (cardId: string) => void }) {
  const blocks: { key: 'position' | 'steelman' | 'gaps' | 'bottom_line'; label: string; color: string }[] = [
    { key: 'position', label: 'Position', color: T.accent },
    { key: 'steelman', label: 'Steelman (the other side)', color: T.violet },
    { key: 'gaps', label: 'Where the evidence runs out', color: T.amber },
    { key: 'bottom_line', label: 'Bottom line', color: '#22c55e' },
  ]
  // Resolve every [E#] token in the prose to its cased source card (research-020 citations map).
  const citeByRef = useMemo(() => {
    const m = new Map<string, CitationRef>()
    for (const c of sections.citations || []) m.set(c.ref, c)
    return m
  }, [sections.citations])
  return (
    <div style={{ ...region }}>
      <RegionHeader
        label="Assembled position"
        hint="Synthesized from your cased evidence only. [E#] chips link to the source card — weak (web/vendor) citations read muted."
        accent
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {blocks.map(({ key, label, color }) => (
          <details key={key} open style={{ border: `1px solid ${T.border}`, borderRadius: '0.55rem', background: T.card2 }}>
            <summary
              style={{
                cursor: 'pointer',
                padding: '0.6rem 0.8rem',
                fontWeight: 600,
                fontSize: '0.85rem',
                color,
                listStyle: 'none',
                borderLeft: `3px solid ${color}`,
                borderRadius: '0.55rem 0.55rem 0 0',
              }}
            >
              {label}
            </summary>
            <div style={{ margin: 0, padding: '0 0.85rem 0.8rem', fontSize: '0.875rem', color: T.fg, lineHeight: 1.6 }}>
              {sections[key]?.trim() ? renderCitedProse(sections[key], citeByRef, onCite) : <span style={{ color: T.faint }}>—</span>}
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}

const CITE_RE = /\[E\d+\]/g

/** Render section prose, splitting on `\n\n` into paragraphs and turning `[E#]` tokens into chips. */
function renderCitedProse(
  text: string,
  citeByRef: Map<string, CitationRef>,
  onCite: (cardId: string) => void,
): React.ReactNode {
  const paras = text.split(/\n{2,}/)
  return paras.map((para, pi) => (
    <p key={pi} style={{ margin: pi === 0 ? '0' : '0.6rem 0 0', lineHeight: 1.6 }}>
      {renderInlineCitations(para, citeByRef, onCite)}
    </p>
  ))
}

function renderInlineCitations(
  text: string,
  citeByRef: Map<string, CitationRef>,
  onCite: (cardId: string) => void,
): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  CITE_RE.lastIndex = 0
  while ((m = CITE_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const ref = m[0].slice(1, -1) // "E3"
    const cite = citeByRef.get(ref)
    out.push(<CitationChip key={`cite-${i++}`} token={m[0]} cite={cite} onCite={onCite} />)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function CitationChip({
  token,
  cite,
  onCite,
}: {
  token: string
  cite: CitationRef | undefined
  onCite: (cardId: string) => void
}) {
  // Unknown ref (model emitted a token not in the map) — render the raw token, faint, non-interactive.
  if (!cite) return <span style={{ color: T.faint }}>{token}</span>
  const g = gradeStyle(cite.grade)
  const weak = isWeakTier(cite.tier)
  const tierTxt = cite.tier ? tierLabel(cite.tier) : 'source'
  return (
    <button
      type="button"
      onClick={() => onCite(cite.card_id)}
      title={`${cite.label} · ${tierTxt} · grade ${cite.grade}${weak ? ' — weak: a claim, not research' : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.15rem',
        verticalAlign: 'baseline',
        margin: '0 0.12rem',
        padding: '0 0.32rem',
        fontSize: '0.7rem',
        fontWeight: 700,
        fontFamily: "'IBM Plex Mono', monospace",
        color: g.color,
        background: weak ? 'transparent' : g.bg,
        border: `1px ${weak ? 'dashed' : 'solid'} ${g.border}`,
        borderRadius: '0.25rem',
        cursor: 'pointer',
        opacity: weak ? 0.85 : 1,
        lineHeight: 1.4,
      }}
    >
      {cite.ref}
      <span style={{ opacity: 0.85 }}>·{cite.grade}</span>
    </button>
  )
}

// ═══════════════════════════ Paper Pipeline (research-028) ═══════════════════════════

/**
 * The Paper Pipeline panel — launches "Develop into a paper" from an assembled case, shows the deep-pass
 * progress, then renders the drafted paper (PaperView) with export + publish-to-corpus controls.
 *
 * Developing a paper is a multi-call deep pass (full-text read of the cased papers → a dedicated
 * counter-search for disconfirming evidence → one synthesis call), so the button surfaces a clear,
 * patient progress state — it can take a minute or two.
 */
function PaperPipeline(props: {
  paper: CasePaper | null
  developing: boolean
  onDevelop: () => void
  caseId: number | null
  onPublish: () => void
  publishState: 'idle' | 'publishing' | 'published' | 'unavailable' | 'error'
  publishMsg: string | null
}) {
  const { paper, developing, onDevelop, caseId, onPublish, publishState, publishMsg } = props

  return (
    <div style={{ ...region, borderColor: 'rgba(167,139,250,0.3)' }}>
      <RegionHeader
        label="Develop into a paper"
        hint="Reads your cased papers' FULL TEXT, hunts for disconfirming evidence, and drafts a balanced, honestly-cited paper — supporting AND challenging findings, never buried."
        accent
      />

      {!paper && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={onDevelop} disabled={developing} style={btnPrimary}>
              {developing ? 'Developing the paper…' : 'Develop into a paper'}
            </button>
            <span style={{ fontSize: '0.75rem', color: T.muted }}>
              A deep, full-text engagement pass — distinct from the assembled brief above.
            </span>
          </div>
          {developing && (
            <div style={paperProgress}>
              <span style={{ color: T.violet, fontWeight: 600 }}>Working…</span> reading full text, searching for
              counter-evidence, and synthesizing the draft. This is a deep pass and can take a minute or two — keep
              this tab open.
            </div>
          )}
        </div>
      )}

      {paper && (
        <>
          <PaperView paper={paper} />

          {/* Paper actions: re-develop · export · publish to corpus */}
          <div style={paperActions}>
            <button onClick={onDevelop} disabled={developing} style={btnGhost} title="Run the deep pass again">
              {developing ? 'Re-developing…' : 'Re-develop'}
            </button>
            <span style={{ flex: 1 }} />
            {caseId != null && (
              <span style={{ display: 'inline-flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <ExportLink caseId={caseId} format="md" label="Markdown" download />
                <ExportLink caseId={caseId} format="pdf" label="PDF (print)" />
                <ExportLink caseId={caseId} format="doc" label="Doc" download />
              </span>
            )}
            <PublishButton onPublish={onPublish} publishState={publishState} />
          </div>
          {publishMsg && (
            <p
              style={{
                margin: '0.5rem 0 0',
                fontSize: '0.78rem',
                color: publishState === 'published' ? '#22c55e' : publishState === 'error' ? T.amber : T.muted,
              }}
            >
              {publishMsg}
            </p>
          )}
        </>
      )}
    </div>
  )
}

/** An export link that hits /api/beacon/paper/export. `download` forces a file save; PDF opens a print tab. */
function ExportLink({
  caseId,
  format,
  label,
  download,
}: {
  caseId: number
  format: 'md' | 'pdf' | 'doc'
  label: string
  download?: boolean
}) {
  const href = `/api/beacon/paper/export?caseId=${caseId}&format=${format}`
  return (
    <a
      href={href}
      {...(download ? { download: '' } : { target: '_blank', rel: 'noopener noreferrer' })}
      style={{ ...miniBtn, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
    >
      {label}
    </a>
  )
}

/** Publish-to-corpus control (wired to research-029). A 404 (029 not yet merged) disables it with a tooltip. */
function PublishButton({
  onPublish,
  publishState,
}: {
  onPublish: () => void
  publishState: 'idle' | 'publishing' | 'published' | 'unavailable' | 'error'
}) {
  const unavailable = publishState === 'unavailable'
  const done = publishState === 'published'
  const label =
    publishState === 'publishing'
      ? 'Publishing…'
      : done
        ? 'Proposed ✓'
        : unavailable
          ? 'Publish to corpus (soon)'
          : 'Publish to corpus'
  return (
    <button
      onClick={onPublish}
      disabled={publishState === 'publishing' || done || unavailable}
      title={
        unavailable
          ? 'Publishing to the WFM Labs corpus ships with the next release.'
          : 'Propose this paper as an original WFM Labs paper (curator-ratified, then citable in future cases).'
      }
      style={{
        ...btnPrimary,
        background: done ? '#22c55e' : unavailable ? 'transparent' : T.violet,
        color: unavailable ? T.muted : T.accentText,
        border: `1px solid ${done ? '#22c55e' : unavailable ? T.border : T.violet}`,
        opacity: unavailable ? 0.7 : 1,
        cursor: publishState === 'publishing' || done || unavailable ? 'default' : 'pointer',
      }}
    >
      {label}
    </button>
  )
}

const PAPER_SECTIONS: { key: Exclude<keyof CasePaper['draft'], 'references'>; label: string; open?: boolean }[] = [
  { key: 'abstract', label: 'Abstract', open: true },
  { key: 'introduction', label: 'Introduction' },
  { key: 'theory', label: 'Theory — the position' },
  { key: 'evidence_for', label: 'Evidence for' },
  { key: 'counter_case_and_limitations', label: 'Counter-case & limitations' },
  { key: 'discussion', label: 'Discussion' },
  { key: 'conclusion', label: 'Conclusion' },
]

/**
 * Renders the developed paper: drafted sections (collapsible, with [E#]/[C#] citation chips), the
 * deep-engagement panel (supporting vs challenging, shown honestly), and the references list. Inline
 * citation chips and engagement ref chips scroll to — and pulse — the matching reference entry.
 */
function PaperView({ paper }: { paper: CasePaper }) {
  const { draft, engagement } = paper
  const refMap = useMemo(() => {
    const m = new Map<string, PaperReference>()
    for (const r of draft.references || []) m.set(r.ref, r)
    return m
  }, [draft.references])

  const [highlightRef, setHighlightRef] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onCite = useCallback((ref: string) => {
    if (typeof document !== 'undefined') {
      document.getElementById(`beacon-ref-${ref}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    setHighlightRef(ref)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setHighlightRef(null), 2200)
  }, [])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.25rem' }}>
      {/* Paper title + provenance */}
      <div>
        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: T.fg, lineHeight: 1.35 }}>
          {draft.title || 'Untitled paper'}
        </h3>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: T.faint }}>
          Original synthesis · Beacon · generated {paper.generated_at?.slice(0, 10) || '—'}
        </p>
      </div>

      {/* Drafted sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {PAPER_SECTIONS.map(({ key, label, open }) => {
          const text = draft[key] || ''
          if (!text.trim()) return null
          return <PaperSection key={key} label={label} text={text} open={open} refMap={refMap} onCite={onCite} />
        })}
      </div>

      {/* Deep engagement — supporting vs challenging, shown honestly */}
      <EngagementPanel engagement={engagement} refMap={refMap} onCite={onCite} />

      {/* References */}
      <PaperReferences references={draft.references || []} highlightRef={highlightRef} />
    </div>
  )
}

/** One collapsible paper section, prose rendered with inline [E#]/[C#] citation chips. */
function PaperSection({
  label,
  text,
  open,
  refMap,
  onCite,
}: {
  label: string
  text: string
  open?: boolean
  refMap: Map<string, PaperReference>
  onCite: (ref: string) => void
}) {
  return (
    <details open={open} style={{ border: `1px solid ${T.border}`, borderRadius: '0.55rem', background: T.card2 }}>
      <summary
        style={{
          cursor: 'pointer',
          padding: '0.6rem 0.8rem',
          fontWeight: 600,
          fontSize: '0.85rem',
          color: T.fg,
          listStyle: 'none',
          borderLeft: `3px solid ${T.violet}`,
          borderRadius: '0.55rem 0.55rem 0 0',
        }}
      >
        {label}
      </summary>
      <div style={{ margin: 0, padding: '0 0.85rem 0.8rem', fontSize: '0.875rem', color: T.fg, lineHeight: 1.6 }}>
        {renderPaperProse(text, refMap, onCite)}
      </div>
    </details>
  )
}

/**
 * The deep-engagement panel: supporting findings (green) and challenging findings (violet — the
 * steelman colour) given EQUAL visual weight so disconfirming evidence is engaged honestly, never
 * buried. Tensions/open-questions follow in amber. Every finding's ref chip links to its reference.
 */
function EngagementPanel({
  engagement,
  refMap,
  onCite,
}: {
  engagement: PaperEngagement
  refMap: Map<string, PaperReference>
  onCite: (ref: string) => void
}) {
  const { supporting, challenging, tensions } = engagement
  if (!supporting?.length && !challenging?.length && !tensions?.length) return null
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: '0.6rem', background: T.card2, padding: '0.85rem 0.95rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.7rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: T.fg }}>Evidence engagement</h4>
        <span style={{ fontSize: '0.72rem', color: T.muted }}>
          supporting and challenging findings, weighed honestly
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 18rem), 1fr))', gap: '0.85rem' }}>
        <FindingColumn
          title="Supports the position"
          symbol="↑"
          tone="support"
          findings={supporting}
          refMap={refMap}
          onCite={onCite}
        />
        <FindingColumn
          title="Challenges the position"
          symbol="↯"
          tone="challenge"
          findings={challenging}
          refMap={refMap}
          onCite={onCite}
        />
      </div>
      {tensions?.length > 0 && (
        <div style={{ marginTop: '0.85rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: T.amber, marginBottom: '0.4rem' }}>
            ⇅ Tensions & open questions
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {tensions.map((t, i) => (
              <li key={i} style={{ fontSize: '0.8rem', color: T.muted, lineHeight: 1.5 }}>
                {t.statement}
                {t.refs?.length > 0 && (
                  <span style={{ marginLeft: '0.35rem', display: 'inline-flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                    {t.refs.map((r) => (
                      <RefChip key={r} refId={r} refMap={refMap} onCite={onCite} />
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function FindingColumn({
  title,
  symbol,
  tone,
  findings,
  refMap,
  onCite,
}: {
  title: string
  symbol: string
  tone: 'support' | 'challenge'
  findings: PaperFinding[]
  refMap: Map<string, PaperReference>
  onCite: (ref: string) => void
}) {
  const color = tone === 'support' ? '#22c55e' : T.violet
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          fontSize: '0.74rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color,
          marginBottom: '0.5rem',
        }}
      >
        <span aria-hidden>{symbol}</span>
        {title}
        <span style={{ color: T.faint, fontWeight: 600 }}>· {findings?.length || 0}</span>
      </div>
      {(!findings || findings.length === 0) && (
        <p style={{ fontSize: '0.78rem', color: T.faint, margin: 0 }}>
          {tone === 'challenge' ? 'No disconfirming evidence surfaced — stated honestly, not invented.' : 'None.'}
        </p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {(findings || []).map((f, i) => (
          <FindingCard key={`${f.ref}-${i}`} finding={f} color={color} refMap={refMap} onCite={onCite} />
        ))}
      </div>
    </div>
  )
}

function FindingCard({
  finding,
  color,
  refMap,
  onCite,
}: {
  finding: PaperFinding
  color: string
  refMap: Map<string, PaperReference>
  onCite: (ref: string) => void
}) {
  const g = finding.grade ? gradeStyle(finding.grade) : null
  return (
    <div
      style={{
        border: `1px solid ${color}33`,
        background: `${color}0d`,
        borderRadius: '0.5rem',
        padding: '0.55rem 0.65rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
        <RefChip refId={finding.ref} refMap={refMap} onCite={onCite} />
        {g && (
          <span
            title={g.label}
            style={{
              fontSize: '0.66rem',
              fontWeight: 700,
              color: g.color,
              background: g.bg,
              border: `1px solid ${g.border}`,
              borderRadius: '0.25rem',
              padding: '0.02rem 0.3rem',
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            {finding.grade}
          </span>
        )}
      </div>
      <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: T.fg, lineHeight: 1.45 }}>{finding.statement}</p>
      {finding.detail?.trim() && (
        <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem', color: T.muted, lineHeight: 1.5 }}>{finding.detail}</p>
      )}
    </div>
  )
}

/** The references list — each entry anchored (`beacon-ref-#`) so citation chips can scroll to it. */
function PaperReferences({ references, highlightRef }: { references: PaperReference[]; highlightRef: string | null }) {
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: '0.6rem', background: T.card2, padding: '0.85rem 0.95rem' }}>
      <h4 style={{ margin: '0 0 0.6rem', fontSize: '0.9rem', fontWeight: 700, color: T.fg }}>
        References <span style={{ color: T.faint, fontWeight: 600, fontSize: '0.78rem' }}>· {references.length}</span>
      </h4>
      {references.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: T.faint, margin: 0 }}>No sources cited.</p>
      ) : (
        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {references.map((r) => (
            <ReferenceItem key={r.ref} reference={r} highlighted={highlightRef === r.ref} />
          ))}
        </ol>
      )}
    </div>
  )
}

function ReferenceItem({ reference: r, highlighted }: { reference: PaperReference; highlighted: boolean }) {
  const authors = (r.authors || []).slice(0, 5).join(', ')
  const tone = refTone(r.ref, r.origin)
  const readLabel = r.read === 'full_text' ? 'full text' : r.read === 'card_abstract' ? 'card + abstract' : 'abstract'
  return (
    <li
      id={`beacon-ref-${r.ref}`}
      style={{
        border: `1px solid ${highlighted ? T.accent : T.border}`,
        boxShadow: highlighted ? `0 0 0 2px ${T.accent}` : 'none',
        background: highlighted ? 'rgba(34,211,238,0.06)' : 'transparent',
        borderRadius: '0.5rem',
        padding: '0.55rem 0.7rem',
        transition: 'box-shadow 0.25s ease, border-color 0.25s ease',
        scrollMarginTop: '1.5rem',
        display: 'flex',
        gap: '0.55rem',
        alignItems: 'flex-start',
      }}
    >
      <span
        style={{
          flexShrink: 0,
          fontSize: '0.68rem',
          fontWeight: 700,
          fontFamily: "'IBM Plex Mono', monospace",
          color: tone.color,
          background: tone.bg,
          border: `1px solid ${tone.border}`,
          borderRadius: '0.25rem',
          padding: '0.1rem 0.35rem',
        }}
      >
        {r.ref}
      </span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600, color: T.fg, lineHeight: 1.4, overflowWrap: 'anywhere' }}>
          {r.title || '(untitled source)'}
        </p>
        {authors && <p style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', color: T.faint }}>{authors}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.3rem', flexWrap: 'wrap' }}>
          {r.tier && <TierTag tier={r.tier} />}
          <span
            title={`Counter-search evidence — surfaced as a challenge`}
            style={{ fontSize: '0.62rem', fontWeight: 700, color: tone.color, textTransform: 'uppercase', letterSpacing: '0.04em' }}
          >
            {r.origin === 'counter' ? 'challenge' : 'supporting'}
          </span>
          <span style={{ fontSize: '0.66rem', color: T.faint }}>read: {readLabel}</span>
          {r.url && (
            <a
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '0.72rem', fontWeight: 600, color: T.accent, textDecoration: 'none' }}
            >
              Read ↗
            </a>
          )}
          {r.doi && (!r.url || !r.url.includes(r.doi)) && (
            <a
              href={`https://doi.org/${r.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '0.7rem', color: T.muted, textDecoration: 'none' }}
            >
              doi:{r.doi}
            </a>
          )}
        </div>
      </div>
    </li>
  )
}

/** Tone for an E#/C# chip: supporting (cased) reads green; challenging (counter) reads violet. */
function refTone(ref: string, origin?: 'cased' | 'counter'): { color: string; bg: string; border: string } {
  const challenge = origin === 'counter' || /^C\d/.test(ref)
  return challenge
    ? { color: T.violet, bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.4)' }
    : { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.4)' }
}

/** A clickable [E#]/[C#] reference chip that scrolls to its reference entry; faint + inert when unresolved. */
function RefChip({
  refId,
  refMap,
  onCite,
}: {
  refId: string
  refMap: Map<string, PaperReference>
  onCite: (ref: string) => void
}) {
  const ref = refMap.get(refId)
  if (!ref) return <span style={{ color: T.faint, fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.7rem' }}>[{refId}]</span>
  const tone = refTone(refId, ref.origin)
  return (
    <button
      type="button"
      onClick={() => onCite(refId)}
      title={`${ref.title}${ref.tier ? ` · ${tierLabel(ref.tier)}` : ''} — ${ref.origin === 'counter' ? 'challenges' : 'supports'} the position`}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        verticalAlign: 'baseline',
        margin: '0 0.1rem',
        padding: '0 0.32rem',
        fontSize: '0.7rem',
        fontWeight: 700,
        fontFamily: "'IBM Plex Mono', monospace",
        color: tone.color,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        borderRadius: '0.25rem',
        cursor: 'pointer',
        lineHeight: 1.4,
      }}
    >
      {refId}
    </button>
  )
}

const PAPER_CITE_RE = /\[\s*([EC]\d+(?:\s*[,;]\s*[EC]\d+)*)\s*\]/g

/** Render paper prose: split into paragraphs, turn each [E#]/[C#] (or grouped [E1, C2]) token into chips. */
function renderPaperProse(
  text: string,
  refMap: Map<string, PaperReference>,
  onCite: (ref: string) => void,
): React.ReactNode {
  const paras = text.split(/\n{2,}/)
  return paras.map((para, pi) => (
    <p key={pi} style={{ margin: pi === 0 ? '0' : '0.6rem 0 0', lineHeight: 1.6 }}>
      {renderPaperInline(para, refMap, onCite)}
    </p>
  ))
}

function renderPaperInline(
  text: string,
  refMap: Map<string, PaperReference>,
  onCite: (ref: string) => void,
): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  PAPER_CITE_RE.lastIndex = 0
  while ((m = PAPER_CITE_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const refs = m[1].split(/\s*[,;]\s*/).map((r) => r.trim()).filter(Boolean)
    out.push(
      <span key={`grp-${i++}`} style={{ whiteSpace: 'nowrap' }}>
        {refs.map((r, ri) => (
          <RefChip key={`${r}-${ri}`} refId={r} refMap={refMap} onCite={onCite} />
        ))}
      </span>,
    )
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** Splits a bucket's cards into hard-research (rendered first) and weak (web/vendor) groups. */
function TieredCards({
  cards,
  render,
}: {
  cards: EvidenceCard[]
  render: (card: EvidenceCard) => React.ReactNode
}) {
  const research = cards.filter((c) => !isWeakTier(c.source.tier))
  const weak = cards.filter((c) => isWeakTier(c.source.tier))
  return (
    <>
      {research.map(render)}
      {weak.length > 0 && <WebClaimsDivider />}
      {weak.map(render)}
    </>
  )
}

function WebClaimsDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0.35rem 0 0.55rem' }}>
      <span style={{ height: 1, width: '0.9rem', background: T.border, flexShrink: 0 }} />
      <span
        style={{
          fontSize: '0.62rem',
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: T.faint,
          whiteSpace: 'nowrap',
        }}
      >
        Web claims · weaker than research — verify
      </span>
      <span style={{ height: 1, background: T.border, flex: 1 }} />
    </div>
  )
}

function ArgumentWarning() {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'flex-start',
        background: 'rgba(245,158,11,0.08)',
        border: '1px solid rgba(245,158,11,0.35)',
        borderRadius: '0.5rem',
        padding: '0.5rem 0.7rem',
        marginBottom: '0.6rem',
      }}
    >
      <span aria-hidden style={{ color: T.amber, fontWeight: 700, lineHeight: 1.45 }}>
        ⚠
      </span>
      <span style={{ fontSize: '0.76rem', color: T.amber, lineHeight: 1.45 }}>
        This rests on claims, not research — add a hard-research source.
      </span>
    </div>
  )
}

function CautionBadge({ text }: { text: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        fontSize: '0.62rem',
        fontWeight: 700,
        color: T.amber,
        background: 'rgba(245,158,11,0.1)',
        border: '1px solid rgba(245,158,11,0.35)',
        borderRadius: '0.25rem',
        padding: '0.08rem 0.4rem',
        letterSpacing: '0.02em',
      }}
    >
      <span aria-hidden>⚠</span>
      {text}
    </span>
  )
}

function TierTag({ tier }: { tier: SourceTier | undefined }) {
  if (!tier) return null
  const s = tierStyle(tier)
  return (
    <span
      title={`Source tier: ${tierLabel(tier)}`}
      style={{
        fontSize: '0.6rem',
        fontWeight: 700,
        color: s.color,
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: '0.25rem',
        padding: '0.05rem 0.35rem',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        flexShrink: 0,
      }}
    >
      {tierLabel(tier)}
    </span>
  )
}

// ─────────────────────────── tiny presentational bits ───────────────────────────

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        borderRadius: '0.75rem',
        padding: '1.1rem 1.4rem',
        color: T.muted,
        fontSize: '0.9rem',
        lineHeight: 1.55,
      }}
    >
      {children}
    </div>
  )
}

function AgentPill() {
  return (
    <span
      style={{
        fontSize: '0.6rem',
        fontWeight: 700,
        background: 'rgba(167,139,250,0.13)',
        color: T.violet,
        border: '1px solid rgba(167,139,250,0.27)',
        borderRadius: '0.25rem',
        padding: '0.05rem 0.4rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      Agent
    </span>
  )
}

function SourceTag({ isWeb, isOwn }: { isWeb: boolean; isOwn: boolean }) {
  const [label, color, bg, border] = isOwn
    ? ['YOUR DATA', T.amber, 'rgba(245,158,11,0.12)', 'rgba(245,158,11,0.35)']
    : isWeb
      ? ['WEB', T.violet, 'rgba(167,139,250,0.12)', 'rgba(167,139,250,0.35)']
      : ['LIBRARY', T.accent, 'rgba(34,211,238,0.1)', 'rgba(34,211,238,0.3)']
  return (
    <span
      style={{
        fontSize: '0.6rem',
        fontWeight: 700,
        color,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: '0.25rem',
        padding: '0.05rem 0.35rem',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  )
}

function StatusTag({ status }: { status: CaseStatus }) {
  const map: Record<CaseStatus, [string, string]> = {
    draft: ['draft', T.muted],
    assembled: ['assembled', '#22c55e'],
    exported: ['exported', T.accent],
  }
  const [label, color] = map[status] || map.draft
  return (
    <span
      style={{
        fontSize: '0.62rem',
        fontWeight: 700,
        color,
        border: `1px solid ${color}55`,
        borderRadius: '0.25rem',
        padding: '0.05rem 0.35rem',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </span>
  )
}

function GradeLegend() {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      {GRADE_LEGEND.map(({ grade, label }) => {
        const g = gradeStyle(grade)
        return (
          <span key={grade} title={label} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span
              style={{
                width: '1.05rem',
                height: '1.05rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.68rem',
                fontWeight: 700,
                color: g.color,
                background: g.bg,
                border: `1px solid ${g.border}`,
                borderRadius: '0.25rem',
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              {grade}
            </span>
          </span>
        )
      })}
    </div>
  )
}

function SaveIndicator({ state }: { state: 'idle' | 'saving' | 'saved' }) {
  if (state === 'idle') return null
  return (
    <span style={{ fontSize: '0.72rem', color: state === 'saved' ? '#22c55e' : T.muted }}>
      {state === 'saving' ? 'Saving…' : 'Saved ✓'}
    </span>
  )
}

function RegionHeader({ label, hint, accent }: { label: string; hint?: string; accent?: boolean }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: accent ? T.accent : T.fg }}>{label}</h2>
      {hint && <p style={{ margin: '0.15rem 0 0', fontSize: '0.76rem', color: T.muted }}>{hint}</p>}
    </div>
  )
}

// ─────────────────────────── shared style objects ───────────────────────────

const region: React.CSSProperties = {
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: '0.75rem',
  padding: '1rem 1.1rem',
}

const twoCol: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 22rem), 1fr))',
  gap: '1rem',
  alignItems: 'start',
}

const toolbar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  flexWrap: 'wrap',
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: '0.6rem',
  padding: '0.6rem 0.8rem',
}

const bucketBlock: React.CSSProperties = { marginBottom: '1rem' }

const bucketHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  marginBottom: '0.5rem',
  paddingBottom: '0.3rem',
  borderBottom: `1px solid ${T.border}`,
}

const btnPrimary: React.CSSProperties = {
  background: T.accent,
  color: T.accentText,
  border: `1px solid ${T.accent}`,
  borderRadius: '0.5rem',
  padding: '0.5rem 0.9rem',
  fontSize: '0.85rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const btnPrimarySm: React.CSSProperties = {
  background: T.accent,
  color: T.accentText,
  border: `1px solid ${T.accent}`,
  borderRadius: '0.4rem',
  padding: '0.28rem 0.6rem',
  fontSize: '0.76rem',
  fontWeight: 600,
  cursor: 'pointer',
}

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  color: T.muted,
  border: `1px solid ${T.border}`,
  borderRadius: '0.5rem',
  padding: '0.4rem 0.75rem',
  fontSize: '0.8rem',
  fontWeight: 500,
  cursor: 'pointer',
}

const miniBtn: React.CSSProperties = {
  background: 'transparent',
  color: T.muted,
  border: `1px solid ${T.border}`,
  borderRadius: '0.4rem',
  padding: '0.28rem 0.6rem',
  fontSize: '0.76rem',
  fontWeight: 500,
  cursor: 'pointer',
}

const ownInput: React.CSSProperties = {
  flex: 1,
  background: T.bg,
  border: `1px solid ${T.border}`,
  borderRadius: '0.4rem',
  color: T.fg,
  padding: '0.4rem 0.6rem',
  fontSize: '0.82rem',
  fontFamily: 'inherit',
}

const errorBox: React.CSSProperties = {
  background: 'rgba(245,158,11,0.08)',
  border: '1px solid rgba(245,158,11,0.3)',
  borderRadius: '0.5rem',
  padding: '0.6rem 0.85rem',
  color: T.amber,
  fontSize: '0.83rem',
}

const paperProgress: React.CSSProperties = {
  background: 'rgba(167,139,250,0.08)',
  border: '1px solid rgba(167,139,250,0.3)',
  borderRadius: '0.5rem',
  padding: '0.6rem 0.85rem',
  color: T.muted,
  fontSize: '0.8rem',
  lineHeight: 1.5,
}

const paperActions: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  flexWrap: 'wrap',
  marginTop: '1rem',
  paddingTop: '0.85rem',
  borderTop: `1px solid ${T.border}`,
}
