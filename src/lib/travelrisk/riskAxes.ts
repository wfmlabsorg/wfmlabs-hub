/**
 * THE FOUR AXES — why the travelrisk surface stopped being yellow (hub-051 §7)
 * ============================================================================
 * Ted, 2026-08-01: *"bring the travelrisk globe into a far clearer state for
 * what is happening on polling data, points I can view on the globe itself to
 * show true risk (everything is yellow)."*
 *
 * ── WHAT WAS ACTUALLY PAINTING THE SCREEN ────────────────────────────────
 * Not one bug. `#eab308` had been recruited to mean SIX different things at
 * once, across two unrelated data planes that happen to share a hex code:
 *
 *   1. an airport is degraded            (measured, checked, 10 of 272)
 *   2. a domain index sits in 4.0–6.9    (provisional, news-volume-derived, 9 of 12)
 *   3. a signal was promoted             (a lifecycle fact, not a hazard)
 *   4. our own last sweep is getting old (a CONFIDENCE fact)
 *   5. a SEV2 incident
 *   6. GPS interference is reported
 *
 * When one colour carries six meanings it carries none. Worse, two of those
 * meanings were doing almost all of the painting, for reasons that are
 * arithmetic rather than operational:
 *
 * (a) THE INDEX BAND CLIFF. Live global op-risk spans 3.7 → 4.6 across all 12
 *     domains — a 0.9-point spread on a 0–10 scale. `score < 4.0 ? green :
 *     score < 7.0 ? amber : red` puts a hard colour cliff at 4.0, so nine
 *     domains flood amber and three go green, and the difference between
 *     "green" and "amber" is 0.1 of a provisional point while the difference
 *     between 4.0 and 6.9 is nothing at all. The colour was reporting the
 *     threshold, not the world.
 *
 * (b) THE DEAD SEVERITY RAMP. `degradedColor()` graded airports off
 *     `severity_band` then `severity`. Both are NULL on all 272 rows (they
 *     belong to the airspace-ring source, which is not credentialed), and
 *     `operational_state` is `unknown` for all 272 too — so every branch fell
 *     through to the terminal amber. The ramp had three stops and could only
 *     ever reach one. LHR breaching on median delay drew identically to a
 *     hypothetical closed field.
 *
 * ── THE FIX: ONE CHANNEL PER AXIS, AND MAGNITUDE STOPS BEING A COLOUR ─────
 * Nothing here hides uncertainty and nothing collapses two axes into one
 * colour — the opposite. Four axes, four channels that cannot be confused:
 *
 *   HAZARD      red / amber / green.  RESERVED, on this surface, for a thing we
 *               CHECKED and found impaired: a degraded airport, a declared
 *               incident. If it is amber, something real is wrong with a real
 *               place. Nothing else may borrow these hues.
 *
 *   CONFIDENCE  neutral slate, always. Provisional, unknown, stale, no-feed,
 *               not-checked. This was already the file-level doctrine of
 *               travel-globe.html ("slate #94a3b8 — the confidence axis, always
 *               neutral") and it was being violated by `.look-aging` (amber)
 *               and `.look-stale` (red) in that same file.
 *
 *   INDEX       ONE hue (the chrome cyan) plus a BAR. Magnitude is encoded by
 *               bar length — position, which the eye reads accurately — not by
 *               a colour band, which the eye reads as an alarm. 3.9 and 4.0 now
 *               draw as near-identical bars, which is the truth, instead of
 *               green-versus-amber, which was a lie about the size of the gap.
 *               The published `level` word (NORMAL / ELEVATED / HIGH) is still
 *               printed verbatim, so nothing is withheld — it is demoted from a
 *               colour flood to a label, which is what a provisional,
 *               absolute-basis ranking of news volume has earned.
 *
 *   ADVISORY    violet. A judgement by an issuer who does not control the
 *               airspace. Already separate; kept separate.
 *
 * ── WHY THIS IS NOT "MANUFACTURING CALM" ─────────────────────────────────
 * Nothing is hidden and no state is merged. Every number, every level word and
 * every unknown still renders. What changed is that the ONE alarm colour on the
 * page now has exactly one referent, so the ten genuinely degraded airports and
 * the open incidents are the only things shouting. If most of the world is
 * unremarkable right now, the design should let the few real problems leap out
 * — not make everything shout so that nothing does.
 *
 * NO ORANGE (#f97316). hub-041 took four gate-rounds to clear it.
 */

// ── AXIS 1: HAZARD — checked, and impaired ────────────────────────────────
// The only alarm colours on this surface. Guard them.

export const HAZARD = {
  /** Checked and fine. */
  ok: '#10b981',
  /** Checked and impaired. */
  degraded: '#eab308',
  /** Checked and severely impaired / stopped / closed. */
  severe: '#ef4444',
} as const

export type HazardKind = keyof typeof HAZARD

