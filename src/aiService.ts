/**
 * Public entrypoint for the `payload.ai` runtime service.
 *
 * The implementation is split across `./ai-service/` to keep provider setup,
 * payload integration, stream orchestration, and internal utilities focused
 * and easier to maintain.
 */
export { resolveOptions } from './ai-service/options';
export { ensurePayloadAIGetter, installPayloadAI, resolvePayloadAI } from './ai-service/payload';
export { aiServiceCreate, createPromptRunner } from './ai-service/provider-runner';
