import type { CollectionConfig, Config, Plugin } from 'payload';
import type { AIPluginOptions } from './ai-types';
import { aiServiceCreate, installPayloadAI } from './aiService';
import {
  aiModelsOptionsCollectionSlug,
  aiPresetCollectionSlug,
  aiPromptCollectionSlug,
  buildAIComposerCollection,
  buildAIComposerUICollection,
  buildAIMediaCollection,
  buildAIModelsCollection,
  buildAIPresetCollection,
  buildAIPromptCollection,
  syncAIModelsCollection,
  syncOpenRouterModels,
} from './collections';
import {
  buildTestAnnouncementsCollection,
  testAnnouncementsCollectionSlug,
} from './dev-test/testAnnouncements';
import { buildTestMessagesCollection, testMessagesCollectionSlug } from './dev-test/testMessages';
import { buildTestProductsCollection, testProductsCollectionSlug } from './dev-test/testProducts';
import { composerEndpointHandler } from './endpoints/composerEndpointHandler';
import { customEndpointHandler } from './endpoints/customEndpointHandler';
import { openrouterSyncHandler } from './endpoints/openrouterSyncHandler';
import { previewEndpointHandler } from './endpoints/previewHandler';
import { uiGenerateEndpointHandler } from './endpoints/uiGenerateEndpointHandler';

const upsertCollection = (
  collections: CollectionConfig[] | undefined,
  collection: CollectionConfig
): CollectionConfig[] => {
  const existingCollections = collections ?? [];
  const existingIndex = existingCollections.findIndex(({ slug }) => slug === collection.slug);

  if (existingIndex === -1) {
    return [...existingCollections, collection];
  }

  const nextCollections = [...existingCollections];
  nextCollections[existingIndex] = collection;
  return nextCollections;
};

export type * from './ai-types';
/**
 * Plugin options for `aiGenerate()`.
 */
export type { AIGenerateTextParams, AIPluginOptions, PayloadAIService } from './ai-types';
/**
 * Collection slug for the generated AI model registry.
 */
export { aiComposerUICollectionSlug } from './collections/constants';
export { ComposerClient } from './components/composer/ComposerClient';
export type {
  ComposerMode,
  ComposerPlan,
  GeneratedFile,
  ReferenceRow,
} from './components/composer/types';
export { ComposerV2Client } from './components/composer-v2/ComposerV2Client';
export type { ComposerUIFile } from './composer-ui';
export { buildComposerUISrcDoc, ComposerUIPreviewFrame } from './composer-ui';
// OpenRouter catalogue + capability helpers, so consuming apps can pick a model
// that is actually able to perform a given task.
export type {
  CapabilityRequirement,
  ModelCapabilities,
  OpenRouterModel,
} from './openrouter';
export {
  deriveCapabilities,
  describeCapabilities,
  fetchOpenRouterModels,
  modelSupports,
} from './openrouter';
export {
  aiModelsOptionsCollectionSlug,
  aiPresetCollectionSlug,
  aiPromptCollectionSlug,
  aiServiceCreate,
};

/**
 * Extends a Payload config with the AI prompt tools, preset support, and model registry sync.
 */
export const aiGenerate =
  (pluginOptions: AIPluginOptions = {}): Plugin =>
  (incomingConfig: Config): Config => {
    const config = { ...incomingConfig };
    const effectivePluginOptions: AIPluginOptions = {
      ...pluginOptions,
      referenceCollections: {
        ...(pluginOptions.devTestCollections
          ? {
              [testMessagesCollectionSlug]: true,
              [testProductsCollectionSlug]: true,
              [testAnnouncementsCollectionSlug]: true,
            }
          : {}),
        ...(pluginOptions.referenceCollections ?? {}),
      },
    };
    const aiService = aiServiceCreate(effectivePluginOptions);
    const incomingOnInit = config.onInit;

    config.collections = upsertCollection(config.collections, buildAIModelsCollection());
    config.collections = upsertCollection(
      config.collections,
      buildAIPromptCollection({
        apiRoute: config.routes?.api ?? '/api',
        previewPagePath: effectivePluginOptions.previewPagePath,
        pluginOptions: effectivePluginOptions,
      })
    );
    config.collections = upsertCollection(config.collections, buildAIPresetCollection());
    config.collections = upsertCollection(
      config.collections,
      buildAIComposerCollection(effectivePluginOptions)
    );
    config.collections = upsertCollection(config.collections, buildAIComposerUICollection());
    config.collections = upsertCollection(config.collections, buildAIMediaCollection());

    if (pluginOptions.devTestCollections) {
      config.collections = upsertCollection(config.collections, buildTestMessagesCollection());
      config.collections = upsertCollection(config.collections, buildTestProductsCollection());
      config.collections = upsertCollection(config.collections, buildTestAnnouncementsCollection());
    }

    config.custom = {
      ...config.custom,
      ai: aiService,
      aiPluginOptions: effectivePluginOptions,
    };

    config.endpoints = [
      ...(config.endpoints ?? []),
      {
        handler: customEndpointHandler,
        method: 'post',
        path: '/ai-generate/stream',
      },
      {
        handler: previewEndpointHandler,
        method: 'get',
        path: '/ai-generate/preview',
      },
      {
        handler: composerEndpointHandler,
        method: 'post',
        path: '/ai-generate/composer',
      },
      {
        handler: uiGenerateEndpointHandler,
        method: 'post',
        path: '/ai-generate/ui-generate',
      },
      {
        handler: openrouterSyncHandler,
        method: 'post',
        path: '/ai-generate/openrouter/sync',
      },
    ];

    if (pluginOptions.disabled) {
      return config;
    }

    config.onInit = async (payload) => {
      if (incomingOnInit) {
        await incomingOnInit(payload);
      }

      installPayloadAI(payload, aiService);
      try {
        await syncAIModelsCollection(payload);
      } catch (error) {
        payload.logger.error({
          msg: 'Failed to sync AI models collection during init',
          err: error,
        });
      }

      // OpenRouter's catalogue is fetched over the network, so this is the one
      // sync that can fail for reasons entirely outside the app. Non-fatal by
      // design: a stale or absent model list must never stop the app booting.
      // Re-runnable on demand via POST /api/ai-generate/openrouter/sync.
      try {
        const result = await syncOpenRouterModels(payload);
        payload.logger.info({
          msg: 'Synced OpenRouter models',
          ...result,
        });
      } catch (error) {
        payload.logger.warn({
          msg: 'Failed to sync OpenRouter models during init (continuing without them)',
          err: error,
        });
      }
      if (pluginOptions.devTestCollections) {
        try {
          const { seedTestMessagesCollection } = await import('./dev-test/seed/testMessages');
          const { seedTestProductsCollection } = await import('./dev-test/seed/testProducts');
          const { seedTestAnnouncementsCollection } = await import(
            './dev-test/seed/testAnnouncements'
          );
          await seedTestMessagesCollection(payload);
          await seedTestProductsCollection(payload);
          await seedTestAnnouncementsCollection(payload);
        } catch (error) {
          payload.logger.error({
            msg: 'Failed to seed AI dev test collections during init',
            err: error,
          });
        }
      }
      payload.logger.info('Payload AI plugin initialized');
    };

    return config;
  };

/**
 * Alias export for environments that prefer a plugin-named entrypoint.
 */
export const payloadAIPlugin = aiGenerate;
