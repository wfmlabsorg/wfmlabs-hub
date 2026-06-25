/**
 * Beacon Case Canvas — export rendering (WFM-93 / research-019).
 *
 * Turns an ASSEMBLED `BeaconCase` (see `cases.ts`) into the walk-away product in three formats:
 *   - Markdown   — the full Defensible Position Brief (commission → per-argument cased evidence →
 *                  the four assembled sections → a SOURCES list). Clean, portable.
 *   - One-pager  — a condensed, print-clean HTML view: decision, kept arguments each with their
 *                  single strongest piece of evidence, and the bottom line. The "take into the room"
 *                  artifact.
 *   - Full brief — the whole brief rendered as print-clean HTML (so the browser can print it to PDF).
 *
 * PURE rendering only — no I/O, no auth, no fabrication. Everything rendered here already lives in the
 * case: only `state==='cased'` cards are used, sections come from the assemble step, and web sources
 * are cited distinctly from library sources (web · fetched, member-supplied · no citation).
 *
 * The PDF format is produced by serving the print-clean HTML with an auto-`window.print()` so the
 * browser's native print-to-PDF makes the file — zero server-side PDF dependency, no cold-start hit.
 */

import type { BeaconCase, CasePaper, EvidenceCard, PaperFinding, PaperReference } from '@/lib/beacon/cases'
import type { Grade } from '@/lib/beacon/deepread'
import { tierLabel } from '@/lib/beacon/tiers'

// ── helpers ──

/** Beacon A–V grade order, strongest first (A best … V weakest credible, — ungraded). */
const GRADE_RANK: Record<Grade, number> = { A: 0, B: 1, C: 2, D: 3, V: 4, '—': 5 }

/** A card is member-supplied ("add my own data point") when it's web-typed with no citation URL. */
function isMemberSupplied(c: EvidenceCard): boolean {
  return c.source.type === 'web' && !c.source.url.trim()
}

type SourceKind = 'library' | 'web' | 'member'

function sourceKind(c: EvidenceCard): SourceKind {
  if (isMemberSupplied(c)) return 'member'
  return c.source.type === 'web' ? 'web' : 'library'
}

/** Short provenance suffix for an inline citation. */
function provenance(c: EvidenceCard): string {
  switch (sourceKind(c)) {
    case 'member':
      return 'member-supplied · no citation'
    case 'web':
      return 'web · fetched'
    default: {
      const authors = c.source.authors.slice(0, 3).join(', ')
      return authors || 'WFM Labs Research Library'
    }
  }
}

/** The cased cards for one bucket, in the bucket's declared card order, strongest-first as a tiebreak. */
function casedCardsForBucket(c: BeaconCase, bucketKey: string): EvidenceCard[] {
  const bucket = c.arguments.find((a) => a.key === bucketKey)
  const cased = c.evidence_pool.filter((card) => card.state === 'cased' && card.supports_argument === bucketKey)
  if (!bucket) return cased
  const order = new Map(bucket.card_ids.map((id, i) => [id, i]))
  return cased.slice().sort((a, b) => {
    const oa = order.has(a.id) ? order.get(a.id)! : Number.MAX_SAFE_INTEGER
    const ob = order.has(b.id) ? order.get(b.id)! : Number.MAX_SAFE_INTEGER
    if (oa !== ob) return oa - ob
    return GRADE_RANK[a.grade] - GRADE_RANK[b.grade]
  })
}

/** Buckets that actually carry cased evidence, in the case's argument order. */
function casedBuckets(c: BeaconCase): { key: string; label: string; cards: EvidenceCard[] }[] {
  const out: { key: string; label: string; cards: EvidenceCard[] }[] = []
  const seen = new Set<string>()
  for (const a of c.arguments) {
    const cards = casedCardsForBucket(c, a.key)
    if (cards.length) {
      out.push({ key: a.key, label: a.label || a.key, cards })
      seen.add(a.key)
    }
  }
  // Defensive: cased cards whose argument has no matching bucket still ship under an "Other" group.
  const orphans = c.evidence_pool.filter(
    (card) => card.state === 'cased' && !seen.has(card.supports_argument),
  )
  if (orphans.length) out.push({ key: '__other', label: 'Additional evidence', cards: orphans })
  return out
}

/** The single strongest cased card in a bucket (best grade; declared order breaks ties). */
function strongestCard(cards: EvidenceCard[]): EvidenceCard | null {
  if (!cards.length) return null
  return cards.slice().sort((a, b) => GRADE_RANK[a.grade] - GRADE_RANK[b.grade])[0]
}

