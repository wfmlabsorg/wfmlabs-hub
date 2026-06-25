/**
 * Beacon Case Canvas — source credibility tiers + grade enforcement (WFM-94 / research-020).
 *
 * The headline iteration-2 fix: Exa was surfacing vendor blogs / marketing pages that got treated
 * like research. This module classifies every evidence source into a credibility TIER and enforces
 * the A–V grade against that tier so a vendor claim can never masquerade as settled evidence.
 *
 * Tiers (strongest → weakest):
 *   - peer_reviewed — journal article / DOI / our vetted library papers
 *   - preprint      — arXiv / SSRN / NBER working papers etc.
 *   - institutional — gov / academic-institution / standards-body / think-tank reports
 *   - vendor        — commercial/vendor domains, product/marketing/blog pages → grade V (interested)
 *   - web_other     — general web / news / blogs → suggestive only, grade capped at C
 *
 * Grade enforcement (the rail):
 *   - vendor    → ALWAYS grade V (Vendor/Interested — hypothesis-generating only, never load-bearing)
 *   - web_other → grade capped at C (a web hit can be suggestive, never strong)
 *   - research tiers → grade flows through unchanged (the deep-read appraiser's A–V stands)
 * The assemble prompt applies the matching rule in prose ("no claim may stand on V or C alone without
 * saying so"); this module makes the grade itself honest so that rule has teeth.
 *
 * Detection is best-effort and conservative: when a commercial page shows marketing signals we err
 * toward `vendor`; pure news/reference falls to `web_other`. Library cards are research by default
 * (the library is vetted) — they only drop to `vendor` when the appraiser already graded them V.
 */

import type { Grade } from '@/lib/beacon/deepread'
import type { SourceTier } from '@/lib/beacon/cases'

// ── host helpers ──

function hostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** True when `host` is, or is a subdomain of, any domain in `domains`. */
function hostMatches(host: string, domains: string[]): boolean {
  return domains.some((d) => host === d || host.endsWith('.' + d))
}

// Peer-reviewed journal / publisher hosts.
const JOURNAL_HOSTS = [
  'doi.org', 'sciencedirect.com', 'springer.com', 'link.springer.com', 'wiley.com',
  'onlinelibrary.wiley.com', 'tandfonline.com', 'sagepub.com', 'journals.sagepub.com', 'jstor.org',
  'nature.com', 'science.org', 'sciencemag.org', 'pnas.org', 'plos.org', 'journals.plos.org',
  'bmj.com', 'thelancet.com', 'cell.com', 'frontiersin.org', 'mdpi.com', 'emerald.com', 'oup.com',
  'academic.oup.com', 'cambridge.org', 'apa.org', 'psycnet.apa.org', 'aeaweb.org', 'informs.org',
  'pubsonline.informs.org', 'acm.org', 'dl.acm.org', 'ieeexplore.ieee.org', 'jamanetwork.com',
  'annualreviews.org', 'elsevier.com', 'degruyter.com', 'taylorandfrancis.com', 'nih.gov', // pubmed/pmc
  'ncbi.nlm.nih.gov',
]

// Preprint / working-paper hosts.
const PREPRINT_HOSTS = [
  'arxiv.org', 'ssrn.com', 'papers.ssrn.com', 'biorxiv.org', 'medrxiv.org', 'psyarxiv.com', 'osf.io',
  'researchsquare.com', 'preprints.org', 'nber.org', 'ideas.repec.org', 'repec.org', 'econstor.eu',
]

// Institutional: standards bodies, IGOs, think-tanks (TLD checks handle .gov / .edu / .ac.* / .mil).
const INSTITUTIONAL_HOSTS = [
  'who.int', 'oecd.org', 'worldbank.org', 'imf.org', 'un.org', 'europa.eu', 'ec.europa.eu',
  'iso.org', 'ieee.org', 'nist.gov', 'iea.org', 'ilo.org', 'wto.org', 'bis.org',
  'brookings.edu', 'rand.org', 'pewresearch.org', 'nationalacademies.org', 'urban.org', 'rff.org',
]

// Known commercial / vendor / analyst / consultancy domains — interested parties, not research.
const VENDOR_HOSTS = [
  'gartner.com', 'forrester.com', 'idc.com', 'mckinsey.com', 'bcg.com', 'deloitte.com', 'pwc.com',
  'kpmg.com', 'accenture.com', 'bain.com', 'capgemini.com',
  'nice.com', 'verint.com', 'genesys.com', 'five9.com', 'talkdesk.com', 'zendesk.com',
  'salesforce.com', 'servicenow.com', 'hubspot.com', 'qualtrics.com', 'medallia.com', 'gallup.com',
  'calabrio.com', 'aspect.com', 'playvox.com', 'assembled.com', 'injixo.com', 'cresta.com',
  'observe.ai', 'sprinklr.com', 'liveperson.com', 'intercom.com', 'freshworks.com', 'ringcentral.com',
  '8x8.com', 'twilio.com', 'amazon.com', 'aws.amazon.com', 'microsoft.com', 'google.com',
]

