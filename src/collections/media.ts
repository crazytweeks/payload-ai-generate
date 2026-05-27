import type { CollectionConfig } from 'payload';
import { aiMediaCollectionSlug } from './constants';

export const buildAIMediaCollection = (): CollectionConfig => ({
  slug: aiMediaCollectionSlug,
  admin: {
    group: 'AI',
    useAsTitle: 'alt',
    description: 'Media and documents specifically for AI reference and composition.',
  },
  access: {
    read: () => true,
  },
  upload: {
    staticDir: 'media/ai',
    mimeTypes: ['image/*', 'application/pdf', 'text/*'],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Description of the media file (used as context for AI).',
      },
    },
  ],
});
