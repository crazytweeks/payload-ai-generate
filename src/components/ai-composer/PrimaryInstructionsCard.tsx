import { CopyToClipboard } from '@payloadcms/ui';

/**
 * Displays the persisted primary prompt stored on the AI prompt document.
 *
 * @param props.instructions - Main prompt text from the document.
 */
export const PrimaryInstructionsCard = ({ instructions }: { instructions: string }) => (
  <div
    style={{
      display: 'grid',
      gap: '0.5rem',
    }}
  >
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        gap: '0.5rem',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>Primary Instructions</div>
      {instructions ? (
        <CopyToClipboard
          defaultMessage="Copy prompt"
          successMessage="Prompt copied"
          value={instructions}
        />
      ) : null}
    </div>
    <div
      style={{
        color: 'var(--theme-elevation-700)',
        fontSize: '0.875rem',
        lineHeight: 1.5,
        overflowWrap: 'anywhere',
        whiteSpace: 'pre-wrap',
      }}
    >
      {instructions || 'No primary instructions yet.'}
    </div>
  </div>
);
