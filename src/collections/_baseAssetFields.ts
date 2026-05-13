import type { Field } from 'payload'

/**
 * Shared base fields for all WLAA asset collections.
 * Spread into each asset collection's fields array.
 */
export const baseAssetFields: Field[] = [
  {
    name: 'slug',
    type: 'text',
    required: true,
    unique: true,
    admin: {
      description: 'URL-safe identifier (auto-generated or manual)',
    },
  },
  {
    name: 'primaryContributor',
    type: 'relationship',
    relationTo: 'members',
    required: true,
  },
  {
    name: 'description',
    type: 'textarea',
  },
  {
    name: 'topics',
    type: 'relationship',
    relationTo: 'topics',
    hasMany: true,
  },
  {
    name: 'coverImage',
    type: 'upload',
    relationTo: 'media',
  },
  {
    name: 'status',
    type: 'select',
    defaultValue: 'draft',
    options: [
      { label: 'Draft', value: 'draft' },
      { label: 'Proposed', value: 'proposed' },
      { label: 'Published', value: 'published' },
      { label: 'Refined', value: 'refined' },
      { label: 'Mature', value: 'mature' },
      { label: 'Deprecated', value: 'deprecated' },
      { label: 'Archived', value: 'archived' },
    ],
  },
  {
    name: 'publishedAt',
    type: 'date',
  },
  {
    name: 'reviewedAt',
    type: 'date',
  },
  {
    name: 'reviewIntervalDays',
    type: 'number',
    defaultValue: 180,
    admin: {
      description: 'Days between scheduled reviews',
    },
  },
  {
    name: 'tier',
    type: 'select',
    defaultValue: 'practitioner',
    options: [
      { label: 'Public', value: 'public' },
      { label: 'Free', value: 'free' },
      { label: 'Practitioner', value: 'practitioner' },
      { label: 'Practitioner+', value: 'practitioner-plus' },
    ],
  },
  {
    name: 'isFeatured',
    type: 'checkbox',
    defaultValue: false,
  },
  {
    name: 'stats',
    type: 'group',
    admin: {
      description: 'Aggregate statistics (auto-updated)',
    },
    fields: [
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
        name: 'contributorCount',
        type: 'number',
        defaultValue: 0,
        admin: { readOnly: true },
      },
      {
        name: 'viewCount',
        type: 'number',
        defaultValue: 0,
        admin: { readOnly: true },
      },
      {
        name: 'citationCount',
        type: 'number',
        defaultValue: 0,
        admin: { readOnly: true },
      },
    ],
  },
]

/**
 * All asset collection slugs for polymorphic relationships.
 */
export const assetCollectionSlugs = [
  'papers',
  'articles',
  'briefs',
  'tools',
  'newsletter-issues',
  'wiki-entries',
] as const
