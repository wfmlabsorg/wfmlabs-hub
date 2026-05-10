import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { isMember } from '@/access/isMember'
import { assetCollectionSlugs } from './_baseAssetFields'

export const AssetVersions: CollectionConfig = {
  slug: 'asset-versions',
  fields: [
    {
      name: 'asset',
      type: 'relationship',
      relationTo: [...assetCollectionSlugs],
      required: true,
    },
    {
      name: 'versionNumber',
      type: 'text',
      required: true,
    },
    {
      name: 'changedBy',
      type: 'relationship',
      relationTo: 'members',
      required: true,
    },
    {
      name: 'changeDescription',
      type: 'textarea',
    },
    {
      name: 'snapshot',
      type: 'json',
    },
    {
      name: 'changeType',
      type: 'select',
      options: [
        { label: 'Create', value: 'create' },
        { label: 'Update', value: 'update' },
        { label: 'Status Change', value: 'status-change' },
        { label: 'Major Revision', value: 'major-revision' },
        { label: 'Minor Edit', value: 'minor-edit' },
      ],
    },
  ],
  access: {
    read: isMember,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
}
