/**
 * op-risk SCORE-STATE — typed reader for React surfaces (hub-047)
 * ============================================================================
 * SINGLE SOURCE OF THE SEMANTICS: `public/roc/roc-score-state.js` (hub-045).
 * That file is the canonical statement of what PROVISIONAL / SETTLED mean and
 * of the honesty rules below. It is a browser IIFE (`window.RocScoreState`)
 * built for the OpenMCT dashboards and the globe, and it cannot be imported by
 * a React Server Component. This module is its typed counterpart for the
 * server-rendered Hub surfaces: same contract, same field names, same
 * vocabulary, same neutral marker, same wording in `explain()`.
 *
 * IF THE CONTRACT CHANGES, BOTH CHANGE. Neither file may invent a rule the
 * other does not have. Nothing here re-derives a score — every value is read
 * off the `ovix-api` payload (01-Source/DATA-PLANE-CONTRACT.md).
 *
 * THE CONTRACT (api-065 / roc#124):
 *   per domain: state ('PROVISIONAL'|'SETTLED'), scoreBasis
 *               ('baseline_percentile'|'provisional_absolute'|'empty_window'),
 *               baselineProgress (0-1), settlesAt (ISO|null), score, level
 *   top level:  compositeState, compositeLevel, compositeBasis
 *               {settled, provisional, unavailable}, ruleVersion, lastUpdated
 *
 * THE LOAD-BEARING SEMANTIC
 *   `provisional_absolute` scores ARE comparable across domains at one instant.
 *   They are NOT comparable against a settled score, nor against the domain's
 *   own history. A cross-domain ranking is therefore legitimate; a trend across
 *   the boundary is not, and is withheld (`trendBlocked`).
 *
 * CONFIDENCE AND SEVERITY ARE SEPARATE AXES. `level` keeps its three values
 * (NORMAL / ELEVATED / HIGH) and its hazard colour. State renders as its own
 * neutral marker. Never a fourth level; never a recoloured band; never orange
 * (hub-041).
 */

export const PROVISIONAL = 'PROVISIONAL'
export const SETTLED = 'SETTLED'

/** State is a CONFIDENCE signal, not a hazard signal — always neutral slate. */
export const NEUTRAL = '#94a3b8'
export const NEUTRAL_DIM = '#64748b'
export const NEUTRAL_LINE = 'rgba(148,163,184,0.38)'
export const NEUTRAL_FILL = 'rgba(148,163,184,0.09)'

export const TREND_REASON =
  'Trend withheld: scored on a provisional basis, and the history may cross a change of basis. ' +
  'Provisional and settled scores are not comparable over time.'

export interface OpRiskDomainEntry {
  domain?: string
  score?: number
  level?: string
  eventCount?: number
  topEvent?: string | null
  topSource?: string | null
  state?: string
  calibrating?: boolean
  scoreBasis?: string
  baselineProgress?: number
  settlesAt?: string | null
  ruleVersion?: string | null
  geoRegion?: string | null
  available?: boolean
}

export interface OpRiskPayload {
  scope?: string
  composite?: number
  compositeLevel?: string
  compositeState?: string
  compositeBasis?: { settled?: number; provisional?: number; unavailable?: number }
  domains?: OpRiskDomainEntry[]
  ruleVersion?: string | null
  lastUpdated?: string | null
  source?: string | null
}

export interface DomainState {
  state: string | null
  provisional: boolean
  settled: boolean
  known: boolean
  scoreBasis: string | null
  empty: boolean
  score: number | null
  level: string | null
  progress: number | null
  settlesAt: string | null
  settlesAtKnown: boolean
  lastUpdated: string | null
}

export interface StateSummary {
  provisional: boolean
  compositeState: string | null
  compositeLevel: string | null
  known: boolean
  basis: { settled: number; provisional: number; unavailable: number }
  provisionalCount: number
  settledCount: number
  total: number
  /** The comparison hazard: settled and provisional scores rendered side by side. */
  mixed: boolean
  progress: number | null
  settlesAt: string | null
  settlesAtKnown: boolean
  ruleVersion: string | null
  lastUpdated: string | null
  source: string | null
}

