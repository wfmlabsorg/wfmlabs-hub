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
        { label: 'Calculator', value: 'calculator' },
        { label: 'Analyzer', value: 'analyzer' },
        { label: 'Simulator', value: 'simulator' },
        { label: 'Model', value: 'model' },
        { label: 'Methodology', value: 'methodology' },
      ],
      admin: {
        description: 'Tool type: Calculator (input→answer), Analyzer (data→insight), Simulator (scenarios), Model (strategic framework), Methodology (practice/technique)',
      },
    },
    {
      name: 'domain',
      type: 'select',
      options: [
        { label: 'Staffing & Capacity', value: 'staffing-capacity' },
        { label: 'Forecasting & Accuracy', value: 'forecasting-accuracy' },
        { label: 'Workforce Economics', value: 'workforce-economics' },
        { label: 'Operations & Routing', value: 'operations-routing' },
        { label: 'Measurement & Analytics', value: 'measurement-analytics' },
      ],
      admin: {
        description: 'WFM domain this tool serves',
      },
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
    read: () => true,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
}
