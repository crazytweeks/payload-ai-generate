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
  buildBlockGenerationSystemPrompt,
  buildDangerousCustomRenderPrompt,
  buildRepairPrompt,
} from './block-generation/prompt';
export { generatedDangerousCustomRenderSchema } from './block-generation/schema';
export type {
  NormalizedGeneratedDangerousCustomRenderBlock,
  PartialGeneratedDangerousCustomRenderBlock,
  ValidationResult,
} from './block-generation/types';
