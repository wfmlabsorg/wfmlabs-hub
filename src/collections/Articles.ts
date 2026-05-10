import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { isMember } from '@/access/isMember'
import { isAuthor } from '@/access/isAuthor'

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
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'members',
      required: true,
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
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'topics',
      type: 'relationship',
      relationTo: 'topics',
      hasMany: true,
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
  ],
  access: {
    read: isMember,
    create: isAdmin,
    update: isAuthor('author'),
    delete: isAdmin,
  },
}
