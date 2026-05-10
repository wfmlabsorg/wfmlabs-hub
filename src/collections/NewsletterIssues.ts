import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { isMember } from '@/access/isMember'

export const NewsletterIssues: CollectionConfig = {
  slug: 'newsletter-issues',
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'issueNumber',
      type: 'number',
      required: true,
      unique: true,
    },
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
      name: 'publishDate',
      type: 'date',
      required: true,
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'members',
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'summary',
      type: 'textarea',
    },
    {
      name: 'topics',
      type: 'relationship',
      relationTo: 'topics',
      hasMany: true,
    },
  ],
  access: {
    read: isMember,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
}
