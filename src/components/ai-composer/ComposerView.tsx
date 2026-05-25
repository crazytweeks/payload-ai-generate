import { Banner } from '@payloadcms/ui';
import type { Dispatch, SetStateAction } from 'react';
import { AttachmentReferencesCard } from './AttachmentReferencesCard';
import { ComposerActions } from './ComposerActions';
import { FollowupInput } from './FollowupInput';
import { PrimaryInstructionsCard } from './PrimaryInstructionsCard';
import { RunActivityPanel } from './RunActivityPanel';
import type { ComposerViewModel } from './types';

/**
 * Presentational shell for the Payload AI composer field.
 *
 * @param props.attachmentsEnabled - Whether the prompt supports uploaded references.
 * @param props.followupInputId - Stable DOM id for the follow-up textarea.
 * @param props.onCancel - Cancels the active generation request.
 * @param props.onGenerate - Starts the requested generation mode.
 * @param props.setFollowup - React state setter for the follow-up input.
 * @param props.viewModel - Computed UI state from the controller hook.
 */
export const ComposerView = ({
  attachmentsEnabled,
  followupInputId,
  onCancel,
  onGenerate,
  setFollowup,
  viewModel,
}: {
  attachmentsEnabled: boolean;
  followupInputId: string;
  onCancel: () => void;
  onGenerate: (mode: 'followup' | 'generate' | 'retry-fix') => void;
  setFollowup: Dispatch<SetStateAction<string>>;
  viewModel: ComposerViewModel;
}) => (
  <div
    className="field-type"
    style={{
      border: '1px solid var(--theme-elevation-150)',
      borderRadius: '0.75rem',
      marginBottom: '1.5rem',
      overflow: 'hidden',
      padding: '1rem',
    }}
  >
    <div style={{ display: 'grid', gap: '0.875rem', width: '100%' }}>
      <div style={{ fontSize: '1rem', fontWeight: 700 }}>{viewModel.fieldLabel}</div>

      {attachmentsEnabled ? (
        <AttachmentReferencesCard attachments={viewModel.selectedAttachments} />
      ) : null}

      <PrimaryInstructionsCard instructions={viewModel.instructions} />

      {viewModel.shouldShowFollowup ? (
        <FollowupInput
          inputId={followupInputId}
          setValue={setFollowup}
          value={viewModel.followup}
        />
      ) : null}

      <ComposerActions
        followup={viewModel.followup}
        hasHistory={viewModel.hasHistory}
        instructions={viewModel.instructions}
        isGenerating={viewModel.isGenerating}
        lastRun={viewModel.lastRun}
        onCancel={onCancel}
        onGenerate={onGenerate}
        title={viewModel.title}
      />

      <RunActivityPanel viewModel={viewModel} />

      {viewModel.error ? <Banner type="error">{viewModel.error}</Banner> : null}
    </div>
  </div>
);
