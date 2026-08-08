import type { PayloadHandler } from 'payload';
import { aiModelsOptionsCollectionSlug, aiPresetCollectionSlug } from '../../collections.js';
import type { AIModelReference } from './types';

/**
 * Resolves a preset's model relationship into the provider-facing model ID string.
 *
 * @param payload - Payload instance used for collection reads.
 * @param modelRef - Raw relationship value from the preset's `model` field.
 * @param req - Active Payload request used for `findByID`.
 * @returns The concrete provider model ID, or `undefined` when it cannot be resolved.
 *
 * @example
 * ```ts
 * const modelId = await resolvePresetModelId(payload, preset.model, req);
 * // "gpt-4o-mini"
 * ```
 */
export const resolvePresetModelId = async (
  payload: Parameters<PayloadHandler>[0]['payload'],
  modelRef: AIModelReference,
  req: Parameters<PayloadHandler>[0]
) => {
  if (!modelRef) {
    return undefined;
  }

  if (typeof modelRef === 'object' && typeof modelRef.modelId === 'string') {
    return modelRef.modelId;
  }

  const modelId = typeof modelRef === 'object' ? modelRef.id : modelRef;

  if (modelId === undefined || modelId === null) {
    return undefined;
  }

  const modelDoc = await payload.findByID({
    collection: aiModelsOptionsCollectionSlug,
    depth: 0,
    id: modelId,
    req,
  });

  return typeof modelDoc?.modelId === 'string' ? modelDoc.modelId : undefined;
};

/**
 * Resolves provider, model, and system prompt from an optional preset document.
 *
 * @param payload - Payload instance used for preset lookups.
 * @param presetId - Optional preset document ID.
 * @param req - Active Payload request used for scoped document access.
 * @param fallbackSystem - Default system prompt used when no preset system prompt exists.
 * @returns Normalized preset values for generation.
 *
 * @example
 * ```ts
 * const preset = await resolvePresetValues(payload, '661f5c2d4b2a9f0a12345678', req, defaultSystem);
 * ```
 */
export const resolvePresetValues = async (
  payload: Parameters<PayloadHandler>[0]['payload'],
  presetId: number | string | undefined,
  req: Parameters<PayloadHandler>[0],
  fallbackSystem: string
) => {
  let model: string | undefined;
  let provider: 'google' | 'openai' | undefined;
  let system = fallbackSystem;

  if (!presetId) {
    return { model, provider, system };
  }

  const preset = await payload.findByID({
    collection: aiPresetCollectionSlug,
    id: presetId,
    req,
  });

  model = await resolvePresetModelId(payload, preset.model as AIModelReference, req);
  provider = preset.provider;
  system = preset.systemPrompt ?? system;

  return {
    model,
    provider,
    system,
  };
};
