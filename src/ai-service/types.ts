import type { streamText } from 'ai';
import type { Payload } from 'payload';
import type {
  AIGeneratedHtmlBlock,
  AIProviderName,
  PayloadAIService,
} from '../ai-types';

/**
 * Symbol used to store the runtime AI service on a Payload instance.
 */
export const payloadAIServiceSymbol = Symbol.for('ai-generate.payload-ai-service');

/**
 * Symbol used to avoid patching the Payload base prototype more than once.
 */
export const payloadAIPrototypePatchedSymbol = Symbol.for(
  'ai-generate.payload-ai-prototype-patched'
);

/**
 * Internal Payload type that carries the attached AI service instance.
 *
 * @example
 * ```ts
 * const payloadWithAI = payload as PayloadWithAIInternals;
 * payloadWithAI.ai = aiService;
 * ```
 */
export type PayloadWithAIInternals = Payload & {
  [payloadAIServiceSymbol]?: PayloadAIService;
};

/**
 * Result returned from a single stream attempt before validation and repair logic.
 *
 * @example
 * ```ts
 * const attempt: SingleAttemptResult = {
 *   generated: null,
 *   lastGeneratedJSON: '',
 *   partialGenerated: {},
 * };
 * ```
 */
export type SingleAttemptResult = {
  generated: AIGeneratedHtmlBlock | null;
  lastGeneratedJSON: string;
  partialGenerated: Partial<AIGeneratedHtmlBlock>;
};

/**
 * Function signature used to resolve a provider model instance for `streamText` / `generateText`.
 */
export type ProviderModelResolver = (
  provider: AIProviderName,
  model?: string
) => Parameters<typeof streamText>[0]['model'];