// Marketing / collateral path segments — a commercial page selling something, not reporting research.
const MARKETING_PATH =
  /\/(blog|resources?|guides?|ebooks?|e-book|white[-_]?papers?|case[-_]?stud(y|ies)|customer[-_]?stor(y|ies)|products?|solutions?|platform|pricing|demo|webinars?|insights?|use[-_]?cases?|landing|lp)(\/|$|\?)/i

// Marketing copy signals in the fetched highlight text.
const MARKETING_CONTENT =
  /(request a demo|book a demo|schedule a demo|our platform|our solution|our customers|our software|trusted by|get started|contact sales|free trial|sign up|start your free|talk to sales)/i

const ARXIV_LIKE = /\barxiv\b|\b\d{4}\.\d{4,5}\b/i
const DOI_RE = /\b10\.\d{4,9}\/[-._;()/:a-z0-9]+/i

/**
 * Classify an open-web / Exa result into a credibility tier from its URL, title, and fetched text.
 * Order matters: research signals win first, then institutional, then vendor, else web_other.
 */
export function classifyWebTier(url: string, title = '', content = ''): SourceTier {
  const host = hostname(url)
  const path = (() => {
    try {
      return new URL(url).pathname
    } catch {
      return ''
    }
  })()
  const hay = `${url} ${title} ${content}`

  // 1. Preprints.
  if (hostMatches(host, PREPRINT_HOSTS) || ARXIV_LIKE.test(`${url} ${title}`)) return 'preprint'
  // 2. Peer-reviewed: journal/publisher host or a DOI anywhere in the locator.
  if (hostMatches(host, JOURNAL_HOSTS) || DOI_RE.test(hay)) return 'peer_reviewed'
  // 3. Institutional: gov/edu/mil/ac TLDs, IGOs, standards bodies, think-tanks.
  if (
    /\.gov(\.[a-z]{2})?$/.test(host) ||
    /\.mil$/.test(host) ||
    /\.edu(\.[a-z]{2})?$/.test(host) ||
    /\.ac\.[a-z]{2}$/.test(host) ||
    hostMatches(host, INSTITUTIONAL_HOSTS)
  ) {
    return 'institutional'
  }
  // 4. Vendor: known commercial domain, OR a marketing path / marketing copy on any site.
  if (hostMatches(host, VENDOR_HOSTS) || MARKETING_PATH.test(path) || MARKETING_CONTENT.test(content)) {
    return 'vendor'
  }
  // 5. Everything else — general web, news, reference, personal blogs.
  return 'web_other'
}

/**
 * Classify a LIBRARY (internal) card. The library is vetted research, so it stays in a research tier
 * by default; it only drops to `vendor` when the deep-read appraiser already graded it V (commercial
 * stake). Recognized journal/preprint/institutional hosts refine the research tier when a URL exists.
 */
export function classifyLibraryTier(p: { url?: string; grade: Grade }): SourceTier {
  if (p.grade === 'V') return 'vendor'
  const tier = classifyWebTier(p.url || '', '', '')
  // A vetted library paper on an unrecognized/commercial-looking host is still research, not web/vendor.
  return tier === 'web_other' || tier === 'vendor' ? 'peer_reviewed' : tier
}

const RANK: Record<Grade, number> = { A: 0, B: 1, C: 2, D: 3, V: 4, '—': 5 }

/**
 * Enforce the credibility rail on a grade:
 *   - vendor    → always V (interested party; never load-bearing).
 *   - web_other → capped at C (anything stronger is pulled down to suggestive).
 *   - research tiers → unchanged (the appraiser's A–V stands).
 */
export function enforceGrade(grade: Grade, tier: SourceTier): Grade {
  if (tier === 'vendor') return 'V'
  if (tier === 'web_other') return RANK[grade] < RANK['C'] ? 'C' : grade
  return grade
}

/**
 * Provisional grade for an UNREAD web/Exa hit (we have only its highlight, not a deep read), by tier:
 * a genuine peer-reviewed hit grades up to B; preprint/institutional/web_other are suggestive (C);
 * vendor is V. `enforceGrade` is still applied afterward as a safety net.
 */
export function webBaseGrade(tier: SourceTier): Grade {
  switch (tier) {
    case 'peer_reviewed':
      return 'B'
    case 'preprint':
    case 'institutional':
    case 'web_other':
      return 'C'
    case 'vendor':
      return 'V'
  }
}

/** Short human label for a tier (prompts, debug, UI legend). */
export function tierLabel(tier: SourceTier): string {
  switch (tier) {
    case 'peer_reviewed':
      return 'peer-reviewed'
    case 'preprint':
      return 'preprint'
    case 'institutional':
      return 'institutional'
    case 'vendor':
      return 'vendor · interested'
    case 'web_other':
      return 'web · unverified'
  }
}

/** True for the soft tiers that can never be load-bearing on their own. */
export function isWeakTier(tier: SourceTier | undefined): boolean {
  return tier === 'vendor' || tier === 'web_other'
}
