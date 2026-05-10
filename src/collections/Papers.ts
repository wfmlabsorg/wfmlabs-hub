import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { isMember } from '@/access/isMember'
import { isAuthor } from '@/access/isAuthor'

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
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
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
      name: 'publishedDate',
      type: 'date',
    },
    {
      name: 'addedBy',
      type: 'relationship',
      relationTo: 'members',
      required: true,
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
      name: 'topics',
      type: 'relationship',
      relationTo: 'topics',
      hasMany: true,
    },
    {
      name: 'pdfFile',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'discussionCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: 'reactionCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
    },
    {
      name: 'savedByCount',
      type: 'number',
      defaultValue: 0,
      admin: { readOnly: true },
    },
  ],
  access: {
    read: isMember,
    create: isAdmin,
    update: isAuthor('addedBy'),
    delete: isAdmin,
  },
}
