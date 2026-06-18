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
} from './collections';
import {
  buildTestAnnouncementsCollection,
  testAnnouncementsCollectionSlug,
} from './dev-test/testAnnouncements';
import { buildTestMessagesCollection, testMessagesCollectionSlug } from './dev-test/testMessages';
import { buildTestProductsCollection, testProductsCollectionSlug } from './dev-test/testProducts';
import { composerEndpointHandler } from './endpoints/composerEndpointHandler';
import { customEndpointHandler } from './endpoints/customEndpointHandler';
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
