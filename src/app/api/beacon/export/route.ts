import { gateMember, loadCase } from '@/lib/beacon/cases'
import { caseToMarkdown, caseToBriefHtml, caseToOnePagerHtml, caseTitle } from '@/lib/beacon/export'

/**
 * GET /api/beacon/export?caseId=N&format=md|onepager|brief|pdf — export an ASSEMBLED case (WFM-93 / 019).
 *
 * The walk-away product. From a case the member owns, renders the curated case to a portable artifact:
 *   - md       → full Defensible Position Brief as Markdown (downloads as case-N.md).
 *   - onepager → condensed, print-clean HTML one-pager (viewable in-browser).
 *   - brief    → full brief as print-clean HTML.
 *   - pdf      → print-clean HTML that auto-opens the browser's print dialog → Save as PDF.
 *                `&doc=brief` PDFs the full brief; default PDFs the one-pager.
 *
 * PDF approach: no server-side PDF library (puppeteer/chromium cold-starts are heavy on serverless).
 * Instead we serve print-optimized HTML with an auto-`window.print()` and use the browser's native
 * print-to-PDF. Zero added dependency, instant.
 *
 * Gate: auth + premium + member ownership (reuses gateMember/loadCase). Only `assembled` (or already
 * `exported`) cases export — a case with no assembled sections has nothing defensible to render.
 * No-fabrication: every byte rendered is already in the case (cased evidence + assembled sections).
 */

export const runtime = 'nodejs'

type Format = 'md' | 'onepager' | 'brief' | 'pdf'
const FORMATS: Format[] = ['md', 'onepager', 'brief', 'pdf']

export async function GET(request: Request) {
  const gate = await gateMember()
  if (gate instanceof Response) return gate
  const { pool, memberId } = gate

  const url = new URL(request.url)
  const caseIdRaw = url.searchParams.get('caseId')
  const format = (url.searchParams.get('format') || 'md') as Format
  const doc = url.searchParams.get('doc') === 'brief' ? 'brief' : 'onepager'

  const caseId = Number(caseIdRaw)
  if (!caseIdRaw || !Number.isFinite(caseId)) {
    return Response.json({ error: 'caseId required' }, { status: 400 })
  }
  if (!FORMATS.includes(format)) {
    return Response.json({ error: `format must be one of ${FORMATS.join(', ')}` }, { status: 400 })
  }

  const theCase = await loadCase(pool, caseId, memberId)
  if (!theCase) return Response.json({ error: 'case not found' }, { status: 404 })

  if (theCase.status !== 'assembled' && theCase.status !== 'exported') {
    return Response.json(
      { error: 'Assemble the case before exporting — only assembled cases have a defensible brief.' },
      { status: 409 },
    )
  }
  if (!theCase.sections) {
    return Response.json({ error: 'case has no assembled sections to export' }, { status: 409 })
  }

  const slug = caseTitle(theCase).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || `case-${caseId}`

  if (format === 'md') {
    return new Response(caseToMarkdown(theCase), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${slug}.md"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  let html: string
  if (format === 'brief') html = caseToBriefHtml(theCase)
  else if (format === 'onepager') html = caseToOnePagerHtml(theCase)
  // pdf: auto-print the chosen doc (one-pager by default).
  else html = doc === 'brief' ? caseToBriefHtml(theCase, { auto: true }) : caseToOnePagerHtml(theCase, { auto: true })

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
