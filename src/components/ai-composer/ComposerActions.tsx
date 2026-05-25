import { Button } from '@payloadcms/ui';
import type { AIGenerationRunSummary } from '../../ai-types';
import { isFailedOutcome } from './utils';

/**
 * Primary action area for initial generation, follow-ups, cancellation, and retry-fix.
 *
 * @param props.isGenerating - Whether a stream is currently active.
 * @param props.hasHistory - Whether the prompt already has conversation history.
 * @param props.instructions - Primary instruction text used for the first generation.
 * @param props.followup - Current follow-up text.
 * @param props.lastRun - Persisted run metadata used to expose retry repair.
 * @param props.title - Current prompt title for context.
 * @param props.onCancel - Cancels the active request.
 * @param props.onGenerate - Starts the requested generation mode.
 */
export const ComposerActions = ({
  followup,
  hasHistory,
  instructions,
  isGenerating,
  lastRun,
  onCancel,
  onGenerate,
  title,
}: {
  followup: string;
  hasHistory: boolean;
  instructions: string;
  isGenerating: boolean;
  lastRun: AIGenerationRunSummary | null;
  onCancel: () => void;
  onGenerate: (mode: 'followup' | 'generate' | 'retry-fix') => void;
  title?: string;
}) => (
  <div
    style={{
      alignItems: 'flex-start',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
    }}
  >
    <div style={{ color: 'var(--theme-elevation-700)', fontSize: '0.875rem' }}>
      Current title: {title?.trim() ? title : 'Untitled block prompt'}
    </div>
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        width: '100%',
      }}
    >
      {isGenerating ? (
        <Button buttonStyle="secondary" onClick={onCancel}>
          Cancel
        </Button>
      ) : null}
      {!hasHistory ? (
        <Button
          disabled={isGenerating || !instructions.trim()}
          onClick={() => onGenerate('generate')}
        >
          {isGenerating ? 'Generating…' : 'Generate HTML Block'}
        </Button>
      ) : (
        <Button disabled={isGenerating || !followup.trim()} onClick={() => onGenerate('followup')}>
          {isGenerating ? 'Sending…' : 'Send Follow Up'}
        </Button>
      )}
      {isFailedOutcome(lastRun) ? (
        <Button
          buttonStyle="secondary"
          disabled={isGenerating}
          onClick={() => onGenerate('retry-fix')}
        >
          Continue Retry Fix
        </Button>
      ) : null}
    </div>
  </div>
);
