import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { isMember } from '@/access/isMember'
import { assetCollectionSlugs } from './_baseAssetFields'

export const AssetContributions: CollectionConfig = {
  slug: 'asset-contributions',
  fields: [
    {
      name: 'asset',
      type: 'relationship',
      relationTo: [...assetCollectionSlugs],
      required: true,
    },
    {
      name: 'contributor',
      type: 'relationship',
      relationTo: 'members',
      required: true,
    },
    {
      name: 'contributionType',
      type: 'select',
      required: true,
      options: [
        { label: 'Primary Author', value: 'primary-author' },
        { label: 'Co-Author', value: 'co-author' },
        { label: 'Editor', value: 'editor' },
        { label: 'Reviewer', value: 'reviewer' },
        { label: 'Curator', value: 'curator' },
        { label: 'Updater', value: 'updater' },
      ],
    },
    {
      name: 'contributedAt',
      type: 'date',
    },
    {
      name: 'contributionNote',
      type: 'textarea',
    },
  ],
  access: {
    read: isMember,
    create: isMember,
    update: isAdmin,
    delete: isAdmin,
  },
}
