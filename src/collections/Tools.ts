import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { isMember } from '@/access/isMember'
import { baseAssetFields } from './_baseAssetFields'

export const Tools: CollectionConfig = {
  slug: 'tools',
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Display name of the tool',
      },
    },
    ...baseAssetFields,
    // Tool-specific fields
    {
      name: 'embedUrl',
      type: 'text',
      admin: {
        description: 'URL of the live tool (e.g., montecarlo.wfmlabs.com)',
      },
    },
    {
      name: 'sourceCodeUrl',
      type: 'text',
      admin: {
        description: 'GitHub repo URL if open source',
      },
    },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Capacity Planning', value: 'capacity-planning' },
        { label: 'Forecasting', value: 'forecasting' },
        { label: 'Scheduling', value: 'scheduling' },
        { label: 'Analytics', value: 'analytics' },
        { label: 'Value Planning', value: 'value-planning' },
        { label: 'Staffing', value: 'staffing' },
      ],
    },
    {
      name: 'methodology',
      type: 'richText',
      admin: {
        description: 'How practitioners use this tool — the value narrative',
      },
    },
    {
      name: 'version',
      type: 'text',
    },
  ],
  access: {
    read: isMember,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
}
