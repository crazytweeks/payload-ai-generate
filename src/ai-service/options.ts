import type { AIPluginOptions } from '../ai-types';

/**
 * Resolves plugin options and fills missing API keys from environment variables.
 *
 * @param pluginOptions - Raw plugin options passed to `aiGenerate()`.
 * @returns Normalized options with environment-backed API keys applied when absent.
 *
 * @example
 * ```ts
 * const options = resolveOptions({
 *   defaultProvider: 'google',
 * });
 * ```
 */
export const resolveOptions = (pluginOptions: AIPluginOptions): AIPluginOptions => {
  const options = { ...pluginOptions };

  if (!options.googleApiKey && process.env.GOOGLE_AI_API) {
    options.googleApiKey = process.env.GOOGLE_AI_API;
  }

  if (!options.openaiApiKey && process.env.OPENAI_API_KEY) {
    options.openaiApiKey = process.env.OPENAI_API_KEY;
  }

  return options;
};
