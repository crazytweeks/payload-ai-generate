/**
 * Public barrel for block generation helpers.
 *
 * The implementation is split across this directory so schemas, prompts,
 * normalization, and payload assembly stay focused and documented.
 */

export {
  normalizeVariables,
  parseGeneratedBlockCandidate,
  validateGeneratedBlock,
} from './normalize';
export {
  buildGenerationPayload,
  buildPartialFieldSnapshots,
  buildPartialGenerationPayload,
  createRunSummary,
} from './payload';
export {
  buildAiHtmlPrompt,
  buildBlockGenerationSystemPrompt,
  buildRepairPrompt,
} from './prompt';
export { generatedAiHtmlSchema } from './schema';
export type {
  NormalizedAiHtmlBlock,
  PartialAiHtmlBlock,
  ValidationResult,
} from './types';
