import { Banner, Collapsible, CopyToClipboard, Pill } from '@payloadcms/ui';
import { ConversationHistory } from './ConversationHistory';
import type { ActivityItem, ComposerViewModel } from './types';
import { getActivityKey, outcomeLabels } from './utils';

const activityPillStyleByKind: Record<
  ActivityItem['kind'],
  'dark' | 'error' | 'light-gray' | 'success' | 'warning'
> = {
  error: 'error',
  reference: 'success',
  repair: 'warning',
  status: 'light-gray',
  'tool-call': 'dark',
  'tool-result': 'success',
};

const ActivityCardActions = ({ value }: { value?: string }) => {
  if (!value) {
    return null;
  }

  return (
    <CopyToClipboard defaultMessage="Copy details" successMessage="Details copied" value={value} />
  );
};

const ActivityCard = ({ item }: { item: ActivityItem }) => {
  return (
    <Collapsible
      actions={<ActivityCardActions value={item.detail} />}
      collapsibleStyle={item.kind === 'error' ? 'error' : 'default'}
      disableHeaderToggle={!item.detail}
      disableToggleIndicator={!item.detail}
      header={
        <div
          style={{
            alignItems: 'center',
            display: 'flex',
            gap: '0.5rem',
          }}
        >
          <Pill pillStyle={activityPillStyleByKind[item.kind]} size="small">
            {item.kind}
          </Pill>
          <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>{item.label}</div>
        </div>
      }
      initCollapsed={Boolean(item.detail)}
    >
      {item.detail ? (
        <div
          style={{
            color: 'var(--theme-elevation-700)',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            overflowWrap: 'anywhere',
            paddingTop: '0.5rem',
            whiteSpace: 'pre-wrap',
          }}
        >
          {item.detail}
        </div>
      ) : null}
    </Collapsible>
  );
};

const EMPTY_TRANSCRIPT = 'No transcript yet.';

const RawTranscriptCardActions = ({ value }: { value: string }) => {
  if (!value || value === EMPTY_TRANSCRIPT) {
    return null;
  }

  return (
    <CopyToClipboard
      defaultMessage="Copy transcript"
      successMessage="Transcript copied"
      value={value}
    />
  );
};

/**
 * Renders the last-run summary, recent conversation messages, activity feed, and transcript.
 *
 * @param props.viewModel - Current computed state for the composer UI.
 */
export const RunActivityPanel = ({
  viewModel,
}: {
  viewModel: Pick<
    ComposerViewModel,
    | 'activity'
    | 'currentOutcome'
    | 'messages'
    | 'modelLabel'
    | 'outcomeColor'
    | 'providerLabel'
    | 'rawTranscript'
  >;
}) => {
  const transcriptValue = viewModel.rawTranscript || EMPTY_TRANSCRIPT;

  return (
    <div
      style={{
        background: 'var(--theme-elevation-50)',
        border: '1px solid var(--theme-elevation-150)',
        borderRadius: '0.75rem',
        display: 'grid',
        gap: '0.875rem',
        padding: '0.875rem',
      }}
    >
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ alignItems: 'center', display: 'flex', gap: '0.5rem' }}>
          <strong>Last Run</strong>
          <Pill
            pillStyle={viewModel.currentOutcome?.startsWith('failed') ? 'error' : 'success'}
            size="small"
          >
            {viewModel.currentOutcome ? outcomeLabels[viewModel.currentOutcome] : 'Idle'}
          </Pill>
        </div>
        <div style={{ color: 'var(--theme-elevation-700)', fontSize: '0.8125rem' }}>
          {viewModel.providerLabel ? `Provider: ${viewModel.providerLabel}` : 'Provider: pending'}
          {' · '}
          {viewModel.modelLabel ? `Model: ${viewModel.modelLabel}` : 'Model: pending'}
        </div>
      </div>

      <ConversationHistory messages={viewModel.messages} />

      <div
        style={{
          display: 'grid',
          gap: '0.5rem',
          maxHeight: '14rem',
          overflowY: 'auto',
        }}
      >
        {viewModel.activity.length > 0 ? (
          viewModel.activity.map((item) => <ActivityCard item={item} key={getActivityKey(item)} />)
        ) : (
          <Banner type="info">
            Start a generation to see live model activity, repair attempts, and tool usage.
          </Banner>
        )}
      </div>

      <Collapsible header="Raw Transcript" initCollapsed={true}>
        <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.5rem' }}>
          <div
            style={{
              alignItems: 'center',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <RawTranscriptCardActions value={transcriptValue} />
          </div>
          <div
            style={{
              background: 'var(--theme-bg)',
              border: '1px solid var(--theme-elevation-100)',
              borderRadius: '0.5rem',
              color: 'var(--theme-elevation-800)',
              fontFamily: 'monospace',
              fontSize: '0.75rem',
              maxHeight: '8rem',
              minHeight: '4rem',
              overflowY: 'auto',
              padding: '0.75rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {transcriptValue}
          </div>
        </div>
      </Collapsible>
    </div>
  );
};
