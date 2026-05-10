import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { isMember } from '@/access/isMember'
import { baseAssetFields } from './_baseAssetFields'

export const NewsletterIssues: CollectionConfig = {
  slug: 'newsletter-issues',
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
    // Newsletter-specific fields
    {
      name: 'issueNumber',
      type: 'number',
      required: true,
      unique: true,
    },
    {
      name: 'publishDate',
      type: 'date',
      required: true,
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
    },
    {
      name: 'summary',
      type: 'textarea',
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'members',
    },
  ],
  access: {
    read: isMember,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
}
