'use client';

import { useChat } from '@ai-sdk/react';
import { CodeBlock } from '../composer/components/CodeBlock';
import { FileTree } from '../composer/components/FileTree';
import { PlanView } from '../composer/components/PlanView';
import { extractPlanFromMessage } from '../composer/planExtract';
import { buildComposerUISrcDoc } from '../../composer-ui';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Code2, Eye, FileCode2, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
  Message,
  MessageContent,
  MessageResponse,
  PromptInput,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  ToolCard,
  WebPreview,
  WebPreviewBody,
  WebPreviewNavigation,
  WebPreviewUrl,
} from './components/ai-elements';
import { SessionsSidebar } from './components/SessionsSidebar';
import type { ComposerMode, ComposerPlan, GeneratedFile, ReferenceRow } from './types';

type Props = {
  presets: { id: string; title: string }[];
  referenceCollections: string[];
};

type ToolishPart = {
  args?: unknown;
  errorText?: string;
  input?: unknown;
  output?: unknown;
  result?: unknown;
  state?: string;
  toolName?: string;
  type: string;
};

const isGeneratedFile = (value: unknown): value is GeneratedFile => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<GeneratedFile>;
  const languages = ['css', 'html', 'javascript', 'json', 'tsx', 'typescript'];
  return (
    typeof candidate.content === 'string' &&
    typeof candidate.path === 'string' &&
    typeof candidate.language === 'string' &&
    languages.includes(candidate.language)
  );
};

const extractToolParts = (messages: UIMessage[]) =>
  messages.flatMap((message) =>
    message.parts
      .filter((part) => part.type === 'tool-invocation' || part.type.startsWith('tool-'))
      .map((part) => part as unknown as ToolishPart)
  );

const extractGeneratedFiles = (messages: UIMessage[]) => {
  const files = new Map<string, GeneratedFile>();
  let composerUiId: string | undefined;

  for (const part of extractToolParts(messages)) {
    const toolName = part.toolName ?? part.type.replace(/^tool-/, '');
    if (toolName !== 'write_file') continue;

    const candidate = part.input ?? part.args;
    const output = part.output ?? part.result;
    if (isGeneratedFile(candidate)) {
      files.set(candidate.path, {
        ...candidate,
        isEntryPoint: Boolean(candidate.isEntryPoint),
      });
    }
    if (output && typeof output === 'object' && 'composerUiId' in output) {
      const id = (output as { composerUiId?: unknown }).composerUiId;
      if (typeof id === 'string') composerUiId = id;
    }
  }

  return { composerUiId, files: Array.from(files.values()) };
};

const referencesToBody = (references: ReferenceRow[]) =>
  references
    .filter((reference) => reference.collection.trim())
    .map((reference) => ({
      collection: reference.collection,
      dataLoading: 'server' as const,
      isBeingUsed: true,
      limit: reference.limit,
    }));

const statusLabel: Record<ComposerMode, string> = {
  generated: 'Generated',
  generating: 'Generating',
  idle: 'Ready',
  planning: 'Planning',
  'plan-ready': 'Plan ready',
  refining: 'Refining',
};