const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v)

/**
 * Per-domain state, read straight off the API entry. `state` is canonical;
 * `calibrating` is its legacy boolean twin, honoured ONLY as a compatibility
 * shim for an ovix-api that predates roc#124.
 */
export function domainState(entry: OpRiskDomainEntry | null | undefined): DomainState {
  const out: DomainState = {
    state: null, provisional: false, settled: false, known: false,
    scoreBasis: null, empty: false, score: null, level: null,
    progress: null, settlesAt: null, settlesAtKnown: false, lastUpdated: null,
  }
  if (!entry || typeof entry !== 'object') return out

  let s = typeof entry.state === 'string' ? entry.state.toUpperCase() : null
  if (s !== PROVISIONAL && s !== SETTLED) {
    s = entry.calibrating === true ? PROVISIONAL : entry.calibrating === false ? SETTLED : null
  }
  out.state = s
  out.known = s === PROVISIONAL || s === SETTLED
  out.provisional = s === PROVISIONAL
  out.settled = s === SETTLED

  out.scoreBasis = typeof entry.scoreBasis === 'string' ? entry.scoreBasis : null
  out.empty = out.scoreBasis === 'empty_window'
  out.score = isNum(entry.score) ? entry.score : null
  out.level = typeof entry.level === 'string' ? entry.level : null
  // baselineProgress is authoritative — never divide baselineN ourselves.
  out.progress = isNum(entry.baselineProgress) ? Math.max(0, Math.min(1, entry.baselineProgress)) : null
  // settlesAt is null for a regime-shift provisional: that one heals on DATA,
  // not on a clock, so no countdown may be rendered for it.
  out.settlesAt = out.provisional && entry.settlesAt ? entry.settlesAt : null
  out.settlesAtKnown = !!out.settlesAt
  return out
}

/** Index-level summary for one op-risk payload (global OR region scope). */
export function summarize(payload: OpRiskPayload | null | undefined): StateSummary {
  const s: StateSummary = {
    provisional: false, compositeState: null, compositeLevel: null, known: false,
    basis: { settled: 0, provisional: 0, unavailable: 0 },
    provisionalCount: 0, settledCount: 0, total: 0,
    mixed: false, progress: null, settlesAt: null, settlesAtKnown: false,
    ruleVersion: null, lastUpdated: null, source: null,
  }
  if (!payload || typeof payload !== 'object') return s

  s.lastUpdated = payload.lastUpdated || null
  s.source = payload.source || null
  s.ruleVersion = payload.ruleVersion || null
  s.compositeLevel = typeof payload.compositeLevel === 'string' ? payload.compositeLevel : null

  const cb = payload.compositeBasis
  if (cb && typeof cb === 'object') {
    s.basis.settled = isNum(cb.settled) ? cb.settled : 0
    s.basis.provisional = isNum(cb.provisional) ? cb.provisional : 0
    s.basis.unavailable = isNum(cb.unavailable) ? cb.unavailable : 0
  }

  const doms = Array.isArray(payload.domains) ? payload.domains : []
  s.total = doms.length
  let minProgress: number | null = null
  let latestSettles: string | null = null
  let anyUnknownSettles = false
  for (const raw of doms) {
    const d = domainState(raw)
    if (d.settled) s.settledCount++
    if (!d.provisional) continue
    s.provisionalCount++
    if (d.progress !== null && (minProgress === null || d.progress < minProgress)) minProgress = d.progress
    if (!d.settlesAt) anyUnknownSettles = true // regime-shift → no clock
    else if (!latestSettles || d.settlesAt > latestSettles) latestSettles = d.settlesAt
  }
  // Fall back to counting domains when compositeBasis is absent (pre-roc#124).
  if (!cb) { s.basis.settled = s.settledCount; s.basis.provisional = s.provisionalCount }

  let cs = typeof payload.compositeState === 'string' ? payload.compositeState.toUpperCase() : null
  if (cs !== PROVISIONAL && cs !== SETTLED) {
    cs = s.provisionalCount > 0 ? PROVISIONAL : s.total > 0 ? SETTLED : null
  }
  s.compositeState = cs
  s.known = cs === PROVISIONAL || cs === SETTLED
  s.provisional = cs === PROVISIONAL

  s.progress = minProgress
  // Only quote a settle time when EVERY provisional domain has one; a single
  // regime-shift domain (settlesAt null) makes an index-wide estimate dishonest.
  s.settlesAt = anyUnknownSettles ? null : latestSettles
  s.settlesAtKnown = !!s.settlesAt
  s.mixed = s.basis.settled > 0 && s.basis.provisional > 0
  return s
}

