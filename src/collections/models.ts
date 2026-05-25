import type { CollectionConfig, Payload } from 'payload';
import { models } from '../models';
import { aiModelsOptionsCollectionSlug } from './constants';
import {
  type AIModelDoc,
  type AIProvider,
  ensureFallbackDefaultForProvider,
  ensureSingleDefaultPerProvider,
  getModelEntries,
  providerOptions,
} from './shared';

/**
 * Synchronizes the stored model registry collection with the generated package model list.
 */
export const syncAIModelsCollection = async (payload: Payload) => {
  const expectedEntries = getModelEntries();
  const existing = await payload.find({
    collection: aiModelsOptionsCollectionSlug,
    depth: 0,
    limit: 5000,
    overrideAccess: true,
  });

  const existingByKey = new Map<string, AIModelDoc>(
    existing.docs.map((doc) => [`${doc.provider}:${doc.modelId}`, doc as AIModelDoc])
  );
  const expectedKeys = new Set(expectedEntries.map((entry) => entry.id));

  for (const entry of expectedEntries) {
    const current = existingByKey.get(entry.id);

    if (!current) {
      await payload.create({
        collection: aiModelsOptionsCollectionSlug,
        data: {
          isDefault:
            entry.modelId === (entry.provider === 'google' ? 'gemini-2.5-flash' : 'gpt-4o-mini'),
          isEnabled: true,
          isRemoved: false,
          modelId: entry.modelId,
          name: entry.modelId,
          provider: entry.provider,
        },
        overrideAccess: true,
      });
      continue;
    }

    const nextPatch: Partial<AIModelDoc> = {};

    if (current.name !== entry.modelId) {
      nextPatch.name = entry.modelId;
    }

    if (current.isRemoved) {
      nextPatch.isRemoved = false;
    }

    if (Object.keys(nextPatch).length > 0) {
      const cleanPatch = Object.fromEntries(
        Object.entries(nextPatch).filter(([, v]) => v !== undefined && v !== null)
      ) as any;

      await payload.update({
        collection: aiModelsOptionsCollectionSlug,
        id: current.id,
        data: cleanPatch,
        overrideAccess: true,
      });
    }
  }

  for (const doc of existing.docs) {
    const key = `${doc.provider}:${doc.modelId}`;

    if (expectedKeys.has(key)) {
      continue;
    }

    await payload.update({
      collection: aiModelsOptionsCollectionSlug,
      id: doc.id,
      data: {
        isDefault: false,
        isEnabled: false,
        isRemoved: true,
      },
      overrideAccess: true,
    });
  }

  for (const provider of Object.keys(models) as AIProvider[]) {
    await ensureFallbackDefaultForProvider(payload, provider);
  }
};

/**
 * Builds the collection that stores selectable AI models for presets.
 */
export const buildAIModelsCollection = (): CollectionConfig => ({
  slug: aiModelsOptionsCollectionSlug,
  admin: {
    group: 'AI',
    defaultColumns: ['name', 'provider', 'isDefault', 'isEnabled', 'isDeprecated', 'isRemoved'],
    useAsTitle: 'name',
    description:
      'Registry of package-supported AI models. Synced automatically on init and used by AI presets.',
  },
  labels: {
    singular: 'AI Model',
    plural: 'AI Models',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'provider',
      type: 'select',
      options: providerOptions,
      required: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'modelId',
      type: 'text',
      required: true,
      index: true,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'isDeprecated',
      type: 'checkbox',
      admin: {
        description:
          'If true, this model will still be available for selection in AI presets, but it will be marked as deprecated in the admin UI.',
      },
      defaultValue: false,
    },
    {
      name: 'isRemoved',
      type: 'checkbox',
      admin: {
        description:
          'Marked automatically when a model is no longer present in the package-supported model list.',
        readOnly: true,
      },
      defaultValue: false,
    },
    {
      name: 'isDefault',
      type: 'checkbox',
      admin: {
        description:
          'If true, this model will be used as the default for its provider when no model is explicitly selected in an AI preset.',
      },
      defaultValue: false,
    },
    {
      name: 'isEnabled',
      type: 'checkbox',
      admin: {
        description:
          'If false, this model will not be available for selection in AI presets, but existing presets using it will continue to work.',
      },
      defaultValue: true,
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, originalDoc }) => {
        const nextData = { ...data };
        const isDeprecated = nextData.isDeprecated ?? originalDoc?.isDeprecated ?? false;
        const isRemoved = nextData.isRemoved ?? originalDoc?.isRemoved ?? false;
        const isEnabled = nextData.isEnabled ?? originalDoc?.isEnabled ?? true;
        const isDefault = nextData.isDefault ?? originalDoc?.isDefault ?? false;

        if (isRemoved) {
          nextData.isEnabled = false;
          nextData.isDefault = false;
        }

        if (isDefault && (isDeprecated || isRemoved || !isEnabled)) {
          throw new Error(
            'Only enabled, non-deprecated, non-removed models can be marked as default.'
          );
        }

        return nextData;
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        await ensureSingleDefaultPerProvider(req.payload, doc as AIModelDoc);

        const current = doc as AIModelDoc;
        const previous = previousDoc as AIModelDoc;
        const defaultBecameInvalid =
          previous?.isDefault &&
          (!current.isDefault || !current.isEnabled || current.isDeprecated || current.isRemoved);

        if (defaultBecameInvalid) {
          await ensureFallbackDefaultForProvider(req.payload, current.provider);
        }

        return doc;
      },
    ],
  },
  timestamps: true,
});
