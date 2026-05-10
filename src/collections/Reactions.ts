import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { isMember } from '@/access/isMember'
import { isAuthor } from '@/access/isAuthor'
import { assetCollectionSlugs } from './_baseAssetFields'

export const Reactions: CollectionConfig = {
  slug: 'reactions',
  fields: [
    {
      name: 'target',
      type: 'relationship',
      relationTo: [...assetCollectionSlugs, 'discussions'],
      required: true,
    },
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'members',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Like', value: 'like' },
        { label: 'Insightful', value: 'insightful' },
        { label: 'Practical', value: 'practical' },
        { label: 'Question', value: 'question' },
      ],
    },
  ],
  access: {
    read: isMember,
    create: isMember,
    update: isAuthor('member'),
    delete: isAuthor('member'),
  },
}
