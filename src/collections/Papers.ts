import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { isMember } from '@/access/isMember'
import { isAuthor } from '@/access/isAuthor'
import { baseAssetFields } from './_baseAssetFields'

export const Papers: CollectionConfig = {
  slug: 'papers',
  admin: {
    useAsTitle: 'title',
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