export function caseTitle(c: BeaconCase): string {
  return (c.title || c.commission?.sharpened_question || c.commission?.decision || 'Untitled case').trim()
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// ── deduplicated SOURCES list ──

interface SourceEntry {
  kind: SourceKind
  title: string
  authors: string[]
  url: string
}

/** Dedupe cased sources: by paper_id|url for library, url for web, claim for member-supplied. */
function collectSources(c: BeaconCase): { library: SourceEntry[]; web: SourceEntry[]; member: SourceEntry[] } {
  const library = new Map<string, SourceEntry>()
  const web = new Map<string, SourceEntry>()
  const member: SourceEntry[] = []
  for (const card of c.evidence_pool) {
    if (card.state !== 'cased') continue
    const kind = sourceKind(card)
    if (kind === 'member') {
      member.push({ kind, title: card.source.title || card.claim, authors: [], url: '' })
      continue
    }
    const entry: SourceEntry = {
      kind,
      title: card.source.title || '(untitled source)',
      authors: card.source.authors || [],
      url: card.source.url,
    }
    if (kind === 'library') {
      const key = card.source.paper_id != null ? `p:${card.source.paper_id}` : `u:${card.source.url}`
      if (!library.has(key)) library.set(key, entry)
    } else {
      const key = `u:${card.source.url}`
      if (!web.has(key)) web.set(key, entry)
    }
  }
  return { library: [...library.values()], web: [...web.values()], member }
}

// ════════════════════════════════ MARKDOWN ════════════════════════════════

/** Full Defensible Position Brief as portable Markdown. */
export function caseToMarkdown(c: BeaconCase): string {
  const L: string[] = []
  const title = caseTitle(c)
  L.push(`# ${title}`, '')
  L.push(`> **Defensible Position Brief** · Beacon · WFM Labs`)
  L.push(`> Exported ${today()}`, '')

  const cm = c.commission
  if (cm) {
    L.push('## Commission', '')
    if (cm.decision) L.push(`- **Decision:** ${cm.decision}`)
    if (cm.skeptic) L.push(`- **Skeptic:** ${cm.skeptic}`)
    if (cm.context) L.push(`- **Context:** ${cm.context}`)
    if (cm.sharpened_question) L.push(`- **Sharpened question:** ${cm.sharpened_question}`)
    L.push('')
  }

  L.push('## The Case', '')
  const buckets = casedBuckets(c)
  if (!buckets.length) {
    L.push('_No evidence was kept into this case._', '')
  }
  for (const b of buckets) {
    L.push(`### ${b.label}`, '')
    for (const card of b.cards) {
      const link = card.source.url ? `[${mdEscape(card.source.title || 'source')}](${card.source.url})` : mdEscape(card.source.title || 'member-supplied')
      L.push(`- **${mdEscape(card.claim)}** — grade ${card.grade} · ${link} · ${provenance(card)}`)
    }
    L.push('')
  }

  const s = c.sections
  if (s) {
    if (s.position) L.push('## Position', '', s.position, '')
    if (s.steelman) L.push('## Steelman', '', s.steelman, '')
    if (s.gaps) L.push('## Where the evidence runs out', '', s.gaps, '')
    if (s.bottom_line) L.push('## Bottom line', '', s.bottom_line, '')
  }

  const src = collectSources(c)
  L.push('## Sources', '')
  if (src.library.length) {
    L.push('**Library**', '')
    src.library.forEach((e, i) => {
      const a = e.authors.slice(0, 4).join(', ')
      const link = e.url ? ` — [${mdEscape(e.url)}](${e.url})` : ''
      L.push(`${i + 1}. ${mdEscape(e.title)}${a ? ` — ${mdEscape(a)}` : ''}${link}`)
    })
    L.push('')
  }
  if (src.web.length) {
    L.push('**Web** (web · fetched)', '')
    src.web.forEach((e, i) => {
      const link = e.url ? ` — [${mdEscape(e.url)}](${e.url})` : ''
      L.push(`${i + 1}. ${mdEscape(e.title)}${link}`)
    })
    L.push('')
  }
  if (src.member.length) {
    L.push('**Member-supplied** (no citation)', '')
    src.member.forEach((e) => L.push(`- ${mdEscape(e.title)}`))
    L.push('')
  }
  if (!src.library.length && !src.web.length && !src.member.length) {
    L.push('_No sources cited._', '')
  }

  L.push('---', '', `_Generated by Beacon — WFM Labs. Cites only curated evidence; gaps are stated, not hidden._`)
  return L.join('\n')
}

function mdEscape(s: string): string {
  // Neutralize markdown link/format breakers in inline text; keep it readable.
  return String(s).replace(/([\\`*_[\]()<>])/g, '\\$1')
}

// ════════════════════════════════ HTML ════════════════════════════════

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const GRADE_COLOR: Record<Grade, string> = {
  A: '#16a34a',
  B: '#65a30d',
  C: '#ca8a04',
  D: '#dc2626',
  V: '#9333ea',
  '—': '#64748b',
}

function gradeBadge(g: Grade): string {
  return `<span class="grade" style="background:${GRADE_COLOR[g]}">${esc(g)}</span>`
}

function sourceLink(card: EvidenceCard): string {
  const title = esc(card.source.title || (isMemberSupplied(card) ? 'member-supplied' : 'source'))
  const link = card.source.url
    ? `<a href="${esc(card.source.url)}" target="_blank" rel="noopener noreferrer">${title}</a>`
    : `<span class="nolink">${title}</span>`
  return `${link} <span class="prov">${esc(provenance(card))}</span>`
}

/** Shared print-clean document shell. `auto` injects the auto-print script for browser print-to-PDF. */
function htmlShell(title: string, body: string, auto: boolean): string {
  const autoScript = auto
    ? `<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},250)})</script>`
    : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — Beacon</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: "IBM Plex Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #0b1120; background: #f8fafc; line-height: 1.5;
    margin: 0; padding: 32px;
  }
  .doc { max-width: 820px; margin: 0 auto; background: #fff; padding: 48px 56px; border-radius: 8px;
         box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .eyebrow { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: #0891b2;
             font-weight: 600; margin: 0 0 6px; }
  h1 { font-size: 26px; line-height: 1.25; margin: 0 0 4px; }
  .meta { color: #64748b; font-size: 13px; margin: 0 0 28px; border-bottom: 2px solid #22d3ee; padding-bottom: 16px; }
  h2 { font-size: 15px; letter-spacing: .04em; text-transform: uppercase; color: #0e7490;
       margin: 30px 0 12px; }
  h3 { font-size: 17px; margin: 22px 0 8px; }
  h3.challenge { color: #7c3aed; }
  p { margin: 0 0 12px; }
  .commission { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; font-size: 14px;
                background: #f1f5f9; border-radius: 6px; padding: 16px 20px; }
  .commission dt { font-weight: 600; color: #475569; }
  .commission dd { margin: 0; }
  ul.cards { list-style: none; padding: 0; margin: 0 0 8px; }
  ul.cards li { padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
  ul.cards li:last-child { border-bottom: none; }
  .claim { font-weight: 600; }
  .grade { display: inline-block; min-width: 18px; text-align: center; color: #fff; font-weight: 700;
           font-size: 11px; padding: 1px 6px; border-radius: 4px; margin-right: 8px; vertical-align: middle; }
  .src { display: block; margin-top: 3px; font-size: 12.5px; color: #475569; }
  .src a { color: #0e7490; }
  .prov { color: #94a3b8; }
  .nolink { color: #475569; }
  .section p { font-size: 14.5px; }
  .gaps { background: #fef3c7; border-left: 3px solid #d97706; padding: 12px 16px; border-radius: 0 6px 6px 0; }
  .bottom { background: #ecfeff; border-left: 3px solid #0891b2; padding: 14px 18px; border-radius: 0 6px 6px 0;
            font-size: 15px; font-weight: 500; }
  ol.sources, .sources ul { font-size: 13px; color: #334155; padding-left: 20px; }
  .sources h2 { margin-top: 24px; }
  .sub { font-weight: 600; font-size: 13px; color: #475569; margin: 12px 0 4px; }
  .foot { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 11.5px; color: #94a3b8; }
  @media print {
    body { background: #fff; padding: 0; }
    .doc { box-shadow: none; border-radius: 0; max-width: none; padding: 0; }
    a { color: #0e7490; text-decoration: none; }
    .src a::after { content: " (" attr(href) ")"; font-size: 10px; color: #94a3b8; word-break: break-all; }
  }
  @page { margin: 18mm; }
</style>
${autoScript}
</head>
<body><div class="doc">${body}</div></body>
</html>`
}

