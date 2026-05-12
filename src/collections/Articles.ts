import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { isMember } from '@/access/isMember'
import { isAuthor } from '@/access/isAuthor'
import { baseAssetFields } from './_baseAssetFields'

export const Articles: CollectionConfig = {
  slug: 'articles',
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
      name: 'category',
      type: 'select',
      options: [
        { label: 'Think Tank', value: 'think-tank' },
        { label: 'Topic Surface', value: 'topic-surface' },
        { label: 'Wiki Highlight', value: 'wiki-highlight' },
        { label: 'Research Finding', value: 'research-finding' },
        { label: 'Opinion', value: 'opinion' },
        { label: 'Tutorial', value: 'tutorial' },
        { label: 'Industry Analysis', value: 'industry-analysis' },
      ],
    },
    ...baseAssetFields,
    // Article-specific fields
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'members',
      admin: {
        description: 'Original author (primaryContributor is the curator)',
      },
    },
    {
      name: 'publishDate',
      type: 'date',
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
    },
    {
      name: 'excerpt',
      type: 'textarea',
    },
  ],
  access: {
    read: isMember,
    create: isAdmin,
    update: isAuthor('primaryContributor'),
    delete: isAdmin,
  },
}
