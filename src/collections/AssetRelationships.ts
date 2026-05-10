import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { isMember } from '@/access/isMember'
import { assetCollectionSlugs } from './_baseAssetFields'

export const AssetRelationships: CollectionConfig = {
  slug: 'asset-relationships',
  fields: [
    {
      name: 'fromAsset',
      type: 'relationship',
      relationTo: [...assetCollectionSlugs],
      required: true,
    },
    {
      name: 'toAsset',
      type: 'relationship',
      relationTo: [...assetCollectionSlugs],
      required: true,
    },
    {
      name: 'relationshipType',
      type: 'select',
      required: true,
      options: [
        { label: 'Cites', value: 'cites' },
        { label: 'Implements', value: 'implements' },
        { label: 'Documents', value: 'documents' },
        { label: 'Critiques', value: 'critiques' },
        { label: 'Extends', value: 'extends' },
        { label: 'Supersedes', value: 'supersedes' },
        { label: 'Requires', value: 'requires' },
        { label: 'Related To', value: 'related-to' },
        { label: 'Derived From', value: 'derived-from' },
        { label: 'Mentions', value: 'mentions' },
      ],
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'members',
    },
    {
      name: 'note',
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
