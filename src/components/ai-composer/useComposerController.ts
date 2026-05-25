'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useMemo, useRef, useState } from 'react';
import type {
  AIConversationMessage,
  AIGenerationEvent,
  AIGenerationOutcome,
  AIGenerationRunSummary,
} from '../../ai-types';
import type { ActivityItem, ComposerViewModel, RelationshipValue } from './types';
import { getRelationshipID } from './utils';

/**
 * Controller dependencies required to run the AI composer.
 */
type ComposerControllerParams = {
  attachmentsValue: unknown;
  cssValue?: string;
  dataJSONValue?: string;
  endpointURL: string;
  fieldLabel: string;
  htmlValue?: string;
  instructionsValue?: string;
  jsValue?: string;
  lastRunValue: AIGenerationRunSummary | null | undefined;
  messagesValue: AIConversationMessage[] | undefined;
  path: string;
  presetValue: RelationshipValue;
  selectedAttachments: unknown[];
  setBlockPayloadValue: (value: string) => void;
  setCssValue: (value: string) => void;
  setDataJSONValue: (value: string) => void;
  setHtmlValue: (value: string) => void;
  setJsValue: (value: string) => void;
  setLastRunValue: (value: AIGenerationRunSummary) => void;
  setMessagesValue: (value: AIConversationMessage[]) => void;
  setVariablesJSONValue: (value: string) => void;
  title?: string;
  variablesJSONValue?: string;
};

const appendActivity = (setter: Dispatch<SetStateAction<ActivityItem[]>>, item: ActivityItem) =>
  setter((previous) => [...previous, item]);

/**
 * Hook that owns the client-side orchestration for the AI composer field.
 *
 * @param params - Current form values, field setters, and endpoint metadata.
 * @returns View model plus UI event handlers for the composer.
 *
 * @example
 * ```ts
 * const controller = useComposerController({
 *   endpointURL,
 *   fieldLabel,
 *   instructionsValue,
 *   lastRunValue,
 *   messagesValue,
 *   path,
 *   presetValue,
 *   selectedAttachments,
 *   setCssValue,
 *   setHtmlValue,
 *   setJsValue,
 *   setLastRunValue,
 *   setMessagesValue,
 *   setVariablesJSONValue,
 * });
 * ```
 */
