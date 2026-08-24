import type { CollectionConfig, Payload } from 'payload';
import { models } from '../models';
import { fetchOpenRouterModels, type OpenRouterModel } from '../openrouter';
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
 * Synchronizes the OpenRouter half of the registry from its live catalogue.
 *
 * Differs from the static sync above in two ways that matter:
 *   - the source is an HTTP endpoint, so it can fail; callers must treat that
 *     as non-fatal (a stale list is not a reason for an app not to boot);
 *   - the catalogue carries capabilities, which are written on every run so
 *     the registry tracks upstream changes (a model gaining vision, say).
 *
 * User-owned flags — `isEnabled`, `isDefault`, `isDeprecated` — are never
 * overwritten. Only provider-owned facts are refreshed.
 */
export const syncOpenRouterModels = async (
  payload: Payload,
  options?: { models?: OpenRouterModel[] }
): Promise<{ created: number; updated: number; removed: number; total: number }> => {
  const catalogue = options?.models ?? (await fetchOpenRouterModels());

  const existing = await payload.find({
    collection: aiModelsOptionsCollectionSlug,
    where: { provider: { equals: 'openrouter' } },
    depth: 0,
    limit: 5000,
    overrideAccess: true,
  });

  const existingByModelId = new Map<string, AIModelDoc>(
    existing.docs.map((doc) => [String((doc as AIModelDoc).modelId), doc as AIModelDoc])
  );
  const catalogueIds = new Set(catalogue.map((model) => model.modelId));

  let created = 0;
  let updated = 0;
  let removed = 0;

  for (const model of catalogue) {
    const providerFacts = {
      name: model.name,
      description: model.description || undefined,
      modality: model.modality,
      contextLength: model.contextLength,
      promptPrice: model.promptPrice,
      completionPrice: model.completionPrice,
      capabilities: model.capabilities,
    };

    const current = existingByModelId.get(model.modelId);

    if (!current) {
      await payload.create({
        collection: aiModelsOptionsCollectionSlug,
        data: {
          provider: 'openrouter',
          modelId: model.modelId,
          isDefault: false,
          isEnabled: true,
          isRemoved: false,
          ...providerFacts,
        },
        overrideAccess: true,
      });
      created += 1;
      continue;
    }

    await payload.update({
      collection: aiModelsOptionsCollectionSlug,
      id: current.id,
      data: {
        ...providerFacts,
        // A model reappearing upstream is no longer removed. Enabled/default
        // stay as the user left them.
        ...(current.isRemoved ? { isRemoved: false } : {}),
      },
      overrideAccess: true,
    });
    updated += 1;
  }

  // Models that vanished upstream are retired, not deleted — presets pointing
  // at them keep resolving.
  for (const doc of existing.docs) {
    const typed = doc as AIModelDoc;
    if (catalogueIds.has(String(typed.modelId)) || typed.isRemoved) continue;

    await payload.update({
      collection: aiModelsOptionsCollectionSlug,
      id: typed.id,
      data: { isDefault: false, isEnabled: false, isRemoved: true },
      overrideAccess: true,
    });
    removed += 1;
  }

  await ensureFallbackDefaultForProvider(payload, 'openrouter');

  return { created, updated, removed, total: catalogue.length };
};

/**
 * Builds the collection that stores selectable AI models for presets.
 */
export const buildAIModelsCollection = (): CollectionConfig => ({
  slug: aiModelsOptionsCollectionSlug,
  admin: {
    group: 'AI',
    defaultColumns: ['name', 'provider', 'modality', 'isDefault', 'isEnabled', 'isRemoved'],
    useAsTitle: 'name',
    description:
      'Registry of available AI models and their capabilities. Google and OpenAI come from the package model list; OpenRouter is fetched live from its public catalogue. Synced on init and used by AI presets and by consuming apps to pick a model that can perform a given task.',
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
      name: 'modality',
      type: 'text',
      label: 'Modality',
      admin: {
        readOnly: true,
        description: 'Raw modality string from the provider, e.g. "text+image+file->text".',
      },
    },
    {
      name: 'capabilities',
      type: 'group',
      label: 'Capabilities',
      admin: {
        description:
          'What this model can actually do. Populated from the provider catalogue and used to keep a task from being sent to a model that cannot perform it — e.g. a text-only model cannot read a scanned PDF, and a model without structured output will drift out of a JSON schema.',
      },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'inputText', type: 'checkbox', label: 'Text in', defaultValue: true },
            {
              name: 'inputImage',
              type: 'checkbox',
              label: 'Image in (vision)',
              defaultValue: false,
            },
            { name: 'inputFile', type: 'checkbox', label: 'File / PDF in', defaultValue: false },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'inputAudio', type: 'checkbox', label: 'Audio in', defaultValue: false },
            { name: 'inputVideo', type: 'checkbox', label: 'Video in', defaultValue: false },
          ],
        },
        {
          type: 'row',
          fields: [
            { name: 'outputText', type: 'checkbox', label: 'Text out', defaultValue: true },
            { name: 'outputImage', type: 'checkbox', label: 'Image out', defaultValue: false },
            { name: 'outputAudio', type: 'checkbox', label: 'Audio out', defaultValue: false },
          ],
        },
        {
          type: 'row',
          fields: [
            {
              name: 'structuredOutputs',
              type: 'checkbox',
              label: 'Structured output',
              defaultValue: false,
            },
            { name: 'reasoning', type: 'checkbox', label: 'Thinking', defaultValue: false },
            { name: 'toolCalling', type: 'checkbox', label: 'Tools', defaultValue: false },
          ],
        },
      ],
    },
    {
      name: 'contextLength',
      type: 'number',
      label: 'Context Length',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'promptPrice',
      type: 'number',
      label: 'Prompt Price (USD/token)',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'completionPrice',
      type: 'number',
      label: 'Completion Price (USD/token)',
      admin: { readOnly: true, position: 'sidebar' },
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
