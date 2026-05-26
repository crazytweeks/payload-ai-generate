import type { CollectionConfig } from 'payload';
import type { AIPluginOptions } from '../ai-types';
import { aiComposerCollectionSlug, aiPresetCollectionSlug } from './constants';

export const buildAIComposerCollection = (pluginOptions: AIPluginOptions): CollectionConfig => ({
  slug: aiComposerCollectionSlug,
  admin: {
    group: 'AI',
    useAsTitle: 'title',
    defaultColumns: ['title', 'updatedAt'],
    description: 'AI Composer sessions — plan and generate UI blocks through conversation.',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'firstPrompt',
      type: 'textarea',
      required: true,
      admin: {
        rows: 5,
        description: 'The initial prompt that starts this composition session.',
      },
    },
    {
      name: 'preset',
      type: 'relationship',
      relationTo: aiPresetCollectionSlug,
      admin: {
        description: 'Optional AI preset defining model, provider, and system prompt.',
        position: 'sidebar',
      },
    },
    {
      name: 'referenceCollections',
      type: 'array',
      admin: {
        description: 'Reference collection queries injected into the AI context.',
        condition: () => Object.keys(pluginOptions.referenceCollections ?? {}).length > 0,
      },
      fields: [
        {
          name: 'collection',
          type: 'select',
          required: true,
          options: Object.entries(pluginOptions.referenceCollections ?? {})
            .filter(([, enabled]) => enabled)
            .map(([slug]) => ({ label: slug, value: slug })),
        },
        {
          name: 'isBeingUsed',
          type: 'checkbox',
          defaultValue: true,
        },
        {
          name: 'limit',
          type: 'number',
          defaultValue: 10,
          min: 1,
        },
        {
          name: 'dataLoading',
          type: 'select',
          defaultValue: 'server',
          required: true,
          options: [
            { label: 'Server', value: 'server' },
            { label: 'Client', value: 'client' },
          ],
        },
        {
          name: 'filtersJSON',
          type: 'code',
          admin: { language: 'json' },
        },
      ],
    },
    {
      name: 'messages',
      type: 'json',
      defaultValue: [],
      admin: { hidden: true, readOnly: true },
    },
    {
      name: 'plan',
      type: 'json',
      admin: { hidden: true, readOnly: true },
    },
  ],
});
