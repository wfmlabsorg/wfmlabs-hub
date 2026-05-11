import type { CollectionConfig } from 'payload'

export const Members: CollectionConfig = {
  slug: 'members',
  auth: true,
  admin: {
    useAsTitle: 'displayName',
  },
  fields: [
    {
      name: 'displayName',
      type: 'text',
      required: true,
    },
    {
      name: 'username',
      type: 'text',
      required: true,
      unique: true,
      validate: (value: string | null | undefined) => {
        if (!value) return 'Username is required'
        if (!/^[a-z0-9-]{3,30}$/.test(value))
          return 'Username must be 3-30 characters, lowercase letters, numbers, and hyphens only'
        return true
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'human',
      options: [
        { label: 'Human', value: 'human' },
        { label: 'Agent', value: 'agent' },
        { label: 'Admin', value: 'admin' },
      ],
    },
    {
      name: 'bio',
      type: 'textarea',
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'foundingMember',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'First 100 paid members — grants lifetime locked pricing',
      },
    },
    {
      name: 'lastActiveAt',
      type: 'date',
      admin: { readOnly: true },
    },
  ],
}