export const useComposerController = ({
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
  path,
  presetValue,
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
}: ComposerControllerParams) => {
  const instructions = instructionsValue ?? '';
  const messages = Array.isArray(messagesValue) ? messagesValue : [];
  const lastRun = lastRunValue ?? null;
  const hasHistory = messages.length > 0;

  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingUserMessageRef = useRef<AIConversationMessage | null>(null);

  const [followup, setFollowup] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [providerLabel, setProviderLabel] = useState<string | null>(lastRun?.provider ?? null);
  const [modelLabel, setModelLabel] = useState<string | null>(lastRun?.modelId ?? null);
  const [rawTranscript, setRawTranscript] = useState('');
  const [currentOutcome, setCurrentOutcome] = useState<AIGenerationOutcome | null>(
    lastRun?.outcome ?? null
  );

  const outcomeColor = useMemo(() => {
    if (!currentOutcome) {
      return 'var(--theme-elevation-700)';
    }

    if (currentOutcome.startsWith('failed')) {
      return 'var(--theme-error-500)';
    }

    return 'var(--theme-success-500)';
  }, [currentOutcome]);

  const shouldShowFollowup =
    hasHistory || Boolean(htmlValue?.trim() || cssValue?.trim() || jsValue?.trim());

  const buildRequestArtifact = () => ({
    css: cssValue ?? '',
    dataJSON: dataJSONValue ?? '{}',
    html: htmlValue ?? '',
    js: jsValue ?? '',
    variablesJSON: variablesJSONValue ?? '[]',
  });

  const persistConversationResult = ({
    assistantContent,
    run,
  }: {
    assistantContent: string;
    run: AIGenerationRunSummary;
  }) => {
    const assistantSource: 'followup' | 'repair' =
      run.repairAttemptsUsed > 0 ? 'repair' : 'followup';

    const nextMessages = [
      ...messages,
      ...(pendingUserMessageRef.current ? [pendingUserMessageRef.current] : []),
      {
        content: assistantContent,
        createdAt: new Date().toISOString(),
        metadata: {
          modelId: run.modelId,
          outcome: run.outcome,
          provider: run.provider,
          repairAttempt: run.repairAttemptsUsed,
          source: assistantSource,
        },
        role: 'assistant' as const,
      },
    ];

    setMessagesValue(nextMessages);
    setLastRunValue(run);
    setCurrentOutcome(run.outcome);
    pendingUserMessageRef.current = null;
  };

  const applyGenerationEvent = (event: AIGenerationEvent) => {
    switch (event.type) {
      case 'status':
        if (event.provider) {
          setProviderLabel(event.provider);
        }

        if (event.modelId) {
          setModelLabel(event.modelId);
        }

        appendActivity(setActivity, {
          detail: event.message,
          kind: event.stage === 'repairing' ? 'repair' : 'status',
          label:
            event.stage === 'repairing'
              ? `Repairing${typeof event.attempt === 'number' ? ` (${event.attempt}/${event.maxAttempts})` : ''}`
              : event.stage.charAt(0).toUpperCase() + event.stage.slice(1).replace(/-/g, ' '),
        });
        break;

      case 'repair-start':
        appendActivity(setActivity, {
          detail: event.reason,
          kind: 'repair',
          label: `Repair Attempt ${event.attempt}/${event.maxAttempts}`,
        });
        break;

      case 'repair-result':
        appendActivity(setActivity, {
          detail: event.message,
          kind: event.fixed ? 'repair' : 'error',
          label: event.fixed ? 'Repair Succeeded' : `Repair Attempt ${event.attempt} Failed`,
        });
        break;

      case 'tool-call':
        appendActivity(setActivity, {
          detail: event.summary,
          kind: 'tool-call',
          label: `Tool: ${event.toolName}`,
        });
        break;

      case 'tool-result':
        appendActivity(setActivity, {
          detail: event.summary,
          kind: 'tool-result',
          label: `Tool Result: ${event.toolName}`,
        });
        break;

      case 'references':
        appendActivity(setActivity, {
          detail: event.items
            .map((item) => `${item.label}${item.mimeType ? ` [${item.mimeType}]` : ''}`)
            .join('\n'),
          kind: 'reference',
          label: `References (${event.items.length})`,
        });
        break;

      case 'field-update':
        if (event.field === 'html') {
          setHtmlValue(event.value);
        } else if (event.field === 'css') {
          setCssValue(event.value);
        } else if (event.field === 'js') {
          setJsValue(event.value);
        } else if (event.field === 'variablesJSON') {
          setVariablesJSONValue(event.value);
        } else if (event.field === 'dataJSON') {
          setDataJSONValue(event.value);
        } else if (event.field === 'blockPayloadJSON') {
          setBlockPayloadValue(event.value);
        }
        break;

      case 'text-delta':
        setRawTranscript((previous) => previous + event.value);
        break;

      case 'final':
        setHtmlValue(event.html);
        setCssValue(event.css);
        setJsValue(event.js);
        setVariablesJSONValue(event.variablesJSON);
        setDataJSONValue(event.dataJSON);
        setBlockPayloadValue(JSON.stringify(event.blockPayload, null, 2));
        persistConversationResult({
          assistantContent: JSON.stringify(event.blockPayload, null, 2),
          run: event.run,
        });
        break;

      case 'error':
        setError(event.message);
        if (event.run) {
          setLastRunValue(event.run);
          setCurrentOutcome(event.run.outcome);
        }
        appendActivity(setActivity, {
          detail: event.message,
          kind: 'error',
          label: 'Generation Failed',
        });
        break;

      default:
        break;
    }
  };

  const parseNDJSONStream = async (response: Response) => {
    if (!response.body) {
      throw new Error('AI stream did not return a readable body.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
          continue;
        }

        applyGenerationEvent(JSON.parse(trimmed) as AIGenerationEvent);
      }
    }

    if (buffer.trim()) {
      applyGenerationEvent(JSON.parse(buffer.trim()) as AIGenerationEvent);
    }
  };

  const handleGenerate = async (mode: 'followup' | 'generate' | 'retry-fix') => {
    setError(null);
    setIsGenerating(true);
    setActivity([]);
    setRawTranscript('');

    const followupMessage =
      mode === 'retry-fix'
        ? 'Fix the previous generation using the current artifact and the last reported error.'
        : followup.trim();

    pendingUserMessageRef.current = {
      content: mode === 'generate' ? instructions : followupMessage,
      createdAt: new Date().toISOString(),
      metadata: {
        source: mode === 'generate' ? 'instructions' : mode === 'retry-fix' ? 'repair' : 'followup',
      },
      role: 'user',
    };

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch(endpointURL, {
        body: JSON.stringify({
          attachments: Array.isArray(attachmentsValue) ? attachmentsValue : [],
          currentArtifact: buildRequestArtifact(),
          followup: followupMessage,
          instructions,
          messages,
          mode,
          presetId: getRelationshipID(presetValue),
          stream: true,
          title,
        }),
        headers: {
          Accept: 'application/x-ndjson',
          'Content-Type': 'application/json',
        },
        method: 'POST',
        signal: abortController.signal,
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? 'AI generation failed.');
      }

      await parseNDJSONStream(response);

      if (mode !== 'generate') {
        setFollowup('');
      }
    } catch (caughtError) {
      if (abortController.signal.aborted) {
        appendActivity(setActivity, {
          kind: 'status',
          label: 'Cancelled',
        });
      } else {
        const message =
          caughtError instanceof Error ? caughtError.message : 'AI generation failed.';
        setError(message);
        setLastRunValue({
          lastError: message,
          maxRepairAttempts: lastRun?.maxRepairAttempts ?? 3,
          modelId: modelLabel ?? 'unknown',
          outcome: 'failed-no-usable-output',
          provider: providerLabel === 'openai' ? 'openai' : 'google',
          repairAttemptsUsed: lastRun?.repairAttemptsUsed ?? 0,
        });
      }
    } finally {
      abortControllerRef.current = null;
      pendingUserMessageRef.current = null;
      setIsGenerating(false);
    }
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
  };

  const viewModel: ComposerViewModel = {
    activity,
    currentOutcome,
    error,
    fieldLabel,
    followup,
    hasHistory,
    instructions,
    isGenerating,
    lastRun,
    messages,
    modelLabel,
    outcomeColor,
    providerLabel,
    rawTranscript,
    selectedAttachments,
    shouldShowFollowup,
    title,
  };

  return {
    handleCancel,
    handleGenerate,
    path,
    setFollowup,
    viewModel,
  };
};
