import { BasePayload, type Payload } from 'payload';
import type { PayloadAIService } from '../ai-types';
import {
  type PayloadWithAIInternals,
  payloadAIPrototypePatchedSymbol,
  payloadAIServiceSymbol,
} from './types';

/**
 * Patches Payload's base prototype with a lazily resolved `payload.ai` getter.
 *
 * @returns Nothing. The function is idempotent and safe to call multiple times.
 *
 * @example
 * ```ts
 * ensurePayloadAIGetter();
 * ```
 */
export const ensurePayloadAIGetter = () => {
  const prototype = BasePayload.prototype as BasePayload & {
    [payloadAIPrototypePatchedSymbol]?: boolean;
  };

  if (prototype[payloadAIPrototypePatchedSymbol]) {
    return;
  }

  Object.defineProperty(prototype, 'ai', {
    configurable: true,
    get(this: PayloadWithAIInternals) {
      return this[payloadAIServiceSymbol] ?? this.config?.custom?.ai;
    },
    set(this: PayloadWithAIInternals, value: PayloadAIService) {
      this[payloadAIServiceSymbol] = value;
    },
  });

  prototype[payloadAIPrototypePatchedSymbol] = true;
};

/**
 * Attaches the AI service to the current Payload instance.
 *
 * @param payload - Payload instance receiving the runtime AI service.
 * @param aiService - Service created by `aiServiceCreate`.
 * @returns The same AI service instance for convenience.
 *
 * @example
 * ```ts
 * installPayloadAI(payload, aiService);
 * ```
 */
export const installPayloadAI = (
  payload: Payload,
  aiService: PayloadAIService
): PayloadAIService => {
  ensurePayloadAIGetter();
  (payload as PayloadWithAIInternals).ai = aiService;
  return aiService;
};

/**
 * Returns the AI service previously attached to the current Payload instance.
 *
 * @param payload - Payload instance that may have an attached AI service.
 * @returns Attached AI service when present, otherwise `undefined`.
 *
 * @example
 * ```ts
 * const ai = resolvePayloadAI(payload);
 * ```
 */
export const resolvePayloadAI = (payload: Payload): PayloadAIService | undefined => {
  ensurePayloadAIGetter();
  return (payload as PayloadWithAIInternals).ai;
};
