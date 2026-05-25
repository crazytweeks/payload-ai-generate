import type { CollectionConfig } from 'payload';

export const testMessagesCollectionSlug = 'test-messages';

export const buildTestMessagesCollection = (): CollectionConfig => ({
  slug: testMessagesCollectionSlug,
  labels: {
    singular: 'Test Message',
    plural: 'Test Messages',
  },
  admin: {
    defaultColumns: ['title', 'category', 'isPublished', 'updatedAt'],
    group: 'AI Dev',
    useAsTitle: 'title',
  },
  fields: [
    {
      name: 'key',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'body',
      type: 'textarea',
      required: true,
    },
    {
      name: 'category',
      type: 'select',
      defaultValue: 'general',
      options: [
        {
          label: 'General',
          value: 'general',
        },
        {
          label: 'Product',
          value: 'product',
        },
        {
          label: 'Support',
          value: 'support',
        },
      ],
      required: true,
    },
    {
      name: 'author',
      type: 'text',
      required: true,
    },
    {
      name: 'priority',
      type: 'number',
      defaultValue: 1,
      min: 1,
      max: 5,
      required: true,
    },
    {
      name: 'isPublished',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
  timestamps: true,
});
