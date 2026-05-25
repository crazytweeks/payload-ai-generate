import type { UIFieldClientProps } from 'payload';
import type {
  AIConversationMessage,
  AIGenerationOutcome,
  AIGenerationRunSummary,
} from '../../ai-types';

/**
 * Props injected into the composer field from the Payload UI field config.
 */
export type ComposerProps = {
  attachmentsFieldPath?: string | null;
  blockPayloadFieldPath: string;
  cssFieldPath: string;
  dataJsonFieldPath: string;
  htmlFieldPath: string;
  instructionsFieldPath: string;
  jsFieldPath: string;
  lastRunFieldPath: string;
  messagesFieldPath: string;
  presetFieldPath: string;
  referencesFieldPath?: string | null;
  titleFieldPath: string;
  variablesJsonFieldPath: string;
};

/**
 * Concrete field props for the `AIGenerateComposerField` client component.
 */
export type ComposerFieldProps = UIFieldClientProps & ComposerProps;

/**
 * Relationship field value accepted by Payload admin form state.
 */
export type RelationshipValue = number | string | { id?: number | string } | null | undefined;

/**
 * Visual activity item rendered in the composer run panel.
 */
export type ActivityItem = {
  detail?: string;
  kind: 'error' | 'reference' | 'repair' | 'status' | 'tool-call' | 'tool-result';
  label: string;
};

/**
 * View model produced by the composer controller hook.
 */
export type ComposerViewModel = {
  activity: ActivityItem[];
  currentOutcome: AIGenerationOutcome | null;
  error: string | null;
  fieldLabel: string;
  followup: string;
  hasHistory: boolean;
  instructions: string;
  isGenerating: boolean;
  lastRun: AIGenerationRunSummary | null;
  messages: AIConversationMessage[];
  modelLabel: string | null;
  outcomeColor: string;
  providerLabel: string | null;
  rawTranscript: string;
  selectedAttachments: unknown[];
  shouldShowFollowup: boolean;
  title?: string;
};