/**
 * Incident severity → hazard colour. SEV1/2 are the alarm; SEV3/4 are declared
 * but sub-alarm and take the confidence slate, because a SEV4 sharing a hue
 * with a degraded airport is exactly the dilution this module exists to undo.
 */
export function sevColor(sevLevel: string | null | undefined): string {
  switch ((sevLevel || '').toUpperCase()) {
    case 'SEV1': return HAZARD.severe
    case 'SEV2': return HAZARD.degraded
    default: return CONFIDENCE.mid
  }
}

// ── AXIS 2: CONFIDENCE — how much we know, never how bad it is ────────────

export const CONFIDENCE = {
  bright: '#cbd5e1',
  mid: '#94a3b8',
  dim: '#64748b',
  faint: '#475569',
  line: 'rgba(148,163,184,0.38)',
  fill: 'rgba(148,163,184,0.09)',
} as const

// ── AXIS 3: INDEX — one hue, magnitude carried by a bar ───────────────────

export const INDEX_HUE = '#22d3ee'
/** The op-risk scale as published by ovix-api. Used only to size a bar. */
export const INDEX_MAX = 10

/**
 * Bar width for a published index score. Returns null when there is no score
 * to draw — an absent reading gets a hatched empty track and the word
 * "no reading", never a zero-length bar that reads as calm.
 */
export function indexBarPct(score: number | null | undefined): number | null {
  if (typeof score !== 'number' || !isFinite(score)) return null
  return Math.max(0, Math.min(100, (score / INDEX_MAX) * 100))
}

/**
 * Text tone for an index readout. Deliberately only two outcomes: we hold a
 * reading (bright) or we do not (slate). Level does NOT change the tone —
 * that is the whole point.
 */
export function indexTone(available: boolean): string {
  return available ? CONFIDENCE.bright : CONFIDENCE.mid
}

/**
 * IS THERE A READING AT ALL?
 *
 * ovix-api publishes `available: false` with `score: 1` and `level: "NORMAL"`
 * for a domain it has no events for in the requested scope. Measured live at
 * region scope: 6 of 12 domains in North America, 6 of 12 in APAC. Rendering
 * that as a green "NORMAL" would be the honesty rule inverted — "we did not
 * look" drawn as "it is fine" — on a surface whose entire argument is that an
 * airport we did not check is never drawn as an airport that is fine.
 *
 * So: no reading is UNKNOWN, on the confidence axis, in words.
 */
export function hasReading(entry: { available?: boolean; score?: number | null } | null | undefined): boolean {
  if (!entry) return false
  if (entry.available === false) return false
  return typeof entry.score === 'number' && isFinite(entry.score)
}

// ── AXIS 4: ADVISORY — a judgement, not a fact ────────────────────────────

export const ADVISORY_HUE = '#a78bfa'

// ── The spread disclosure ─────────────────────────────────────────────────

export interface SpreadSummary {
  min: number
  max: number
  span: number
  n: number
  /** How many sit in each published level. */
  byLevel: Record<string, number>
  /** True when the whole set fits inside a band narrower than 2 points. */
  tight: boolean
}

/**
 * Describe the RANGE of a set of published scores.
 *
 * This is not a re-derivation of a score — it computes nothing new about any
 * domain, it reports the min, max and level tally of numbers ovix-api already
 * published. It exists because the single most useful thing a reader can be
 * told about today's board is that all twelve domains sit inside a 0.9-point
 * band, which no amount of colour could convey and which colour actively
 * concealed.
 */
export function describeSpread(
  entries: readonly { score?: number | null; level?: string | null; available?: boolean }[],
): SpreadSummary | null {
  const scores: number[] = []
  const byLevel: Record<string, number> = {}
  for (const e of entries) {
    if (!hasReading(e)) continue
    scores.push(e.score as number)
    const lv = (e.level || 'UNKNOWN').toUpperCase()
    byLevel[lv] = (byLevel[lv] || 0) + 1
  }
  if (scores.length === 0) return null
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  return { min, max, span: max - min, n: scores.length, byLevel, tight: max - min < 2 }
}

/** The sentence that goes under the board. Derived every render; self-clearing
 *  the moment the domains genuinely separate. */
export function spreadSentence(s: SpreadSummary | null): string | null {
  if (!s || !s.tight || s.n < 3) return null
  const elevated = s.byLevel.ELEVATED || 0
  return (
    `All ${s.n} domains currently sit between ${s.min.toFixed(1)} and ${s.max.toFixed(1)} on a 0–${INDEX_MAX} ` +
    `scale — a spread of ${s.span.toFixed(1)}. ${elevated} of them fall on the ELEVATED side of the 4.0 band ` +
    `boundary, but a domain at 4.0 and a domain at 3.9 differ by a tenth of a provisional point, not by a ` +
    `state of the world. That is why this board draws magnitude as a bar and reserves red and amber for ` +
    `things we checked and found impaired.`
  )
}
