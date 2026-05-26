import type { AIGeneratedHtmlBlock, AIGeneratedVariable } from '../ai-types';
import { generatedAiHtmlSchema } from './schema';
import type { NormalizedAiHtmlBlock, ValidationResult } from './types';

const normalizeVariable = (item: unknown): AIGeneratedVariable | null => {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const candidate = item as {
    defaultValue?: unknown;
    key?: unknown;
    name?: unknown;
    value?: unknown;
  };

  const key =
    typeof candidate.key === 'string'
      ? candidate.key
      : typeof candidate.name === 'string'
        ? candidate.name
        : null;

  const value =
    typeof candidate.value === 'string'
      ? candidate.value
      : typeof candidate.defaultValue === 'string'
        ? candidate.defaultValue
        : null;

  if (!key || !value) {
    return null;
  }

  const normalized = {
    key: key.trim(),
    value,
  };

  return normalized.key ? normalized : null;
};

/**
 * Normalizes variable candidates into the package `{ key, value }` shape.
 *
 * @param variables - Raw variable list returned by the model.
 * @returns Normalized variables plus normalization metadata.
 *
 * @example
 * ```ts
 * const normalized = normalizeVariables([
 *   { name: 'heading', defaultValue: 'Hello' },
 * ]);
 * ```
 */
export const normalizeVariables = (variables: unknown) => {
  if (!Array.isArray(variables)) {
    return {
      normalizationApplied: false,
      unresolvedCount: 0,
      variables: [] as AIGeneratedVariable[],
    };
  }

  let normalizationApplied = false;
  let unresolvedCount = 0;

  const normalized = variables
    .map((item) => {
      const variable = normalizeVariable(item);

      if (!variable) {
        unresolvedCount += 1;
        return null;
      }

      if (typeof item === 'object' && item && (!('key' in item) || !('value' in item))) {
        normalizationApplied = true;
      }

      return variable;
    })
    .filter((item): item is AIGeneratedVariable => Boolean(item));

  return {
    normalizationApplied,
    unresolvedCount,
    variables: normalized,
  };
};

const validateJavaScript = (value: string) => {
  if (!value.trim()) {
    return;
  }

  // Parse only. The function is not executed.
  // eslint-disable-next-line no-new-func
  new Function(value);
};

/**
 * Parses raw model output into the generated block shape.
 *
 * Some providers include Payload's final block wrapper (`blockType`) even
 * though generation works with the inner artifact. Drop that wrapper key before
 * applying the strict schema so a useful response can still be normalized.
 */
export const parseGeneratedBlockCandidate = (generated: unknown): AIGeneratedHtmlBlock => {
  if (!generated || typeof generated !== 'object' || Array.isArray(generated)) {
    return generatedAiHtmlSchema.parse(generated);
  }

  const candidate = { ...(generated as Record<string, unknown>) };
  delete candidate.blockType;

  return generatedAiHtmlSchema.parse(candidate);
};

/**
 * Validates and normalizes a generated block into the package's final runtime shape.
 *
 * @param generated - Raw model output candidate.
 * @returns Validation result containing normalized output and normalization metadata.
 *
 * @example
 * ```ts
 * const result = validateGeneratedBlock({
 *   html: '<section>Hello</section>',
 *   variables: [{ name: 'heading', defaultValue: 'Hello' }],
 * });
 * ```
 */
export const validateGeneratedBlock = (
  generated: AIGeneratedHtmlBlock
): ValidationResult => {
  const parsed = parseGeneratedBlockCandidate(generated);
  const html = parsed.html.trim();

  if (!html) {
    throw new Error('AI response did not include required "html" output.');
  }

  const normalizedVariables = normalizeVariables(parsed.variables);

  if (normalizedVariables.unresolvedCount > 0) {
    throw new Error(
      `AI response included ${normalizedVariables.unresolvedCount} invalid variable entries. Variables must use { key, value }.`
    );
  }

  const css = typeof parsed.css === 'string' ? parsed.css : '';
  const js = typeof parsed.js === 'string' ? parsed.js : '';

  validateJavaScript(js);

  return {
    lastError: null,
    normalized: {
      html,
      css,
      js,
      variables: normalizedVariables.variables,
      data: parsed.data,
    } satisfies NormalizedAiHtmlBlock,
    normalizationApplied: normalizedVariables.normalizationApplied,
  };
};