function ChatStream({ messages }: { messages: UIMessage[] }) {
  const toolParts = extractToolParts(messages);

  return (
    <Conversation>
      <ConversationContent>
        {messages.length === 0 ? (
          <ConversationEmptyState
            description="Describe the page, choose references, then generate. Planning and tool calls appear here."
            icon={<MessageSquare size={34} />}
            title="Composer v2"
          />
        ) : (
          messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                {message.parts.map((part) => {
                  const key = `${message.id}-${part.type}-${'text' in part ? part.text.slice(0, 48) : ''}`;
                  if (part.type === 'text') {
                    return <MessageResponse key={key}>{part.text}</MessageResponse>;
                  }
                  if (part.type === 'reasoning') {
                    return (
                      <p className="text-xs text-zinc-500" key={key}>
                        {part.text}
                      </p>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))
        )}
        {toolParts.map((part) => {
          const name = part.toolName ?? part.type.replace(/^tool-/, '');
          const key = `${name}-${part.state ?? 'state'}-${(JSON.stringify(part.input ?? part.args) ?? '').slice(0, 80)}`;
          return (
            <ToolCard
              input={part.input ?? part.args}
              key={key}
              name={name}
              output={part.output ?? part.result ?? part.errorText}
              state={part.state}
            />
          );
        })}
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}

function ReferencePicker({
  collections,
  references,
  setReferences,
}: {
  collections: string[];
  references: ReferenceRow[];
  setReferences: React.Dispatch<React.SetStateAction<ReferenceRow[]>>;
}) {
  return (
    <section className="border-t border-zinc-800 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase text-zinc-500">References</h2>
        <button
          className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-300"
          onClick={() =>
            setReferences((current) => [
              ...current,
              { collection: collections[0] ?? '', id: crypto.randomUUID(), limit: 10 },
            ])
          }
          type="button"
        >
          <Plus size={13} />
          Add
        </button>
      </div>
      <div className="space-y-2">
        {references.map((reference) => (
          <div className="grid grid-cols-[1fr_64px_28px] gap-2" key={reference.id}>
            <select
              className="h-9 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200"
              onChange={(event) =>
                setReferences((current) =>
                  current.map((item) =>
                    item.id === reference.id ? { ...item, collection: event.target.value } : item
                  )
                )
              }
              value={reference.collection}
            >
              {collections.map((collection) => (
                <option key={collection} value={collection}>
                  {collection}
                </option>
              ))}
            </select>
            <input
              className="h-9 rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200"
              min={1}
              onChange={(event) =>
                setReferences((current) =>
                  current.map((item) =>
                    item.id === reference.id
                      ? { ...item, limit: Number(event.target.value) || 1 }
                      : item
                  )
                )
              }
              type="number"
              value={reference.limit}
            />
            <button
              aria-label="Remove reference"
              className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-800 text-zinc-500"
              onClick={() =>
                setReferences((current) => current.filter((item) => item.id !== reference.id))
              }
              type="button"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function CodeAndPreview({
  composerUiId,
  files,
  isGenerating,
}: {
  composerUiId?: string;
  files: GeneratedFile[];
  isGenerating: boolean;
}) {
  const [activePath, setActivePath] = useState<string | undefined>();
  const [view, setView] = useState<'code' | 'preview'>('preview');
  const activeFile =
    files.find((file) => file.path === activePath) ??
    files.find((file) => file.isEntryPoint) ??
    files[0];
  const srcDoc = useMemo(() => buildComposerUISrcDoc(files), [files]);
  const previewPath = composerUiId ? `/preview/ai-composer-ui/${composerUiId}` : 'live srcdoc';

  if (files.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-zinc-600">
        <FileCode2 size={34} />
        <p className="mt-2 text-sm">
          {isGenerating ? 'Waiting for write_file...' : 'No files yet'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-zinc-800 px-3">
        <button
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${view === 'preview' ? 'bg-cyan-500 text-zinc-950' : 'text-zinc-400'}`}
          onClick={() => setView('preview')}
          type="button"
        >
          <Eye size={14} />
          Preview
        </button>
        <button
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs ${view === 'code' ? 'bg-cyan-500 text-zinc-950' : 'text-zinc-400'}`}
          onClick={() => setView('code')}
          type="button"
        >
          <Code2 size={14} />
          Code
        </button>
        <span className="ml-auto text-xs text-zinc-500">{files.length} files</span>
      </div>
      {view === 'preview' ? (
        <div className="min-h-0 flex-1 p-3">
          <WebPreview>
            <WebPreviewNavigation>
              <WebPreviewUrl value={previewPath} />
            </WebPreviewNavigation>
            <WebPreviewBody srcDoc={srcDoc} title="Composer v2 live preview" />
          </WebPreview>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr]">
          <div className="min-h-0 border-r border-zinc-800 bg-zinc-950">
            <FileTree
              activeFile={activeFile?.path}
              files={files.map((file) => file.path)}
              onSelect={setActivePath}
            />
          </div>
          <div className="min-h-0">
            {activeFile ? (
              <CodeBlock code={activeFile.content} language={activeFile.language} />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

type AiComposerSession = {
  firstPrompt: string;
  id: string;
  messages?: unknown;
  plan?: unknown;
  referenceCollections?:
    | {
        collection: string;
        dataLoading: 'client' | 'server';
        id?: string | null;
        isBeingUsed?: boolean | null;
        limit?: number | null;
      }[]
    | null;
  preset?: string | null | { id: string };
  title: string;
};

export function ComposerV2Client({ presets, referenceCollections }: Props) {
  const [firstPrompt, setFirstPrompt] = useState('');
  const [refinement, setRefinement] = useState('');
  const [presetId, setPresetId] = useState('');
  const [references, setReferences] = useState<ReferenceRow[]>(
    referenceCollections.slice(0, 4).map((collection) => ({
      collection,
      id: crypto.randomUUID(),
      limit: 10,
    }))
  );
  const [mediaRefs, setMediaRefs] = useState<
    { id: string; url: string; alt: string; mediaId: string }[]
  >([]);
  const [plan, setPlan] = useState<ComposerPlan | null>(null);
  const [mode, setMode] = useState<ComposerMode>('idle');
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [composerSessionId, setComposerSessionId] = useState<string | undefined>();
  const [composerUiId, setComposerUiId] = useState<string | undefined>();

  const refsRef = useRef(references);
  const presetIdRef = useRef(presetId);
  const planRef = useRef(plan);
  const composerSessionIdRef = useRef(composerSessionId);
  const composerUiIdRef = useRef(composerUiId);
  const lastPlanMessageIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    refsRef.current = references;
    presetIdRef.current = presetId;
    planRef.current = plan;
    composerSessionIdRef.current = composerSessionId;
    composerUiIdRef.current = composerUiId;
  }, [composerSessionId, composerUiId, plan, presetId, references]);

  const persistComposerSession = useCallback(
    async ({ messages, nextPlan }: { messages: UIMessage[]; nextPlan: ComposerPlan }) => {
      const response = await fetch('/api/ai-generate/composer-session', {
        body: JSON.stringify({
          composerSessionId: composerSessionIdRef.current,
          firstPrompt,
          messages,
          plan: nextPlan,
          presetId: presetIdRef.current || undefined,
          references: referencesToBody(refsRef.current),
          referenceMedia: mediaRefs.map((m) => m.mediaId),
          title: firstPrompt || undefined,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? 'Failed to save composer session.');
      }

      const payload = (await response.json()) as { id?: string };
      if (payload.id) setComposerSessionId(payload.id);
    },
    [firstPrompt]
  );

  const planTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/ai-generate/composer',
        prepareSendMessagesRequest: async ({ messages }) => ({
          body: {
            messages,
            presetId: presetIdRef.current || undefined,
            references: referencesToBody(refsRef.current),
          },
        }),
      }),
    []
  );
  const planChat = useChat({ transport: planTransport });

  const generationTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/ai-generate/ui-generate-v2',
        prepareSendMessagesRequest: async ({ messages }) => ({
          body: {
            composerSessionId: composerSessionIdRef.current,
            composerUiId: composerUiIdRef.current,
            messages,
            plan: planRef.current,
            references: referencesToBody(refsRef.current),
            sessionTitle: firstPrompt || undefined,
          },
        }),
      }),
    [firstPrompt]
  );
  const generationChat = useChat({ transport: generationTransport });

  useEffect(() => {
    if (planChat.status !== 'ready') return;
    const last = planChat.messages.at(-1);
    if (!last || last.role !== 'assistant') return;
    const extracted = extractPlanFromMessage(last);
    if (!extracted) return;
    if (lastPlanMessageIdRef.current === last.id) return;
    lastPlanMessageIdRef.current = last.id;
    setPlan(extracted);
    setMode('plan-ready');
    persistComposerSession({ messages: planChat.messages, nextPlan: extracted }).catch((error) => {
      console.error(error);
    });
  }, [persistComposerSession, planChat.messages, planChat.status]);

  useEffect(() => {
    const extracted = extractGeneratedFiles(generationChat.messages);
    if (extracted.files.length > 0) setGeneratedFiles(extracted.files);
    if (extracted.composerUiId) setComposerUiId(extracted.composerUiId);
    if (generationChat.status === 'ready' && extracted.files.length > 0) setMode('generated');
  }, [generationChat.messages, generationChat.status]);

  const startPlanning = useCallback(
    (message: PromptInputMessage) => {
      const text = message.text.trim();
      if (!text || planChat.status !== 'ready') return;
      setFirstPrompt(text);
      setPlan(null);
      setComposerSessionId(undefined);
      setComposerUiId(undefined);
      setGeneratedFiles([]);
      lastPlanMessageIdRef.current = undefined;
      setMode('planning');

      const attachments = mediaRefs.map((m) => ({
        type: 'file' as const,
        name: m.alt || 'attachment',
        url: m.url,
        contentType: m.url.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
        mediaType: m.url.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      }));

      planChat.sendMessage({
        text: text,
        files: attachments.length > 0 ? attachments : undefined,
      });
    },
    [planChat, mediaRefs]
  );

  const refinePlan = useCallback(() => {
    if (!refinement.trim()) return;

    if (mode === 'generated' || mode === 'generating') {
      if (generationChat.status !== 'ready') return;
      setMode('generating');
      generationChat.sendMessage({ text: refinement.trim() });
    } else {
      if (planChat.status !== 'ready') return;
      setMode('refining');
      planChat.sendMessage({ text: refinement.trim() });
    }
    setRefinement('');
  }, [planChat, generationChat, refinement, mode]);

  const generateUI = useCallback(() => {
    if (!planRef.current || generationChat.status !== 'ready') return;
    setGeneratedFiles([]);
    setComposerUiId(undefined);
    setMode('generating');
    generationChat.sendMessage({ text: 'Generate the UI now based on the approved plan.' });
  }, [generationChat]);

  const isBusy =
    planChat.status === 'streaming' ||
    planChat.status === 'submitted' ||
    generationChat.status === 'streaming' ||
    generationChat.status === 'submitted';

  const resetSession = useCallback(() => {
    setFirstPrompt('');
    setRefinement('');
    setPlan(null);
    setComposerSessionId(undefined);
    setComposerUiId(undefined);
    setGeneratedFiles([]);
    setMediaRefs([]);
    lastPlanMessageIdRef.current = undefined;
    setMode('idle');
    planChat.setMessages([]);
    generationChat.setMessages([]);
  }, [generationChat, planChat]);

  const loadSession = useCallback(
    async (id: string) => {
      if (
        planChat.status === 'streaming' ||
        planChat.status === 'submitted' ||
        generationChat.status === 'streaming' ||
        generationChat.status === 'submitted'
      )
        return;
      try {
        const res = await fetch(`/api/ai-generate/composer-session/${id}`);
        if (!res.ok) return;
        const data = (await res.json()) as { session: AiComposerSession };
        const session = data.session;

        setFirstPrompt(session.firstPrompt ?? '');
        setRefinement('');
        setComposerSessionId(String(session.id));
        setComposerUiId(undefined);
        setGeneratedFiles([]);
        setMediaRefs([]);
        lastPlanMessageIdRef.current = undefined;

        const loadedPlan = session.plan as ComposerPlan | null | undefined;
        setPlan(loadedPlan ?? null);
        setMode(loadedPlan ? 'plan-ready' : 'idle');

        const msgs = Array.isArray(session.messages) ? (session.messages as UIMessage[]) : [];
        planChat.setMessages(msgs);
        generationChat.setMessages([]);

        if (session.referenceCollections?.length) {
          setReferences(
            session.referenceCollections.map((ref) => ({
              collection: ref.collection,
              id: ref.id ?? crypto.randomUUID(),
              limit: ref.limit ?? 10,
            }))
          );
        }

        const resolvedPreset =
          session.preset && typeof session.preset === 'object' ? session.preset.id : session.preset;
        setPresetId(resolvedPreset ?? '');
      } catch {
        // silently ignore
      }
    },
    [generationChat, planChat]
  );

  const handleUploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('alt', file.name);
    try {
      const res = await fetch('/api/ai-media', { method: 'POST', body: formData });
      if (res.ok) {
        const doc = await res.json();
        setMediaRefs((p) => [
          ...p,
          { id: crypto.randomUUID(), mediaId: doc.doc.id, url: doc.doc.url, alt: file.name },
        ]);
      }
    } catch (err) {
      console.error('Failed to upload media:', err);
    }
  };

  return (
    <div className="flex h-[calc(100vh-45px)] bg-[#101114] text-zinc-100">
      <SessionsSidebar
        activeSessionId={composerSessionId}
        onNewSession={resetSession}
        onSelectSession={(id) => void loadSession(id)}
      />
      <div className="grid min-w-0 flex-1 grid-cols-[320px_minmax(0,1fr)_380px]">
        <aside className="flex min-h-0 flex-col border-r border-zinc-800 bg-[#15171b]">
          <div className="p-4">
            <h1 className="text-base font-semibold">Composer v2</h1>
            <p className="mt-1 text-xs leading-relaxed text-zinc-500">
              Plan, generate, persist, and preview the composed UI.
            </p>
          </div>
          <div className="border-t border-zinc-800 p-4">
            <label
              className="mb-2 block text-xs font-semibold uppercase text-zinc-500"
              htmlFor="preset"
            >
              Preset
            </label>
            <select
              className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 text-xs text-zinc-200"
              id="preset"
              onChange={(event) => setPresetId(event.target.value)}
              value={presetId}
            >
              <option value="">none</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.title}
                </option>
              ))}
            </select>
          </div>
          <ReferencePicker
            collections={referenceCollections}
            references={references}
            setReferences={setReferences}
          />
          <div className="mt-auto border-t border-zinc-800 p-4 text-xs text-zinc-500">
            {statusLabel[mode]} {composerSessionId ? `- session ${composerSessionId}` : ''}
            {composerUiId ? ` - UI ${composerUiId}` : ''}
          </div>
        </aside>

        <main className="grid min-h-0 grid-rows-[minmax(0,42%)_minmax(0,58%)]">
          <section className="flex min-h-0 flex-col border-b border-zinc-800">
            <div className="flex h-11 shrink-0 items-center border-b border-zinc-800 px-4">
              <h2 className="text-xs font-semibold uppercase text-zinc-500">AI stream</h2>
              {isBusy ? <span className="ml-2 text-xs text-cyan-400">working...</span> : null}
            </div>
            <ChatStream messages={[...planChat.messages, ...generationChat.messages]} />
          </section>
          <section className="min-h-0">
            <CodeAndPreview
              composerUiId={composerUiId}
              files={generatedFiles}
              isGenerating={mode === 'generating'}
            />
          </section>
        </main>

        <aside className="flex min-h-0 flex-col border-l border-zinc-800 bg-[#15171b]">
          <div className="border-b border-zinc-800 p-4">
            <PromptInput onSubmit={startPlanning}>
              <PromptInputTextarea
                disabled={isBusy}
                onChange={(event) => setFirstPrompt(event.currentTarget.value)}
                placeholder="Describe the UI to build..."
                value={firstPrompt}
              />
              <div className="flex items-center gap-2 mt-2">
                <label className="cursor-pointer rounded-lg bg-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-300 hover:bg-zinc-700">
                  + Image/File
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf,text/*"
                    onChange={handleUploadMedia}
                  />
                </label>
                <PromptInputSubmit
                  disabled={!firstPrompt.trim() || isBusy}
                  status={isBusy ? 'streaming' : 'ready'}
                />
              </div>
            </PromptInput>
            {mediaRefs.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {mediaRefs.map((m) => (
                  <div
                    key={m.id}
                    className="group relative flex items-center gap-2 rounded-md bg-zinc-800 px-2 py-1"
                  >
                    <span className="max-w-[120px] truncate text-[10px] text-zinc-300">
                      {m.alt || 'Attachment'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMediaRefs((p) => p.filter((x) => x.id !== m.id))}
                      className="text-[10px] text-zinc-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {plan ? (
              <PlanView plan={plan} />
            ) : (
              <div className="flex h-full items-center justify-center text-center text-xs text-zinc-600">
                The planning document appears here.
              </div>
            )}
          </div>

          {plan ? (
            <div className="space-y-3 border-t border-zinc-800 p-4">
              <textarea
                className="min-h-20 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-600"
                onChange={(event) => setRefinement(event.currentTarget.value)}
                placeholder={
                  mode === 'generated' ? 'Refine the generated UI...' : 'Refine the plan...'
                }
                value={refinement}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) refinePlan();
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  className="h-10 rounded-md border border-zinc-800 text-sm text-zinc-300 disabled:text-zinc-700"
                  disabled={!refinement.trim() || isBusy}
                  onClick={refinePlan}
                  type="button"
                >
                  Refine
                </button>
                <button
                  className="h-10 rounded-md bg-cyan-500 text-sm font-semibold text-zinc-950 disabled:bg-zinc-800 disabled:text-zinc-600"
                  disabled={isBusy || !plan}
                  onClick={generateUI}
                  type="button"
                >
                  Generate
                </button>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
