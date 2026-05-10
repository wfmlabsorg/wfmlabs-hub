import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { isMember } from '@/access/isMember'
import { isAuthor } from '@/access/isAuthor'
import { baseAssetFields, assetCollectionSlugs } from './_baseAssetFields'

export const WikiEntries: CollectionConfig = {
  slug: 'wiki-entries',
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
    // Wiki-specific fields
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Concept', value: 'concept' },
        { label: 'Process', value: 'process' },
        { label: 'Metric', value: 'metric' },
        { label: 'Technology', value: 'technology' },
        { label: 'Framework', value: 'framework' },
        { label: 'Role', value: 'role' },
        { label: 'Glossary', value: 'glossary' },
      ],
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
    },
    {
      name: 'relatedEntries',
      type: 'relationship',
      relationTo: 'wiki-entries',
      hasMany: true,
    },
    {
      name: 'definedTerms',
      type: 'array',
      fields: [
        {
          name: 'term',
          type: 'text',
          required: true,
        },
        {
          name: 'definition',
          type: 'textarea',
          required: true,
        },
      ],
    },
    {
      name: 'sources',
      type: 'array',
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
        },
        {
          name: 'url',
          type: 'text',
        },
        {
          name: 'note',
          type: 'textarea',
        },
      ],
    },
    {
      name: 'seeAlso',
      type: 'relationship',
      relationTo: [...assetCollectionSlugs],
      hasMany: true,
    },
  ],
  access: {
    read: isMember,
    create: isAdmin,
    update: isAuthor('primaryContributor'),
    delete: isAdmin,
  },
}
