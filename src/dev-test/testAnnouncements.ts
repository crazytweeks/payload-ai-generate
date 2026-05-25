import type { CollectionConfig } from 'payload';

export const testAnnouncementsCollectionSlug = 'test-announcements';

export const buildTestAnnouncementsCollection = (): CollectionConfig => ({
  slug: testAnnouncementsCollectionSlug,
  labels: {
    singular: 'Test Announcement',
    plural: 'Test Announcements',
  },
  admin: {
    defaultColumns: ['headline', 'audience', 'startsAt', 'isPublished', 'updatedAt'],
    group: 'AI Dev',
    useAsTitle: 'headline',
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
      name: 'headline',
      type: 'text',
      required: true,
    },
    {
      name: 'summary',
      type: 'textarea',
      required: true,
    },
    {
      name: 'audience',
      type: 'select',
      defaultValue: 'all',
      options: [
        {
          label: 'All',
          value: 'all',
        },
        {
          label: 'Customers',
          value: 'customers',
        },
        {
          label: 'Internal',
          value: 'internal',
        },
      ],
      required: true,
    },
    {
      name: 'startsAt',
      type: 'date',
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
