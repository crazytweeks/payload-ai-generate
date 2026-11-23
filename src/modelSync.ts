import type { AIPluginOptions } from './ai-types';

/**
 * Why the plugin's `onInit` model-registry sync is skipped.
 *
 * - `production-build`: `next build` boots Payload once per page-data worker; a
 *   live catalogue fetch and hundreds of registry writes per worker dominated
 *   build time, so this has always been skipped during the build phase.
 * - `plugin-option`: the host app asked to freeze the registry by passing
 *   `skipModelSync`. Before this option existed the writes could be vetoed at
 *   the Payload instance, but the OpenRouter fetch still ran (15 s timeout) and
 *   its results were discarded.
 */
export type ModelSyncSkipReason = 'plugin-option' | 'production-build';

/**
 * Decide whether `onInit` should skip both model-registry syncs.
 *
 * Pure and injectable so the decision can be tested without booting Payload or
 * touching the network. The build phase still wins over the option: it is a
 * hard lifecycle rule, not a caller preference.
 */
export const modelSyncSkipReason = (
  options: Pick<AIPluginOptions, 'skipModelSync'> = {},
  env: Readonly<Record<string, string | undefined>> = process.env
): ModelSyncSkipReason | null => {
  if (env.NEXT_PHASE === 'phase-production-build') return 'production-build';
  if (options.skipModelSync) return 'plugin-option';
  return null;
};

/** True when `onInit` must not run either model sync. */
export const shouldSkipModelSync = (
  options: Pick<AIPluginOptions, 'skipModelSync'> = {},
  env: Readonly<Record<string, string | undefined>> = process.env
): boolean => modelSyncSkipReason(options, env) !== null;
