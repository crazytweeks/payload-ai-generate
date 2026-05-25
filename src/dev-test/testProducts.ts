import type { CollectionConfig } from 'payload';

export const testProductsCollectionSlug = 'test-products';

export const buildTestProductsCollection = (): CollectionConfig => ({
  slug: testProductsCollectionSlug,
  labels: {
    singular: 'Test Product',
    plural: 'Test Products',
  },
  admin: {
    defaultColumns: ['name', 'category', 'price', 'isPublished', 'updatedAt'],
    group: 'AI Dev',
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'sku',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'summary',
      type: 'textarea',
      required: true,
    },
    {
      name: 'category',
      type: 'select',
      defaultValue: 'software',
      options: [
        {
          label: 'Software',
          value: 'software',
        },
        {
          label: 'Service',
          value: 'service',
        },
        {
          label: 'Template',
          value: 'template',
        },
      ],
      required: true,
    },
    {
      name: 'price',
      type: 'number',
      min: 0,
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
