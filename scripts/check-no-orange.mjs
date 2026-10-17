#!/usr/bin/env node
/**
 * check-no-orange.mjs — house rule NO ORANGE (Mission Control theme; lib/domainColors.ts, travelrisk/riskAxes.ts,
 * components/travelrisk/parts.tsx). Runs in `prebuild`, so a PR that reintroduces orange fails its Vercel preview.
 *
 * Why a script: the rule took four review rounds in hub-041 and was still broken again on 2026-10-16 (misery band
 * #f97316, FAA badge amber) — a human-memory rule does not hold. Use the hazard ramp instead: green #22c55e,
 * yellow #eab308, rose #fb7185, red #ef4444, or DOMAIN_COLORS.
 *
 * Scans src/ and public/roc/ for the Tailwind orange family (hex + rgb + class names). Lines that state the rule
 * ("NO ORANGE" / "NO-ORANGE") are exempt so the documentation can name the colour.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOTS = ['src', 'public/roc']
const EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.html'])
const ORANGE_HEX = ['fff7ed', 'ffedd5', 'fed7aa', 'fdba74', 'fb923c', 'f97316', 'ea580c', 'c2410c', '9a3412', '7c2d12', '431407']
const RULES = [
  new RegExp(`#(${ORANGE_HEX.join('|')})\\b`, 'i'),
  /rgba?\(\s*249\s*,\s*115\s*,\s*22\b/,
  /\b(?:text|bg|border|from|via|to|ring|fill|stroke|outline|decoration|shadow|accent|caret)-orange-\d{2,3}\b/,
]
const EXEMPT = /NO[ -]ORANGE/i

function* walk(dir) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (EXT.has(extname(e))) yield p
  }
}

const hits = []
for (const root of ROOTS) {
  let files
  try { files = [...walk(root)] } catch { continue }
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split('\n')
    lines.forEach((l, i) => { if (!EXEMPT.test(l) && RULES.some((r) => r.test(l))) hits.push(`${f}:${i + 1}: ${l.trim().slice(0, 140)}`) })
  }
}
if (hits.length) {
  console.error(`NO ORANGE: ${hits.length} use(s) of the orange family — use the hazard ramp (#22c55e / #eab308 / #fb7185 / #ef4444) or DOMAIN_COLORS:`)
  for (const h of hits.slice(0, 50)) console.error('  ' + h)
  process.exit(1)
}
console.log('NO ORANGE: clean')
