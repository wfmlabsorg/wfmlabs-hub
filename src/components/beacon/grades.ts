/**
 * Beacon evidence-grade styling + legend (research-018 / WFM-92).
 *
 * The A–V scale is Beacon's no-fabrication honesty signal: A = strong/direct, down to V = a
 * vendor-interested claim and — = evidence genuinely absent. The canvas colour-codes every card so a
 * member can scan strength at a glance. Mission-Control palette only (cyan/green/amber/violet/slate);
 * NO orange.
 */

import type { Grade } from './types'

export interface GradeStyle {
  /** Foreground / badge text colour. */
  color: string
  /** Translucent badge fill. */
  bg: string
  /** Badge border. */
  border: string
  /** Short human label for the legend / tooltip. */
  label: string
}

const STYLES: Record<Grade, GradeStyle> = {
  A: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.4)', label: 'Strong — direct, high-quality' },
  B: { color: '#4ade80', bg: 'rgba(74, 222, 128, 0.12)', border: 'rgba(74, 222, 128, 0.4)', label: 'Solid — credible support' },
  C: { color: '#eab308', bg: 'rgba(234, 179, 8, 0.12)', border: 'rgba(234, 179, 8, 0.4)', label: 'Suggestive — partial / indirect' },
  D: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.4)', label: 'Weak — thin / dated / off-context' },
  V: { color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.12)', border: 'rgba(167, 139, 250, 0.4)', label: 'Vendor — interested party' },
  '—': { color: '#64748b', bg: 'rgba(100, 116, 139, 0.12)', border: 'rgba(100, 116, 139, 0.4)', label: 'Absent — no evidence found' },
}

const FALLBACK: GradeStyle = STYLES['—']

export function gradeStyle(grade: Grade | string): GradeStyle {
  return STYLES[grade as Grade] || FALLBACK
}

/** Ordered legend for the canvas key. */
export const GRADE_LEGEND: { grade: Grade; label: string }[] = (['A', 'B', 'C', 'D', 'V', '—'] as Grade[]).map(
  (g) => ({ grade: g, label: STYLES[g].label }),
)
