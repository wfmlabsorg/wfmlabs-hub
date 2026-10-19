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
 *
 * The travel-risk surfaces (the globe, /travelrisk pages and components) also ban AMBER (2026-10-19): on the dark
 * globe #f59e0b reads as orange, and yellow #eab308 is the one "watch" colour there. The rest of the community site
 * keeps its amber accents.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOTS = ['src', 'public/roc']
const EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.css', '.html'])
const ORANGE_HEX = ['fff7ed', 'ffedd5', 'fed7aa', 'fdba74', 'fb923c', 'f97316', 'ea580c', 'c2410c', '9a3412', '7c2d12', '431407']
// amber family — enforced only under AMBER_SCOPES
const AMBER_HEX = ['fcd34d', 'fbbf24', 'f59e0b', 'd97706', 'b45309', '92400e', '78350f', '451a03']
const AMBER_SCOPES = ['public/roc/globe/', 'src/components/travelrisk/', 'src/app/(frontend)/travelrisk/', 'src/app/api/roc-misery/', 'src/app/api/roc-misery-history/']
const AMBER_RULES = [
  new RegExp(`#(?:${AMBER_HEX.join('|')})(?:[0-9a-f]{2})?(?![0-9a-f])`, 'i'),
  // rgb()/rgba() of every amber shade, comma or CSS4 space syntax
  ...AMBER_HEX.map((hex) => {
    const [r, g, b] = hex.match(/../g).map((part) => parseInt(part, 16))
    return new RegExp(`rgba?\\(\\s*${r}\\s*[,\\s]\\s*${g}\\s*[,\\s]\\s*${b}\\b`)
  }),
  /\b(?:text|bg|border|from|via|to|ring|fill|stroke|outline|decoration|shadow|accent|caret)-amber-\d{2,3}\b/,
]
const RULES = [
  // 6-digit, or 8-digit with alpha (#f9731688); not a longer hex run
  new RegExp(`#(?:${ORANGE_HEX.join('|')})(?:[0-9a-f]{2})?(?![0-9a-f])`, 'i'),
  // rgb()/rgba() with commas or the CSS4 space syntax: rgb(249 115 22 / .5)
  /rgba?\(\s*249\s*[,\s]\s*115\s*[,\s]\s*22\b/,
  /\b(?:text|bg|border|from|via|to|ring|fill|stroke|outline|decoration|shadow|accent|caret)-orange-\d{2,3}\b/,
]
// only a COMMENT that states the rule is exempt — a code line that merely mentions it is still scanned.
// A line is a comment if it starts with a comment marker or sits inside an open /* … */ or <!-- … --> block.
const STATES_RULE = /NO[ -]ORANGE/i
const LINE_COMMENT = /^\s*(\/\/|\/\*|\*|<!--|#)/

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
  try { files = [...walk(root)] } catch (e) {
    // fail closed: a root that cannot be read must not pass as clean
    console.error(`NO ORANGE: cannot scan ${root}: ${e.message}`)
    process.exit(1)
  }
  for (const f of files) {
    const lines = readFileSync(f, 'utf8').split('\n')
    const rules = AMBER_SCOPES.some((s) => f.split('\\').join('/').startsWith(s)) ? [...RULES, ...AMBER_RULES] : RULES
    let inBlock = false
    lines.forEach((l, i) => {
      const startsInBlock = inBlock
      // track block comments across lines (last opener/closer on the line wins)
      const open = Math.max(l.lastIndexOf('/*'), l.lastIndexOf('<!--')), close = Math.max(l.lastIndexOf('*/'), l.lastIndexOf('-->'))
      if (open > close) inBlock = true; else if (close > open) inBlock = false
      const isComment = startsInBlock || LINE_COMMENT.test(l)
      if (isComment && STATES_RULE.test(l)) return
      if (rules.some((r) => r.test(l))) hits.push(`${f}:${i + 1}: ${l.trim().slice(0, 140)}`)
    })
  }
}
if (hits.length) {
  console.error(`NO ORANGE: ${hits.length} use(s) of the orange family (amber too on travel-risk surfaces) — use the hazard ramp (#22c55e / #eab308 / #fb7185 / #ef4444) or DOMAIN_COLORS:`)
  for (const h of hits.slice(0, 50)) console.error('  ' + h)
  process.exit(1)
}
console.log('NO ORANGE: clean')