function commissionBlock(c: BeaconCase): string {
  const cm = c.commission
  if (!cm) return ''
  const rows: string[] = []
  if (cm.decision) rows.push(`<dt>Decision</dt><dd>${esc(cm.decision)}</dd>`)
  if (cm.skeptic) rows.push(`<dt>Skeptic</dt><dd>${esc(cm.skeptic)}</dd>`)
  if (cm.context) rows.push(`<dt>Context</dt><dd>${esc(cm.context)}</dd>`)
  if (cm.sharpened_question) rows.push(`<dt>Question</dt><dd>${esc(cm.sharpened_question)}</dd>`)
  if (!rows.length) return ''
  return `<h2>Commission</h2><dl class="commission">${rows.join('')}</dl>`
}

function sectionsBlocks(c: BeaconCase): string {
  const s = c.sections
  if (!s) return ''
  const out: string[] = []
  if (s.position) out.push(`<div class="section"><h2>Position</h2><p>${esc(s.position)}</p></div>`)
  if (s.steelman) out.push(`<div class="section"><h2>Steelman</h2><p>${esc(s.steelman)}</p></div>`)
  if (s.gaps) out.push(`<div class="section"><h2>Where the evidence runs out</h2><p class="gaps">${esc(s.gaps)}</p></div>`)
  if (s.bottom_line) out.push(`<div class="section"><h2>Bottom line</h2><p class="bottom">${esc(s.bottom_line)}</p></div>`)
  return out.join('')
}

