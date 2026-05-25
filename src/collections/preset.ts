import type { CollectionConfig, Where } from 'payload';
import { aiModelsOptionsCollectionSlug, aiPresetCollectionSlug } from './constants';
import { providerOptions } from './shared';

/**
 * Builds reusable AI presets containing provider, model, and system prompt defaults.
 */
export const buildAIPresetCollection = (): CollectionConfig => ({
  slug: aiPresetCollectionSlug,
  admin: {
    defaultColumns: ['title', 'provider', 'model'],
    useAsTitle: 'title',
    group: 'AI',
    description:
      'Reusable AI presets that can be linked to from AI prompts. Define the system prompt, provider, and model to use.',
  },
  labels: {
    singular: 'AI Preset',
    plural: 'AI Presets',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'systemPrompt',
      type: 'textarea',
      admin: {
        description:
          'This instruction is prepended before the ad-hoc request from the AI composer.',
        rows: 8,
      },
      required: true,
    },
    {
      defaultValue: 'google',
      name: 'provider',
      required: true,
      type: 'select',
      options: providerOptions,
    },
    {
      admin: {
        description:
          'Optional explicit model. Leave empty to use the plugin default for the selected provider.',
      },
      name: 'model',
      type: 'relationship',
      relationTo: aiModelsOptionsCollectionSlug,
      filterOptions: ({ siblingData }) => {
        const provider = (siblingData as { provider?: string } | undefined)?.provider;
        const where: Where[] = [];

        where.push({
          isEnabled: {
            equals: true,
          },
        } as Where);

        where.push({
          isRemoved: {
            not_equals: true,
          },
        } as Where);

        if (provider) {
          where.unshift({
            provider: {
              equals: provider,
            },
          } as Where);
        }

        return {
          and: where,
        };
      },
    },
  ],
  timestamps: true,
});
