import type { CollectionConfig } from 'payload'

export const Topics: CollectionConfig = {
  slug: 'topics',
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
    },
    {
      name: 'parentTopic',
      type: 'relationship',
      relationTo: 'topics',
    },
    {
      name: 'isFeatured',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
}