/**
 * A trend line may not span a provisional/settled basis change. The series
 * endpoint carries no per-point state, so while the current reading is
 * PROVISIONAL we cannot prove the window is single-basis — and withhold it.
 */
export function trendBlocked(st: { provisional?: boolean } | null | undefined): boolean {
  return !!(st && st.provisional)
}

// ── Traceability gate 2: WHEN was this computed, and WHY is it provisional ──

function toDate(v: string | null | undefined): Date | null {
  if (!v) return null
  // Accept ISO and Postgres-style "2026-07-31 17:51:06.597963+00".
  const iso = String(v).trim().replace(' ', 'T').replace(/\+00$/, 'Z')
  const t = new Date(iso)
  return isNaN(t.getTime()) ? null : t
}

const p2 = (n: number) => String(n).padStart(2, '0')
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmtUpdated(v: string | null | undefined): string {
  const t = toDate(v)
  if (!t) return v ? String(v) : 'unknown'
  return `${p2(t.getUTCHours())}:${p2(t.getUTCMinutes())} UTC`
}

/** Null for a regime-shift provisional → never render a countdown for it. */
export function fmtSettles(v: string | null | undefined): string | null {
  const t = toDate(v)
  if (!t) return null
  return `${t.getUTCDate()} ${MONTHS[t.getUTCMonth()]} ${p2(t.getUTCHours())}:${p2(t.getUTCMinutes())} UTC`
}

function basisPhrase(st: { empty?: boolean; scoreBasis?: string | null }): string {
  if (st.empty) return 'has no observations in the current window'
  if (st.scoreBasis === 'provisional_absolute') return 'is scored on an absolute basis'
  return 'is scored on a provisional basis'
}

/** The full "why is this provisional" sentence. Empty string when settled. */
export function explain(x: (DomainState | StateSummary) & Partial<DomainState>): string {
  if (!x || !x.provisional) return ''
  const bits = [
    `PROVISIONAL — this score ${basisPhrase(x)}, because the trailing 30-day baseline is not yet usable.`,
  ]
  if (isNum(x.progress)) bits.push(`Baseline ${Math.round(x.progress * 100)}% complete.`)
  bits.push(
    'Provisional scores are comparable to each other right now, but NOT to a settled score and NOT to their own history.',
  )
  const when = fmtSettles(x.settlesAt)
  // No settle estimate means it heals on incoming data, not on elapsed time.
  bits.push(when ? `Expected to settle about ${when}.` : 'It settles when the data recovers, not on a schedule.')
  if (x.lastUpdated) bits.push(`Last computed ${fmtUpdated(x.lastUpdated)}.`)
  return bits.join(' ')
}

/** Hazard colour for a level. Severity axis only — never expresses confidence. */
export function levelColor(level: string | null | undefined): string {
  switch ((level || '').toUpperCase()) {
    case 'HIGH': return '#ef4444'
    case 'ELEVATED': return '#eab308'
    case 'NORMAL': return '#10b981'
    default: return NEUTRAL
  }
}
