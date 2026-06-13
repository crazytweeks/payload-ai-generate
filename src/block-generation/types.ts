import type { AIGeneratedHtmlBlock, AIGeneratedVariable } from '../ai-types';

/**
 * Partial block shape used while the model is still streaming.
 *
 * @example
 * ```ts
 * const partial: PartialAiHtmlBlock = {
 *   html: '<section>Loading…</section>',
 * };
 * ```
 */
export type PartialAiHtmlBlock = Partial<
  Omit<AIGeneratedHtmlBlock, 'variables'> & {
    variables: unknown;
  }
>;

/**
 * Fully normalized block shape after validation.
 *
 * @example
 * ```ts
 * const normalized: NormalizedAiHtmlBlock = {
 *   html: '<section>Hello</section>',
 *   css: '',
 *   js: '',
 *   variables: [],
 *   data: {},
 * };
 * ```
 */
export type NormalizedAiHtmlBlock = Omit<AIGeneratedHtmlBlock, 'css' | 'js' | 'variables'> & {
  css: string;
  js: string;
  variables: AIGeneratedVariable[];
};

/**
 * Result returned by block validation and normalization.
 *
 * @example
 * ```ts
 * const result: ValidationResult = {
 *   lastError: null,
 *   normalized,
 *   normalizationApplied: false,
 * };
 * ```
 */
export type ValidationResult = {
  lastError?: string | null;
  normalized: NormalizedAiHtmlBlock;
  normalizationApplied: boolean;
};
