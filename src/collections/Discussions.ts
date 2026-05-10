import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { isMember } from '@/access/isMember'
import { isAuthor } from '@/access/isAuthor'
import { assetCollectionSlugs } from './_baseAssetFields'

export const Discussions: CollectionConfig = {
  slug: 'discussions',
  fields: [
    {
      name: 'asset',
      type: 'relationship',
      relationTo: [...assetCollectionSlugs],
      required: true,
    },
    {
      name: 'parentDiscussion',
      type: 'relationship',
      relationTo: 'discussions',
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'members',
      required: true,
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
    },
    {
      name: 'isResolved',
      type: 'checkbox',
      defaultValue: false,
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
    create: isMember,
    update: isAuthor('author'),
    delete: isAdmin,
  },
}