function sourcesBlock(c: BeaconCase): string {
  const src = collectSources(c)
  if (!src.library.length && !src.web.length && !src.member.length) return ''
  const parts: string[] = ['<div class="sources"><h2>Sources</h2>']
  if (src.library.length) {
    parts.push('<p class="sub">Library</p><ol class="sources">')
    for (const e of src.library) {
      const a = e.authors.slice(0, 4).join(', ')
      const link = e.url ? ` — <a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">link</a>` : ''
      parts.push(`<li>${esc(e.title)}${a ? ` — ${esc(a)}` : ''}${link}</li>`)
    }
    parts.push('</ol>')
  }
  if (src.web.length) {
    parts.push('<p class="sub">Web · fetched</p><ol class="sources">')
    for (const e of src.web) {
      const link = e.url ? ` — <a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(e.url)}</a>` : ''
      parts.push(`<li>${esc(e.title)}${link}</li>`)
    }
    parts.push('</ol>')
  }
  if (src.member.length) {
    parts.push('<p class="sub">Member-supplied (no citation)</p><ul>')
    for (const e of src.member) parts.push(`<li>${esc(e.title)}</li>`)
    parts.push('</ul>')
  }
  parts.push('</div>')
  return parts.join('')
}

const FOOTER =
  '<p class="foot">Generated by Beacon — WFM Labs. Cites only curated evidence; gaps are stated, not hidden.</p>'

/** Full Defensible Position Brief as print-clean HTML. `auto` → browser print-to-PDF on load. */
export function caseToBriefHtml(c: BeaconCase, opts: { auto?: boolean } = {}): string {
  const title = caseTitle(c)
  const buckets = casedBuckets(c)
  const caseBody = buckets.length
    ? buckets
        .map(
          (b) =>
            `<h3>${esc(b.label)}</h3><ul class="cards">${b.cards
              .map(
                (card) =>
                  `<li>${gradeBadge(card.grade)}<span class="claim">${esc(card.claim)}</span><span class="src">${sourceLink(card)}</span></li>`,
              )
              .join('')}</ul>`,
        )
        .join('')
    : '<p><em>No evidence was kept into this case.</em></p>'

  const body = [
    `<p class="eyebrow">Defensible Position Brief</p>`,
    `<h1>${esc(title)}</h1>`,
    `<p class="meta">Beacon · WFM Labs · Exported ${esc(today())}</p>`,
    commissionBlock(c),
    `<h2>The Case</h2>${caseBody}`,
    sectionsBlocks(c),
    sourcesBlock(c),
    FOOTER,
  ].join('')
  return htmlShell(title, body, !!opts.auto)
}

/**
 * Condensed one-pager as print-clean HTML: the decision, each kept argument with its single strongest
 * piece of evidence, and the bottom line. The "take into the room" artifact. `auto` → print-to-PDF.
 */
