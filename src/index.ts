import type { CollectionConfig, Config, Plugin } from 'payload';
import type { AIPluginOptions } from './ai-types';
import { aiServiceCreate, installPayloadAI } from './aiService';
import {
  aiModelsOptionsCollectionSlug,
  aiPresetCollectionSlug,
  aiPromptCollectionSlug,
  buildAIModelsCollection,
  buildAIPresetCollection,
  buildAIPromptCollection,
  syncAIModelsCollection,
} from './collections';
import { customEndpointHandler } from './endpoints/customEndpointHandler';
import { previewEndpointHandler } from './endpoints/previewHandler';

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

/**
 * Plugin options for `aiGenerate()`.
 */
export type { AIGenerateTextParams, AIPluginOptions, PayloadAIService } from './ai-types';
export type * from './ai-types';
/**
 * Collection slug for the generated AI model registry.
 */
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
    const aiService = aiServiceCreate(pluginOptions);
    const incomingOnInit = config.onInit;

    config.collections = upsertCollection(config.collections, buildAIModelsCollection());
    config.collections = upsertCollection(
      config.collections,
      buildAIPromptCollection({
        apiRoute: config.routes?.api ?? '/api',
        previewPagePath: pluginOptions.previewPagePath,
        pluginOptions,
      })
    );
    config.collections = upsertCollection(config.collections, buildAIPresetCollection());

    config.custom = {
      ...config.custom,
      ai: aiService,
      aiPluginOptions: pluginOptions,
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
      payload.logger.info('Payload AI plugin initialized');
    };

    return config;
  };

/**
 * Alias export for environments that prefer a plugin-named entrypoint.
 */
export const payloadAIPlugin = aiGenerate;
