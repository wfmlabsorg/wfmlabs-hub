import type { CollectionConfig, CollectionAfterChangeHook } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { isMember } from '@/access/isMember'
import { isAuthor } from '@/access/isAuthor'
import { baseAssetFields } from './_baseAssetFields'
import { triggerCardEmbed } from '@/lib/papers/cardEmbed'

/**
 * Ratify → card + embed (research-029). When a paper transitions INTO `published` — a curator flips
 * the status in the admin, or POST /api/papers/ratify does it — nudge the card + embed workers so the
 * newly-live paper becomes retrievable + citable in future Beacon cases (the flywheel's last link).
 * Fires only on the proposed/draft→published edge (or a direct create at published); triggerCardEmbed
 * is fire-and-forget + no-ops when the workers aren't configured, so it never blocks the save.
 */
const cardEmbedOnPublish: CollectionAfterChangeHook = async ({ doc, previousDoc }) => {
  if (doc?.status === 'published' && previousDoc?.status !== 'published') {
    await triggerCardEmbed(doc.id as number)
  }
  return doc
}

export const Papers: CollectionConfig = {
  slug: 'papers',
  admin: {
    useAsTitle: 'title',
  },
  hooks: {
    afterChange: [cardEmbedOnPublish],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    ...baseAssetFields,
    // Paper-specific fields
    {
      name: 'paperType',
      type: 'select',
      options: [
        { label: 'Empirical Study', value: 'empirical-study' },
        { label: 'Literature Review', value: 'literature-review' },
        { label: 'Mathematical Model', value: 'mathematical-model' },
        { label: 'Industry Report', value: 'industry-report' },
        { label: 'Framework', value: 'framework' },
        { label: 'Case Study', value: 'case-study' },
        { label: 'Reference', value: 'reference' },
      ],
      admin: {
        description: 'Research type: what kind of paper this is',
      },
    },
    {
      name: 'sourceUrl',
      type: 'text',
      required: true,
    },
    {
      name: 'sourceType',
      type: 'select',
      options: [
        { label: 'arXiv', value: 'arxiv' },
        { label: 'SSRN', value: 'ssrn' },
        { label: 'Journal', value: 'journal' },
        { label: 'Industry Report', value: 'industry-report' },
        { label: 'Blog', value: 'blog' },
        { label: 'Vendor Research', value: 'vendor-research' },
        { label: 'Manual', value: 'manual' },
      ],
    },
    {
      name: 'sourceName',
      type: 'text',
      admin: {
        description: 'Publication name (e.g., "Harvard Business Review", "Operations Research")',
      },
    },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Queuing Theory', value: 'queuing-theory' },
        { label: 'AI & Machine Learning', value: 'ai-machine-learning' },
        { label: 'Operations Management', value: 'operations-management' },
        { label: 'Workforce Management', value: 'workforce-management' },
        { label: 'Customer Experience', value: 'customer-experience' },
        { label: 'Analytics & Forecasting', value: 'analytics-forecasting' },
        { label: 'Process Optimization', value: 'process-optimization' },
        { label: 'Technology', value: 'technology' },
        { label: 'Economics & Finance', value: 'economics-finance' },
        { label: 'Employee Well-Being', value: 'employee-wellbeing' },
        { label: 'Contact Center Operations', value: 'contact-center-operations' },
        { label: 'Scheduling & Optimization', value: 'scheduling-optimization' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'authors',
      type: 'array',
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'affiliation', type: 'text' },
      ],
    },
    {
      name: 'abstract',
      type: 'textarea',
    },
    {
      name: 'fullText',
      type: 'textarea',
    },
    {
      // Provenance for fullText acquisition (research-011). Kept in sync with the
      // raw-SQL column papers.full_text_source so Payload's schema model matches
      // the DB (no drift). Free text: arxiv | unpaywall | crossref | web | manual.
      name: 'fullTextSource',
      type: 'text',
      admin: {
        description: 'Where fullText was obtained: arxiv | unpaywall | crossref | web | manual',
      },
    },
    {
      // Acquisition lifecycle for fullText (research-011). Mirrors raw-SQL column
      // papers.full_text_status.
      name: 'fullTextStatus',
      type: 'select',
      options: ['pending', 'acquired', 'failed', 'unavailable'],
      admin: {
        description: 'Full-text acquisition status (research-011 backfill + harvest)',
      },
    },
    {
      name: 'curatorSummary',
      type: 'richText',
      admin: {
        description: "Beacon's summary or member contribution",
      },
    },
    {
      name: 'whyItMatters',
      type: 'richText',
    },
    {
      name: 'caveats',
      type: 'richText',
    },
    {
      name: 'pdfFile',
      type: 'upload',
      relationTo: 'media',
    },
  ],
  access: {
    read: () => true,
    create: isMember,
    update: isAuthor('primaryContributor'),
    delete: isAdmin,
  },
}
