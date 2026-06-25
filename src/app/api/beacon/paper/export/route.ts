import { gateMember, loadCase, loadCasePaper } from '@/lib/beacon/cases'
import { paperToMarkdown, paperToHtml, paperSlug } from '@/lib/beacon/export'

/**
 * GET /api/beacon/paper/export?caseId=N&format=md|pdf|doc — export a developed Beacon PAPER
 * (research-028 / WFM-102). The walk-away product for the Paper Pipeline.
 *
 * Where /api/beacon/export renders the assembled CASE brief, this renders the DEEP-ENGAGEMENT PAPER
 * artifact (research-027's `beacon_cases.paper`): the draft sections, the supporting/challenging
 * engagement, and the server-built references.
 *   - md  → full paper as Markdown (downloads as <slug>.md).
 *   - pdf → print-clean HTML that auto-opens the browser's print dialog → Save as PDF (browser-native,
 *           zero server-side PDF dependency — no chromium cold-start).
 *   - doc → the same print-clean HTML served as application/msword so Word opens it (downloads .doc).
 *
 * Gate: auth + premium + member ownership (gateMember + ownership in loadCase/loadCasePaper). Exports
 * ONLY when a paper has actually been developed for the case — no paper → 409. No-fabrication: every
 * byte rendered already lives in the persisted paper.
 */

export const runtime = 'nodejs'

type Format = 'md' | 'pdf' | 'doc'
const FORMATS: Format[] = ['md', 'pdf', 'doc']

export async function GET(request: Request) {
  const gate = await gateMember()
  if (gate instanceof Response) return gate
  const { pool, memberId } = gate

  const url = new URL(request.url)
  const caseIdRaw = url.searchParams.get('caseId')
  const format = (url.searchParams.get('format') || 'md') as Format

  const caseId = Number(caseIdRaw)
  if (!caseIdRaw || !Number.isFinite(caseId)) {
    return Response.json({ error: 'caseId required' }, { status: 400 })
  }
  if (!FORMATS.includes(format)) {
    return Response.json({ error: `format must be one of ${FORMATS.join(', ')}` }, { status: 400 })
  }

  // Ownership enforced in both queries — a member can only export their own case's paper.
  const theCase = await loadCase(pool, caseId, memberId)
  if (!theCase) return Response.json({ error: 'case not found' }, { status: 404 })

  const paper = await loadCasePaper(pool, caseId, memberId)
  if (!paper) {
    return Response.json(
      { error: 'No paper yet — develop the case into a paper (POST /api/beacon/paper) before exporting.' },
      { status: 409 },
    )
  }

  const slug = paperSlug(paper, theCase, caseId)

  if (format === 'md') {
    return new Response(paperToMarkdown(paper, theCase), {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${slug}.md"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  if (format === 'doc') {
    // Word opens HTML natively; serving it as application/msword downloads a .doc the member can edit.
    return new Response(paperToHtml(paper, theCase), {
      headers: {
        'Content-Type': 'application/msword; charset=utf-8',
        'Content-Disposition': `attachment; filename="${slug}.doc"`,
        'Cache-Control': 'no-store',
      },
    })
  }

  // pdf: print-clean HTML that auto-fires window.print() → browser Save as PDF.
  return new Response(paperToHtml(paper, theCase, { auto: true }), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
