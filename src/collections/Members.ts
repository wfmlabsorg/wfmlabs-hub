import type { CollectionConfig } from 'payload'
import {
  INDUSTRIES,
  WORKFORCE_TYPES,
  SOURCING_TYPES,
  FOOTPRINT_WORKFORCE_TYPES,
  WORK_MODELS,
  VIRTUAL_GEO_SPREAD,
  CUSTOMER_GEO_SCOPES,
  US_REGIONS,
  US_STATES,
} from '@/lib/constants/taxonomies'

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
    defaultColumns: ['displayName', 'email', 'role', 'membershipTier', 'type', 'industry', 'lastActiveAt'],
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
    // ── Identity ──────────────────────────────────────────────
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
        description:
          'Permission level. Admin: full access. Moderator: can edit/flag content. Member: standard access.',
      },
    },
    {
      name: 'membershipTier',
      type: 'select',
      defaultValue: 'free',
      options: [
        { label: 'Free', value: 'free' },
        { label: 'Trial', value: 'trial' },
        { label: 'Practitioner', value: 'practitioner' },
        { label: 'Practitioner+', value: 'practitioner-plus' },
      ],
      admin: {
        description: 'Membership tier — determines content access and features available',
      },
    },
    {
      name: 'trialExpiresAt',
      type: 'date',
      admin: {
        description: 'When trial period ends (only relevant for trial tier)',
        condition: (data) => data?.membershipTier === 'trial',
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'MMM d, yyyy',
        },
      },
    },
    {
      name: 'memberSince',
      type: 'date',
      admin: {
        description: 'When they became a paid member',
        condition: (data) =>
          data?.membershipTier === 'practitioner' || data?.membershipTier === 'practitioner-plus',
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'MMM d, yyyy',
        },
      },
    },

    // ── Tier 1: Basic Profile ─────────────────────────────────
    {
      name: 'industry',
      type: 'select',
      options: [...INDUSTRIES],
      admin: {
        description: 'Primary industry you work in',
      },
    },
    {
      name: 'workforceTypes',
      type: 'select',
      hasMany: true,
      options: [...WORKFORCE_TYPES],
      admin: {
        description: 'Types of workforce you manage or advise on',
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
    {
      name: 'profile',
      type: 'group',
      fields: [
        { name: 'title', type: 'text', admin: { description: 'e.g., VP Operations' } },
        { name: 'company', type: 'text', admin: { description: 'Optional — not displayed publicly by default' } },
        { name: 'location', type: 'text', admin: { description: 'Your city/state/country' } },
        { name: 'linkedinUrl', type: 'text' },
        { name: 'githubUsername', type: 'text' },
        { name: 'websiteUrl', type: 'text' },
      ],
    },

    // ── Expertise ─────────────────────────────────────────────
    {
      name: 'expertise',
      type: 'relationship',
      relationTo: 'topics',
      hasMany: true,
      admin: {
        description: 'Self-selected expertise topics — shown on profile and used for directory filtering',
      },
    },

    // ── Agent Metadata ────────────────────────────────────────
    {
      name: 'agentMetadata',
      type: 'group',
      admin: {
        condition: (data) => data?.type === 'agent',
        description: 'Agent profile and configuration — agents can self-update these fields via API',
      },
      fields: [
        { name: 'tagline', type: 'text', admin: { description: 'One-line description shown on profile card' } },
        { name: 'agentRole', type: 'text', admin: { description: 'e.g., Community Knowledge Agent, Incident Analyst' } },
        {
          name: 'specialization',
          type: 'select',
          options: [
            { label: 'Knowledge Scout', value: 'knowledge-scout' },
            { label: 'Incident Analyst', value: 'incident-analyst' },
            { label: 'Tool Builder', value: 'tool-builder' },
            { label: 'Content Curator', value: 'content-curator' },
            { label: 'Research Assistant', value: 'research-assistant' },
            { label: 'Operations Monitor', value: 'operations-monitor' },
            { label: 'Other', value: 'other' },
          ],
        },
        {
          name: 'cadence',
          type: 'text',
          admin: { description: 'How often this agent runs (e.g., 3x daily, hourly, on-demand)' },
        },
        {
          name: 'capabilities',
          type: 'select',
          hasMany: true,
          options: [
            { label: 'Can Post Articles', value: 'post' },
            { label: 'Can Comment', value: 'comment' },
            { label: 'Can Edit Own Posts', value: 'edit-own' },
            { label: 'Can Create Signals', value: 'signal' },
            { label: 'Can Read Wiki', value: 'read-wiki' },
            { label: 'Can Write Wiki', value: 'write-wiki' },
          ],
        },
        {
          name: 'model',
          type: 'text',
          admin: { description: 'AI model used (e.g., claude-sonnet-4-20250514)' },
        },
        {
          name: 'dataSources',
          type: 'textarea',
          admin: { description: 'What data sources this agent reads from' },
        },
        {
          name: 'personality',
          type: 'textarea',
          admin: { description: 'Agent personality description — how it communicates' },
        },
        {
          name: 'lastRunAt',
          type: 'date',
          admin: { readOnly: true, description: 'Last time this agent ran' },
        },
        {
          name: 'totalPosts',
          type: 'number',
          defaultValue: 0,
          admin: { readOnly: true },
        },
        {
          name: 'totalComments',
          type: 'number',
          defaultValue: 0,
          admin: { readOnly: true },
        },
        { name: 'mcpEndpoint', type: 'text', admin: { description: 'MCP server URL (if applicable)' } },
        { name: 'a2aCardUrl', type: 'text', admin: { description: 'Agent-to-Agent card URL' } },
        { name: 'workerUrl', type: 'text', admin: { description: 'Cloudflare Worker URL for this agent' } },
      ],
    },

    // ── Tier 2: OVIX Contributor Profile ──────────────────────
    {
      name: 'ovixProfile',
      type: 'group',
      admin: {
        description: 'OVIX Contributor Network — optional workforce and geography data for incident correlation',
        condition: (data) => data?.type === 'human',
      },
      fields: [
        {
          name: 'isOvixContributor',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              'Opt-in to the OVIX Contributor Network. As a contributor, your workforce footprint and customer geography data help OVIX agents detect and alert you about operational incidents affecting your regions and industries. Your data is only shared with OVIX intelligence agents — never displayed publicly unless you enable it in Privacy settings.',
          },
        },
        {
          name: 'isBpo',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'I am a BPO/outsourcer serving multiple clients across industries',
            condition: (data) => data?.ovixProfile?.isOvixContributor === true,
          },
        },
        {
          name: 'clientIndustries',
          type: 'select',
          hasMany: true,
          options: [...INDUSTRIES],
          admin: {
            description: 'Industries of the clients you serve (BPO/outsourcers only)',
            condition: (data) =>
              data?.ovixProfile?.isOvixContributor === true && data?.ovixProfile?.isBpo === true,
          },
        },

        // Supply-side: where is your workforce?
        {
          name: 'workforceFootprint',
          type: 'array',
          admin: {
            description: 'Workforce locations — helps OVIX agents alert you about regional incidents',
            condition: (data) => data?.ovixProfile?.isOvixContributor === true,
          },
          fields: [
            {
              name: 'city',
              type: 'text',
              admin: { description: 'e.g., Omaha' },
            },
            {
              name: 'stateProvince',
              type: 'text',
              admin: { description: 'e.g., NE or Ontario' },
            },
            {
              name: 'country',
              type: 'text',
              required: true,
              defaultValue: 'US',
              admin: { description: 'e.g., US, PH, CR' },
            },
            {
              name: 'headcount',
              type: 'number',
              min: 1,
              admin: { description: 'Number of workers at this location' },
            },
            {
              name: 'sourcing',
              type: 'select',
              options: [...SOURCING_TYPES],
              admin: { description: 'In-house employees or BPO vendor staff' },
            },
            {
              name: 'workforceType',
              type: 'select',
              options: [...FOOTPRINT_WORKFORCE_TYPES],
            },
            {
              name: 'workModel',
              type: 'select',
              options: [...WORK_MODELS],
              defaultValue: 'in-office',
              admin: { description: 'In-Office, Hybrid, or Virtual/Remote' },
            },
            {
              name: 'geoSpread',
              type: 'select',
              options: [...VIRTUAL_GEO_SPREAD],
              admin: {
                description: 'How geographically spread is this virtual workforce?',
                condition: (data, siblingData) => siblingData?.workModel === 'virtual' || siblingData?.workModel === 'hybrid',
              },
            },
          ],
        },

        // Demand-side: where are your customers?
        {
          name: 'customerGeography',
          type: 'group',
          admin: {
            description: 'Where your customers or clients are located',
            condition: (data) => data?.ovixProfile?.isOvixContributor === true,
          },
          fields: [
            {
              name: 'scope',
              type: 'select',
              options: [...CUSTOMER_GEO_SCOPES],
              admin: { description: 'Geographic scope of your customer base' },
            },
            {
              name: 'usRegions',
              type: 'select',
              hasMany: true,
              options: [...US_REGIONS],
              admin: {
                description: 'Which US regions you serve',
                condition: (data) =>
                  data?.ovixProfile?.customerGeography?.scope === 'regional-us',
              },
            },
            {
              name: 'usState',
              type: 'select',
              options: [...US_STATES],
              admin: {
                description: 'Which state you serve',
                condition: (data) =>
                  data?.ovixProfile?.customerGeography?.scope === 'single-state',
              },
            },
            {
              name: 'euCountries',
              type: 'text',
              admin: {
                description: 'EU countries served (comma-separated, e.g., DE, FR, ES)',
                condition: (data) =>
                  data?.ovixProfile?.customerGeography?.scope === 'eu',
              },
            },
            {
              name: 'internationalRegions',
              type: 'text',
              admin: {
                description: 'Countries or regions served (comma-separated)',
                condition: (data) =>
                  data?.ovixProfile?.customerGeography?.scope === 'international',
              },
            },
          ],
        },
      ],
    },

    // ── Visibility / Privacy ──────────────────────────────────
    {
      name: 'visibility',
      type: 'group',
      admin: { description: 'Control what other members can see on your profile' },
      fields: [
        {
          name: 'showProfessional',
          type: 'checkbox',
          defaultValue: true,
          admin: { description: 'Show title, location' },
        },
        {
          name: 'showIndustry',
          type: 'checkbox',
          defaultValue: true,
          admin: { description: 'Show industry and workforce types' },
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
        {
          name: 'showOvixData',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Show OVIX contributor data (workforce footprint, customer geography) to other members' },
        },
      ],
    },

    // ── Cross-Platform ────────────────────────────────────────
    {
      name: 'rocUserId',
      type: 'number',
      index: true,
      admin: {
        readOnly: true,
        description: 'Linked ROC/OVIX user ID — set during migration or first cross-platform login',
        position: 'sidebar',
      },
    },

    // ── Admin Fields ──────────────────────────────────────────
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
