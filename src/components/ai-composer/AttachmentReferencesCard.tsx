import { Banner, Pill } from '@payloadcms/ui';
import { getAttachmentKey, getAttachmentLabel } from './utils';

/**
 * Renders the selected attachments that will be sent with the next AI request.
 *
 * @param props.attachments - Current attachment values from the form state.
 */
export const AttachmentReferencesCard = ({ attachments }: { attachments: unknown[] }) => (
  <div
    style={{
      display: 'grid',
      gap: '0.5rem',
    }}
  >
    <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>Selected References</div>
    {attachments.length > 0 ? (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {attachments.map((attachment, index) => {
          const label = getAttachmentLabel(attachment, index);

          return (
            <Pill key={getAttachmentKey(attachment, index)} pillStyle="light-gray" size="small">
              {label}
            </Pill>
          );
        })}
      </div>
    ) : (
      <Banner type="info">No reference files selected.</Banner>
    )}
  </div>
);