export function caseToOnePagerHtml(c: BeaconCase, opts: { auto?: boolean } = {}): string {
  const title = caseTitle(c)
  const cm = c.commission
  const buckets = casedBuckets(c)

  const argRows = buckets.length
    ? `<ul class="cards">${buckets
        .map((b) => {
          const top = strongestCard(b.cards)
          if (!top) return ''
          return `<li><span class="claim">${esc(b.label)}</span><span class="src">${gradeBadge(top.grade)}${esc(top.claim)} — ${sourceLink(top)}</span></li>`
        })
        .join('')}</ul>`
    : '<p><em>No evidence was kept into this case.</em></p>'

  const decision = cm?.sharpened_question || cm?.decision
  const body = [
    `<p class="eyebrow">Beacon One-Pager</p>`,
    `<h1>${esc(title)}</h1>`,
    `<p class="meta">WFM Labs · Exported ${esc(today())}</p>`,
    decision ? `<h2>Decision</h2><p>${esc(decision)}</p>` : '',
    `<h2>The argument</h2>${argRows}`,
    c.sections?.bottom_line
      ? `<div class="section"><h2>Bottom line</h2><p class="bottom">${esc(c.sections.bottom_line)}</p></div>`
      : '',
    FOOTER,
  ].join('')
  return htmlShell(title, body, !!opts.auto)
}

// ════════════════════════════ PAPER PIPELINE (research-028) ════════════════════════════
//
// Renders the Deep-Engagement `CasePaper` artifact (research-027) to the walk-away product in three
// formats: Markdown, print-clean HTML (browser print-to-PDF), and Doc(HTML) (served as application/
// msword so Word opens it). PURE rendering — no I/O, no auth, no fabrication: every byte already lives
// in the persisted paper (draft sections, server-built references, deep engagement). Inline [E#]/[C#]
// citations are kept verbatim — they resolve against the rendered References list.

export function paperTitle(paper: CasePaper, c: BeaconCase): string {
  return (paper.draft.title || caseTitle(c) || 'Untitled paper').trim()
}

/** Slug for a paper export filename. */
export function paperSlug(paper: CasePaper, c: BeaconCase, caseId: number): string {
  return (
    paperTitle(paper, c).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) ||
    `paper-${caseId}`
  )
}

/** Author byline for a reference (≤4 names). */
function refAuthors(r: PaperReference): string {
  return (r.authors || []).slice(0, 4).join(', ')
}

/** The READable section blocks of a paper draft, in publication order. */
function paperBlocks(paper: CasePaper): { heading: string; body: string }[] {
  const d = paper.draft
  return [
    { heading: 'Abstract', body: d.abstract },
    { heading: 'Introduction', body: d.introduction },
    { heading: 'Theory — the position', body: d.theory },
    { heading: 'Evidence for', body: d.evidence_for },
    { heading: 'Counter-case & limitations', body: d.counter_case_and_limitations },
    { heading: 'Discussion', body: d.discussion },
    { heading: 'Conclusion', body: d.conclusion },
  ].filter((b) => b.body && b.body.trim())
}

// ── Markdown ──

/** The Deep-Engagement paper as portable Markdown (draft → engagement → references). */
export function paperToMarkdown(paper: CasePaper, c: BeaconCase): string {
  const L: string[] = []
  L.push(`# ${paperTitle(paper, c)}`, '')
  L.push(`> **Original synthesis** · Beacon · WFM Labs`)
  L.push(`> Generated ${paper.generated_at?.slice(0, 10) || today()}`, '')

  for (const b of paperBlocks(paper)) {
    L.push(`## ${b.heading}`, '', b.body.trim(), '')
  }

  const eng = paper.engagement
  const findingLines = (label: string, findings: PaperFinding[]) => {
    if (!findings.length) return
    L.push(`### ${label}`, '')
    for (const f of findings) {
      const g = f.grade ? ` _(grade ${f.grade})_` : ''
      L.push(`- **[${f.ref}] ${mdEscape(f.statement)}**${g}`)
      if (f.detail?.trim()) L.push(`  ${mdEscape(f.detail.trim())}`)
    }
    L.push('')
  }
  if (eng && (eng.supporting.length || eng.challenging.length || eng.tensions.length)) {
    L.push('## Evidence engagement', '')
    findingLines('Supporting evidence', eng.supporting)
    findingLines('Challenging evidence', eng.challenging)
    if (eng.tensions.length) {
      L.push('### Tensions & open questions', '')
      for (const t of eng.tensions) {
        const refs = t.refs.length ? ` _(${t.refs.join(', ')})_` : ''
        L.push(`- ${mdEscape(t.statement)}${refs}`)
      }
      L.push('')
    }
  }

  const refs = paper.draft.references || []
  L.push('## References', '')
  if (!refs.length) {
    L.push('_No sources cited._', '')
  } else {
    for (const r of refs) {
      const a = refAuthors(r)
      const tier = r.tier ? ` · ${tierLabel(r.tier)}` : ''
      const link = r.url ? ` — [${mdEscape(r.url)}](${r.url})` : ''
      const doi = r.doi && !r.url.includes(r.doi) ? ` · doi:${r.doi}` : ''
      L.push(`- **[${r.ref}]** ${mdEscape(r.title)}${a ? ` — ${mdEscape(a)}` : ''}${tier}${link}${doi}`)
    }
    L.push('')
  }

  L.push(
    '---',
    '',
    `_Generated by Beacon — WFM Labs. An original synthesis of the cited evidence; supporting and challenging findings are engaged honestly._`,
  )
  return L.join('\n')
}

