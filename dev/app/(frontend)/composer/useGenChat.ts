'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ComposerPlan, GeneratedFile, ReferenceRow } from './types';

type Params = {
  onFilesChange: (files: GeneratedFile[]) => void;
  onGenerationDone: () => void;
  planRef: React.MutableRefObject<ComposerPlan | null>;
  refsRef: React.MutableRefObject<ReferenceRow[]>;
};

export const useGenChat = ({ onFilesChange, onGenerationDone, planRef, refsRef }: Params) => {
  const buildRefBody = useCallback(
    () =>
      refsRef.current
        .filter((r) => r.collection.trim())
        .map((r) => ({ collection: r.collection, dataLoading: 'server', isBeingUsed: true, limit: r.limit })),
    [refsRef]
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/ai-generate/ui-generate',
        prepareSendMessagesRequest: async ({ messages }) => ({
          body: { messages, plan: planRef.current, references: buildRefBody() },
        }),
      }),
    [buildRefBody, planRef]
  );

  const { messages, sendMessage, status, stop } = useChat({ transport });

  // Extract write_file tool results as they arrive
  useEffect(() => {
    const files: GeneratedFile[] = [];
    for (const msg of messages) {
      if (msg.role !== 'assistant') continue;
      for (const part of msg.parts) {
        if (part.type !== 'tool-invocation') continue;
        const ti = part as unknown as {
          args?: GeneratedFile;
          result?: unknown;
          state: string;
          toolName: string;
          type: 'tool-invocation';
        };
        if (ti.toolName === 'write_file' && ti.state === 'result' && ti.args) {
          files.push(ti.args);
        }
      }
    }
    if (files.length > 0) onFilesChange(files);
  }, [messages, onFilesChange]);

  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current !== 'ready' && status === 'ready' && messages.length > 0) {
      onGenerationDone();
    }
    prevStatus.current = status;
  }, [status, messages, onGenerationDone]);

  const isStreaming = status === 'streaming' || status === 'submitted';

  return { messages, sendMessage, status, stop, isStreaming };
};
