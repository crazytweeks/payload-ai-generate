'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { extractPlanFromMessage } from './planExtract';
import type { ComposerMode, ComposerPlan, ReferenceRow } from './types';

type Params = {
  onPlanReady: (plan: ComposerPlan | null) => void;
  onModeChange: (mode: ComposerMode) => void;
  refsRef: React.MutableRefObject<ReferenceRow[]>;
  presetIdRef: React.MutableRefObject<string>;
  sessionIdRef: React.MutableRefObject<string>;
};

export const usePlanChat = ({
  onPlanReady,
  onModeChange,
  refsRef,
  presetIdRef,
  sessionIdRef,
}: Params) => {
  const buildRefBody = useCallback(
    () =>
      refsRef.current
        .filter((r) => r.collection.trim())
        .map((r) => ({
          collection: r.collection,
          dataLoading: 'server',
          isBeingUsed: true,
          limit: r.limit,
        })),
    [refsRef]
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/ai-generate/composer',
        prepareSendMessagesRequest: async ({ messages }) => ({
          body: {
            messages,
            references: buildRefBody(),
            presetId: presetIdRef.current || undefined,
            sessionId: sessionIdRef.current || undefined,
          },
        }),
      }),
    [buildRefBody, presetIdRef, sessionIdRef]
  );

  const { messages, sendMessage, status, stop } = useChat({ transport });

  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current !== 'ready' && status === 'ready' && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === 'assistant') {
        onPlanReady(extractPlanFromMessage(last));
        onModeChange('plan-ready');
      }
    }
    prevStatus.current = status;
  }, [status, messages, onPlanReady, onModeChange]);

  const isStreaming = status === 'streaming' || status === 'submitted';

  return { messages, sendMessage, status, stop, isStreaming };
};
