import type { CollectionConfig } from 'payload'

export const Signals: CollectionConfig = {
  slug: 'signals',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'signalType', 'source', 'severity', 'regionId', 'createdAt'],
  },
  access: {
    // Anyone can read signals
    read: () => true,
    // Only admins and API key can create
    create: ({ req: { user } }) => user?.role === 'admin',
    // Only admins can update/delete
    update: ({ req: { user } }) => user?.role === 'admin',
    delete: ({ req: { user } }) => user?.role === 'admin',
  },
  fields: [
    {
      name: 'signalType',
      type: 'select',
      required: true,
      options: [
        { label: 'AI Agent', value: 'ai' },
        { label: 'System Alert', value: 'alert' },
        { label: 'OVIX Score', value: 'ovix' },
        { label: 'Member Observation', value: 'member' },
      ],
      admin: { description: 'Source type — AI-generated, system alert, OVIX scoring event, or member-submitted' },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: { description: 'Short title for the signal' },
    },
    {
      name: 'message',
      type: 'textarea',
      required: true,
      admin: { description: 'Full signal message' },
    },
    {
      name: 'source',
      type: 'text',
      required: true,
      admin: { description: 'Origin agent or system (e.g., ovix-weather, ovix-seismic, member)' },
    },
    {
      name: 'severity',
      type: 'number',
      min: 0,
      max: 10,
      admin: { description: 'Severity score 0-10 (from OVIX scoring)' },
    },
    {
      name: 'severityLabel',
      type: 'select',
      options: [
        { label: 'Info', value: 'info' },
        { label: 'Moderate', value: 'moderate' },
        { label: 'Severe', value: 'severe' },
        { label: 'Extreme', value: 'extreme' },
      ],
    },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Weather', value: 'weather' },
        { label: 'Seismic', value: 'seismic' },
        { label: 'Disaster', value: 'disaster' },
        { label: 'Events', value: 'events' },
        { label: 'Cyber', value: 'cyber' },
        { label: 'Infrastructure', value: 'infrastructure' },
        { label: 'Health', value: 'health' },
        { label: 'Financial', value: 'financial' },
        { label: 'General', value: 'general' },
      ],
      admin: { description: 'OVIX category this signal relates to' },
    },
    {
      name: 'regionId',
      type: 'text',
      admin: { description: 'OVIX region ID (e.g., us-southeast, philippines)' },
    },
    {
      name: 'regionName',
      type: 'text',
      admin: { description: 'Human-readable region name' },
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'members',
      admin: { description: 'Member who submitted (for member-type signals)' },
    },
    {
      name: 'sourceUrl',
      type: 'text',
      admin: { description: 'Link to source data or event detail' },
    },
    {
      name: 'metadata',
      type: 'json',
      admin: { description: 'Additional structured data (scores, coordinates, raw event data)' },
    },
  ],
}
