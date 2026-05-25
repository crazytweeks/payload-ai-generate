import type {
  AIGeneratedHtmlBlock,
  AIGenerationField,
  AIGenerationFinalPayload,
  AIGenerationOutcome,
  AIGenerationRunSummary,
  AIProviderName,
} from '../ai-types';
import { normalizeVariables, validateGeneratedBlock } from './normalize';
import type { PartialAiHtmlBlock } from './types';

const stringifyPretty = (value: unknown) => JSON.stringify(value, null, 2);

const safeParseJSONString = (value: string | undefined) => {
  if (!value?.trim()) {
    return {};
  }

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
};

/**
 * Converts a validated generated block into the string payloads used by the admin form.
 *
 * @param params.generated - Generated block candidate.
 * @param params.run - Run summary attached to the final payload.
 * @returns Final payload consumed by the endpoint and composer.
 *
 * @example
 * ```ts
 * const payload = buildGenerationPayload({
 *   generated,
 *   run,
 * });
 * ```
 */
export const buildGenerationPayload = ({
  generated,
  run,
}: {
  generated: AIGeneratedHtmlBlock;
  run: AIGenerationRunSummary;
}): AIGenerationFinalPayload => {
  const normalized = validateGeneratedBlock(generated).normalized;

  const blockPayload = {
    blockType: 'ai-html-block' as const,
    css: normalized.css ?? '',
    data: normalized.data ?? {},
    html: normalized.html,
    js: normalized.js ?? '',
    variables: normalized.variables ?? [],
  };

  return {
    blockPayload,
    css: blockPayload.css,
    dataJSON: stringifyPretty(blockPayload.data),
    html: blockPayload.html,
    js: blockPayload.js,
    run,
    variablesJSON: stringifyPretty(blockPayload.variables),
  };
};

/**
 * Creates per-field snapshots from a partial structured output while the model is still streaming.
 *
 * @param partial - Partial generated block candidate.
 * @returns Field snapshots keyed by composer field name.
 *
 * @example
 * ```ts
 * const snapshots = buildPartialFieldSnapshots({
 *   html: '<section>Hello</section>',
 * });
 * ```
 */
export const buildPartialFieldSnapshots = (
  partial: PartialAiHtmlBlock
): Partial<Record<AIGenerationField, string>> => {
  const snapshots: Partial<Record<AIGenerationField, string>> = {};

  if (typeof partial.html === 'string') {
    snapshots.html = partial.html;
  }

  if (typeof partial.css === 'string') {
    snapshots.css = partial.css;
  }

  if (typeof partial.js === 'string') {
    snapshots.js = partial.js;
  }

  if (partial.variables !== undefined) {
    snapshots.variablesJSON = stringifyPretty(normalizeVariables(partial.variables).variables);
  }

  if (partial.data !== undefined) {
    snapshots.dataJSON = stringifyPretty(partial.data);
  }

  if (typeof partial.html === 'string' && partial.html.trim().length > 0) {
    snapshots.blockPayloadJSON = stringifyPretty({
      blockType: 'ai-html-block',
      css: typeof partial.css === 'string' ? partial.css : '',
      data: partial.data ?? {},
      html: partial.html,
      js: typeof partial.js === 'string' ? partial.js : '',
      variables: normalizeVariables(partial.variables).variables,
    });
  }

  return snapshots;
};

/**
 * Builds a best-effort payload from partially valid data so the UI can preserve
 * usable output on failure.
 *
 * @param params.generated - Partial block candidate.
 * @param params.lastError - Final error message associated with the failed run.
 * @param params.maxRepairAttempts - Configured repair attempt limit.
 * @param params.modelId - Model used for the run.
 * @param params.provider - Provider used for the run.
 * @param params.repairAttemptsUsed - Number of repair attempts consumed.
 * @returns Final payload when `html` is present, otherwise `null`.
 *
 * @example
 * ```ts
 * const partialPayload = buildPartialGenerationPayload({
 *   generated: partialBlock,
 *   lastError: 'variables were invalid',
 *   maxRepairAttempts: 3,
 *   modelId: 'gpt-4o-mini',
 *   provider: 'openai',
 *   repairAttemptsUsed: 1,
 * });
 * ```
 */
export const buildPartialGenerationPayload = ({
  generated,
  lastError,
  maxRepairAttempts,
  modelId,
  provider,
  repairAttemptsUsed,
}: {
  generated: PartialAiHtmlBlock;
  lastError: string;
  maxRepairAttempts: number;
  modelId: string;
  provider: AIProviderName;
  repairAttemptsUsed: number;
}) => {
  const html = typeof generated.html === 'string' ? generated.html.trim() : '';

  if (!html) {
    return null;
  }

  return buildGenerationPayload({
    generated: {
      css: typeof generated.css === 'string' ? generated.css : '',
      data: generated.data ?? safeParseJSONString(undefined),
      html,
      js: typeof generated.js === 'string' ? generated.js : '',
      variables: normalizeVariables(generated.variables).variables,
    },
    run: {
      lastError,
      maxRepairAttempts,
      modelId,
      outcome: 'failed-with-partial-output',
      provider,
      repairAttemptsUsed,
    },
  });
};

/**
 * Creates the persisted run summary stored with final endpoint responses.
 *
 * @param params.lastError - Optional final error message.
 * @param params.maxRepairAttempts - Configured repair attempt limit.
 * @param params.modelId - Model used for the run.
 * @param params.normalizationApplied - Whether variable normalization was required.
 * @param params.provider - Provider used for the run.
 * @param params.repaired - Whether the final valid result came from a repair attempt.
 * @param params.repairAttemptsUsed - Number of repair attempts consumed.
 * @returns Run summary object stored on the prompt document.
 *
 * @example
 * ```ts
 * const run = createRunSummary({
 *   maxRepairAttempts: 3,
 *   modelId: 'gemini-2.5-flash',
 *   provider: 'google',
 * });
 * ```
 */
export const createRunSummary = ({
  lastError = null,
  maxRepairAttempts,
  modelId,
  normalizationApplied = false,
  provider,
  repaired = false,
  repairAttemptsUsed = 0,
}: {
  lastError?: string | null;
  maxRepairAttempts: number;
  modelId: string;
  normalizationApplied?: boolean;
  provider: AIProviderName;
  repaired?: boolean;
  repairAttemptsUsed?: number;
}): AIGenerationRunSummary => {
  let outcome: AIGenerationOutcome = 'completed';

  if (repairAttemptsUsed > 0 && repaired) {
    outcome = 'completed-after-repair';
  } else if (normalizationApplied) {
    outcome = 'completed-with-normalization';
  }

  return {
    lastError,
    maxRepairAttempts,
    modelId,
    outcome,
    provider,
    repairAttemptsUsed,
  };
};
