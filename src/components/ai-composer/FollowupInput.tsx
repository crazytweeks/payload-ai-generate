import { FieldLabel, TextareaInput } from '@payloadcms/ui';
import type { Dispatch, SetStateAction } from 'react';

/**
 * Follow-up textarea used once a prompt already has history or generated output.
 *
 * @param props.inputId - Stable HTML id for textarea and label association.
 * @param props.value - Current follow-up text.
 * @param props.setValue - React state setter for the follow-up text.
 */
export const FollowupInput = ({
  inputId,
  setValue,
  value,
}: {
  inputId: string;
  setValue: Dispatch<SetStateAction<string>>;
  value: string;
}) => (
  <div style={{ display: 'grid', gap: '0.5rem' }}>
    <FieldLabel htmlFor={inputId} label="Follow-up Message" required={false} />
    <TextareaInput
      onChange={(event) => setValue(event.target.value)}
      path={inputId}
      placeholder="Ask for a small update to the existing generated code."
      rows={5}
      showError={false}
      style={{
        maxWidth: '100%',
        minWidth: 0,
        width: '100%',
      }}
      value={value}
      valueToRender={value}
    />
  </div>
);
