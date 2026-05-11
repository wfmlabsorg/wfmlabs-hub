import type { CollectionConfig } from 'payload'

// Admin emails — these get auto-promoted on login/creation
export const ADMIN_EMAILS = [
  'tedlango@gmail.com',
  'ted@kyodosolutions.com',
  'ted@roc.cloud',
  'ted@wfmlabs.com',
]

export const Members: CollectionConfig = {
  slug: 'members',
  auth: true,
  admin: {
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'email', 'role', 'type', 'lastActiveAt'],
  },
  access: {
    // Anyone can read member profiles
    read: () => true,
    // Only admins can create members directly (OAuth auto-creates)
    create: ({ req: { user } }) => user?.role === 'admin',
    // Members can update their own profile, admins can update anyone
    update: ({ req: { user }, id }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return user.id === id
    },
    // Only admins can delete
    delete: ({ req: { user } }) => user?.role === 'admin',
    // Only admins can access the admin panel
    admin: ({ req: { user } }) => user?.role === 'admin',
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
      ],
      admin: {
        description: 'Entity type — human practitioner or AI agent',
      },
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'member',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Moderator', value: 'moderator' },
        { label: 'Member', value: 'member' },
      ],
      admin: {
        description: 'Permission level. Admin: full access. Moderator: can edit/flag content. Member: standard access.',
      },
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
    // Profile fields
    {
      name: 'profile',
      type: 'group',
      fields: [
        { name: 'title', type: 'text', admin: { description: 'e.g., VP Operations' } },
        { name: 'company', type: 'text' },
        { name: 'location', type: 'text' },
        { name: 'linkedinUrl', type: 'text' },
        { name: 'githubUsername', type: 'text' },
        { name: 'websiteUrl', type: 'text' },
      ],
    },
    // Agent-specific metadata
    {
      name: 'agentMetadata',
      type: 'group',
      admin: {
        condition: (data) => data?.type === 'agent',
        description: 'Agent-specific configuration',
      },
      fields: [
        { name: 'tagline', type: 'text' },
        { name: 'agentRole', type: 'text', admin: { description: 'e.g., Research Librarian' } },
        { name: 'mcpEndpoint', type: 'text' },
        { name: 'a2aCardUrl', type: 'text' },
      ],
    },
    {
      name: 'expertise',
      type: 'relationship',
      relationTo: 'topics',
      hasMany: true,
      admin: { description: 'Self-selected expertise topics — shown on profile and used for directory filtering' },
    },
    {
      name: 'visibility',
      type: 'group',
      admin: { description: 'Control what other members can see on your profile' },
      fields: [
        {
          name: 'showProfessional',
          type: 'checkbox',
          defaultValue: true,
          admin: { description: 'Show title, company, location' },
        },
        {
          name: 'showBio',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'showLinks',
          type: 'checkbox',
          defaultValue: true,
          admin: { description: 'Show LinkedIn, GitHub, website' },
        },
        {
          name: 'showInDirectory',
          type: 'checkbox',
          defaultValue: true,
          admin: { description: 'Appear in the member directory' },
        },
        {
          name: 'showEmail',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Show email to other members' },
        },
      ],
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
