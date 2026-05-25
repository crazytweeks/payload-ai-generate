import type { AIGeneratedDangerousCustomRenderBlock, AIGeneratedVariable } from '../ai-types';

/**
 * Partial block shape used while the model is still streaming.
 *
 * @example
 * ```ts
 * const partial: PartialGeneratedDangerousCustomRenderBlock = {
 *   html: '<section>Loading…</section>',
 * };
 * ```
 */
export type PartialGeneratedDangerousCustomRenderBlock = Partial<
  Omit<AIGeneratedDangerousCustomRenderBlock, 'variables'> & {
    variables: unknown;
  }
>;

/**
 * Fully normalized block shape after validation.
 *
 * @example
 * ```ts
 * const normalized: NormalizedGeneratedDangerousCustomRenderBlock = {
 *   html: '<section>Hello</section>',
 *   css: '',
 *   js: '',
 *   variables: [],
 *   data: {},
 * };
 * ```
 */
export type NormalizedGeneratedDangerousCustomRenderBlock = Omit<
  AIGeneratedDangerousCustomRenderBlock,
  'css' | 'js' | 'variables'
> & {
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
  normalized: NormalizedGeneratedDangerousCustomRenderBlock;
  normalizationApplied: boolean;
};
