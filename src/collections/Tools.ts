import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { isMember } from '@/access/isMember'

export const Tools: CollectionConfig = {
  slug: 'tools',
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
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
      name: 'description',
      type: 'textarea',
      required: true,
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
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'members',
    },
    {
      name: 'version',
      type: 'text',
    },
    {
      name: 'methodology',
      type: 'richText',
      admin: {
        description: 'How practitioners use this tool — the value narrative',
      },
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
    update: isAdmin,
    delete: isAdmin,
  },
}
