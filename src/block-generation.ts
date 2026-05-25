/**
 * Public barrel for block generation helpers.
 *
 * The implementation is split across `./block-generation/` so schemas, prompts,
 * normalization, and payload assembly stay focused and documented.
 */

export { normalizeVariables, validateGeneratedBlock } from './block-generation/normalize';
export {
  buildGenerationPayload,
  buildPartialFieldSnapshots,
  buildPartialGenerationPayload,
  createRunSummary,
} from './block-generation/payload';
export {
  buildAiHtmlPrompt,
  buildBlockGenerationSystemPrompt,
  buildRepairPrompt,
} from './block-generation/prompt';
export { generatedAiHtmlSchema } from './block-generation/schema';
export type {
  NormalizedAiHtmlBlock,
  PartialAiHtmlBlock,
  ValidationResult,
} from './block-generation/types';
