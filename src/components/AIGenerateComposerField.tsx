'use client';

import { useAllFormFields, useConfig, useField, useFormFields } from '@payloadcms/ui';
import type { UIFieldClientComponent, UIFieldClientProps } from 'payload';
import { reduceFieldsToValues } from 'payload/shared';
import type { AIConversationMessage, AIGenerationRunSummary } from '../ai-types';
import { ComposerView } from './ai-composer/ComposerView';
import type { ComposerFieldProps, RelationshipValue } from './ai-composer/types';
import { useComposerController } from './ai-composer/useComposerController';

export const AIGenerateComposerField = ((props: UIFieldClientProps) => {
  const { field } = props;
  const {
    attachmentsFieldPath,
    blockPayloadFieldPath,
    cssFieldPath,
    dataJsonFieldPath,
    htmlFieldPath,
    instructionsFieldPath,
    jsFieldPath,
    lastRunFieldPath,
    messagesFieldPath,
    presetFieldPath,
    referencesFieldPath,
    titleFieldPath,
    variablesJsonFieldPath,
  } = props as ComposerFieldProps;

  const { config } = useConfig();

  const { setValue: setHtmlValue, value: htmlValue } = useField<string>({ path: htmlFieldPath });
  const { setValue: setCssValue, value: cssValue } = useField<string>({ path: cssFieldPath });
  const { setValue: setJsValue, value: jsValue } = useField<string>({ path: jsFieldPath });
  const { setValue: setVariablesJSONValue, value: variablesJSONValue } = useField<string>({
    path: variablesJsonFieldPath,
  });
  const { setValue: setDataJSONValue, value: dataJSONValue } = useField<string>({
    path: dataJsonFieldPath,
  });
  const { setValue: setBlockPayloadValue } = useField<string>({
    path: blockPayloadFieldPath,
  });
  const { setValue: setMessagesValue, value: messagesValue } = useField<AIConversationMessage[]>({
    path: messagesFieldPath,
  });
  const { setValue: setLastRunValue, value: lastRunValue } =
    useField<AIGenerationRunSummary | null>({
      path: lastRunFieldPath,
    });

  const { value: instructionsValue } = useField<string>({
    path: instructionsFieldPath,
  });

  const title = useFormFields(([fields]) => fields[titleFieldPath]?.value as string | undefined);
  const attachmentsValue = useFormFields(([fields]) =>
    attachmentsFieldPath ? fields[attachmentsFieldPath]?.value : undefined
  );
  const presetValue = useFormFields(
    ([fields]) => fields[presetFieldPath]?.value as RelationshipValue
  );
  const [formFields] = useAllFormFields();
  const formValues = reduceFieldsToValues(formFields, true);
  const referencesValue =
    referencesFieldPath && referencesFieldPath in formValues
      ? formValues[referencesFieldPath]
      : undefined;
  const selectedAttachments = Array.isArray(attachmentsValue) ? attachmentsValue : [];

  const endpointURL = `${config.routes.api}/ai-generate/stream`;
  const fieldLabel = typeof field.label === 'string' ? field.label : 'AI Composer';
  const { handleCancel, handleGenerate, path, setFollowup, viewModel } = useComposerController({
    attachmentsValue,
    cssValue,
    dataJSONValue,
    endpointURL,
    fieldLabel,
    htmlValue,
    instructionsValue,
    jsValue,
    lastRunValue,
    messagesValue,
    path: props.path,
    presetValue,
    referencesValue,
    selectedAttachments,
    setBlockPayloadValue,
    setCssValue,
    setDataJSONValue,
    setHtmlValue,
    setJsValue,
    setLastRunValue,
    setMessagesValue,
    setVariablesJSONValue,
    title,
    variablesJSONValue,
  });

  return (
    <ComposerView
      attachmentsEnabled={Boolean(attachmentsFieldPath)}
      followupInputId={`${path}-followup`}
      onCancel={handleCancel}
      onGenerate={handleGenerate}
      setFollowup={setFollowup}
      viewModel={viewModel}
    />
  );
}) satisfies UIFieldClientComponent;