// ── HTML (print-to-PDF and Doc) ──

/** Split prose into escaped <p> paragraphs (paper drafts separate paragraphs with blank lines). */
function paperParas(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('')
}

function engagementHtml(paper: CasePaper): string {
  const eng = paper.engagement
  if (!eng || (!eng.supporting.length && !eng.challenging.length && !eng.tensions.length)) return ''
  const findingList = (findings: PaperFinding[]): string =>
    `<ul class="cards">${findings
      .map((f) => {
        const g = f.grade ? gradeBadge(f.grade) : ''
        const detail = f.detail?.trim() ? `<span class="src">${esc(f.detail.trim())}</span>` : ''
        return `<li>${g}<span class="claim">[${esc(f.ref)}] ${esc(f.statement)}</span>${detail}</li>`
      })
      .join('')}</ul>`
  const parts: string[] = ['<h2>Evidence engagement</h2>']
  if (eng.supporting.length) parts.push(`<h3>Supporting evidence</h3>${findingList(eng.supporting)}`)
  if (eng.challenging.length)
    parts.push(`<h3 class="challenge">Challenging evidence</h3>${findingList(eng.challenging)}`)
  if (eng.tensions.length) {
    parts.push('<h3>Tensions &amp; open questions</h3><ul class="sources">')
    for (const t of eng.tensions) {
      const refs = t.refs.length ? ` <span class="prov">(${esc(t.refs.join(', '))})</span>` : ''
      parts.push(`<li>${esc(t.statement)}${refs}</li>`)
    }
    parts.push('</ul>')
  }
  return parts.join('')
}

function referencesHtml(paper: CasePaper): string {
  const refs = paper.draft.references || []
  if (!refs.length) return '<h2>References</h2><p><em>No sources cited.</em></p>'
  const items = refs
    .map((r) => {
      const a = refAuthors(r)
      const tier = r.tier ? ` · ${esc(tierLabel(r.tier))}` : ''
      const link = r.url
        ? ` — <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.url)}</a>`
        : ''
      const doi = r.doi && !r.url.includes(r.doi) ? ` · doi:${esc(r.doi)}` : ''
      return `<li><strong>[${esc(r.ref)}]</strong> ${esc(r.title)}${a ? ` — ${esc(a)}` : ''}${tier}${link}${doi}</li>`
    })
    .join('')
  return `<h2>References</h2><ol class="sources">${items}</ol>`
}

/** The Deep-Engagement paper as print-clean HTML. `auto` → browser print-to-PDF on load. */
export function paperToHtml(paper: CasePaper, c: BeaconCase, opts: { auto?: boolean } = {}): string {
  const title = paperTitle(paper, c)
  const sections = paperBlocks(paper)
    .map((b) => `<div class="section"><h2>${esc(b.heading)}</h2>${paperParas(b.body)}</div>`)
    .join('')
  const body = [
    `<p class="eyebrow">Original synthesis · Beacon</p>`,
    `<h1>${esc(title)}</h1>`,
    `<p class="meta">WFM Labs · Generated ${esc(paper.generated_at?.slice(0, 10) || today())}</p>`,
    sections,
    engagementHtml(paper),
    `<div class="sources">${referencesHtml(paper)}</div>`,
    FOOTER,
  ].join('')
  return htmlShell(title, body, !!opts.auto)
}
