import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/access/isAdmin'
import { isMember } from '@/access/isMember'

export const Docs: CollectionConfig = {
  slug: 'docs',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'section', 'status', 'lastSyncedAt'],
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Architecture', value: 'architecture' },
        { label: 'Section', value: 'section' },
        { label: 'Stream', value: 'stream' },
        { label: 'Decision', value: 'decision' },
        { label: 'Agent', value: 'agent' },
      ],
    },
    {
      name: 'section',
      type: 'relationship',
      relationTo: 'docs',
      admin: {
        description: 'Parent section doc (for type=stream or type=decision)',
        condition: (data) => data?.type !== 'architecture',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Active', value: 'active' },
        { label: 'Completed', value: 'completed' },
        { label: 'Archived', value: 'archived' },
      ],
    },
    {
      name: 'streamId',
      type: 'text',
      admin: {
        description: 'Matches stream spec ID (for type=stream)',
        condition: (data) => data?.type === 'stream',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'body',
      type: 'richText',
    },
    {
      name: 'dependencies',
      type: 'relationship',
      relationTo: 'docs',
      hasMany: true,
      admin: {
        description: 'Other docs this depends on',
      },
    },
    {
      name: 'conductorSession',
      type: 'text',
      admin: {
        description: 'CONDUCTOR tmux session working this stream (for type=stream, in-flight)',
        condition: (data) => data?.type === 'stream',
      },
    },
    {
      name: 'lastSyncedAt',
      type: 'date',
      admin: {
        description: 'Last heartbeat from build child or FOREMAN sync',
      },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'members',
      admin: {
        description: 'Who created this — Ted, a build child, or an agent',
      },
    },
  ],
  access: {
    read: isMember,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
}
