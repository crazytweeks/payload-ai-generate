import type { AIGenerationOutcome, AIGenerationRunSummary } from '../../ai-types';
import type { ActivityItem, RelationshipValue } from './types';

/**
 * Human-readable labels for persisted generation outcomes.
 */
export const outcomeLabels: Record<AIGenerationOutcome, string> = {
  completed: 'Completed',
  'completed-after-repair': 'Completed After Repair',
  'completed-with-normalization': 'Completed With Normalization',
  'failed-no-usable-output': 'Failed',
  'failed-with-partial-output': 'Failed With Partial Output',
};

/**
 * Extracts the document ID from a Payload relationship value.
 *
 * @param value - Relationship value from form state.
 * @returns Relationship ID when present.
 *
 * @example
 * ```ts
 * const presetId = getRelationshipID({ id: '661f5c2d4b2a9f0a12345678' });
 * ```
 */
export const getRelationshipID = (value: RelationshipValue): number | string | undefined => {
  if (typeof value === 'object' && value !== null && 'id' in value) {
    return value.id;
  }

  if (typeof value === 'number' || typeof value === 'string') {
    return value;
  }

  return undefined;
};

/**
 * Returns whether the last run is one of the failed states that can expose a retry action.
 *
 * @param run - Persisted run summary from the prompt document.
 * @returns `true` when the run ended in a failed state.
 */
export const isFailedOutcome = (run: AIGenerationRunSummary | null) =>
  run?.outcome === 'failed-no-usable-output' || run?.outcome === 'failed-with-partial-output';

/**
 * Returns the visual card styling used for a composer activity item.
 *
 * @param kind - Activity item kind.
 * @returns Inline style fragments used by the activity cards.
 */
export const cardStyleForKind = (kind: ActivityItem['kind']) => {
  if (kind === 'error') {
    return {
      background: 'color-mix(in srgb, var(--theme-error-500) 8%, transparent)',
      borderColor: 'color-mix(in srgb, var(--theme-error-500) 30%, var(--theme-elevation-100))',
    };
  }

  if (kind === 'repair') {
    return {
      background: 'color-mix(in srgb, var(--theme-warning-500) 8%, transparent)',
      borderColor: 'color-mix(in srgb, var(--theme-warning-500) 30%, var(--theme-elevation-100))',
    };
  }

  if (kind === 'tool-call' || kind === 'tool-result') {
    return {
      background: 'color-mix(in srgb, var(--theme-success-500) 7%, transparent)',
      borderColor: 'color-mix(in srgb, var(--theme-success-500) 25%, var(--theme-elevation-100))',
    };
  }

  if (kind === 'reference') {
    return {
      background: 'color-mix(in srgb, var(--theme-success-500) 10%, transparent)',
      borderColor: 'color-mix(in srgb, var(--theme-success-500) 22%, var(--theme-elevation-100))',
    };
  }

  return {
    background: 'var(--theme-bg)',
    borderColor: 'var(--theme-elevation-100)',
  };
};

/**
 * Returns a display label for an uploaded reference item from Payload form state.
 *
 * @param attachment - Attachment item from the relationship field array.
 * @param index - Zero-based attachment index.
 * @returns Stable label used by the selected-reference chips.
 */
export const getAttachmentLabel = (attachment: unknown, index: number) => {
  if (typeof attachment === 'object' && attachment !== null && 'filename' in attachment) {
    return String((attachment as { filename?: unknown }).filename ?? `attachment-${index + 1}`);
  }

  return `attachment-${index + 1}`;
};

/**
 * Returns a stable React key for an uploaded reference item.
 *
 * @param attachment - Attachment item from the relationship field array.
 * @param index - Zero-based attachment index used only for fallback labels.
 * @returns Stable key composed from attachment identity fields when available.
 */
export const getAttachmentKey = (attachment: unknown, index: number) => {
  if (typeof attachment === 'object' && attachment !== null) {
    const candidate = attachment as {
      filename?: unknown;
      id?: unknown;
      mimeType?: unknown;
      url?: unknown;
    };

    const identity = [candidate.id, candidate.filename, candidate.mimeType, candidate.url]
      .filter((value) => typeof value === 'number' || typeof value === 'string')
      .join(':');

    if (identity) {
      return identity;
    }
  }

  return getAttachmentLabel(attachment, index);
};

/**
 * Returns a stable React key for a persisted conversation message.
 *
 * @param message - Conversation message rendered in the composer history.
 * @returns Stable key derived from timestamp, role, and content.
 */
export const getConversationMessageKey = (message: {
  content: string;
  createdAt: string;
  role: string;
}) => `${message.createdAt}:${message.role}:${message.content.slice(0, 48)}`;

/**
 * Returns a stable React key for an activity card in the run panel.
 *
 * @param item - Activity item shown in the composer activity feed.
 * @returns Stable key derived from the activity content.
 */
export const getActivityKey = (item: ActivityItem) =>
  `${item.kind}:${item.label}:${item.detail ?? ''}`;
