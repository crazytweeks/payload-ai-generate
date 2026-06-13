'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CodeEditorView } from './components/CodeEditorView';
import { LeftSidebar } from './components/LeftSidebar';
import { MessageRow } from './components/MessageRow';
import { PlanView } from './components/PlanView';
import type { ComposerMode, ComposerPlan, GeneratedFile, ReferenceRow } from './types';
import { useGenChat } from './useGenChat';
import { usePlanChat } from './usePlanChat';

export function ComposerClient({
  presets,
  referenceCollections,
}: {
  presets: { id: string; title: string }[];
  referenceCollections: string[];
}) {
  // ── core state ───────────────────────────────────────────────────────────────
  const [firstPrompt, setFirstPrompt] = useState('');
  const [refinementText, setRefinementText] = useState('');
  const [presetId, setPresetId] = useState('');
  const [references, setReferences] = useState<ReferenceRow[]>([]);
  const [mediaRefs, setMediaRefs] = useState<
    { id: string; url: string; alt: string; mediaId: string }[]
  >([]);
  const [plan, setPlan] = useState<ComposerPlan | null>(null);
  const [mode, setMode] = useState<ComposerMode>('idle');
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);
  const [sessionId, setSessionId] = useState<string>('');

  // stable refs shared with chat hooks so transports don't need re-creation
  const refsRef = useRef(references);
  const presetIdRef = useRef(presetId);
  const planRef = useRef(plan);

  const syncRefs = useCallback(() => {
    refsRef.current = references;
    presetIdRef.current = presetId;
    planRef.current = plan;
  }, [references, presetId, plan]);

  const sessionIdRef = useRef(sessionId);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // ── planning chat ─────────────────────────────────────────────────────────
  const handlePlanReady = useCallback((extracted: ComposerPlan | null) => {
    setPlan(extracted);
    planRef.current = extracted;
  }, []);

  const {
    messages,
    sendMessage,
    isStreaming: isPlanStreaming,
    stop: stopPlan,
  } = usePlanChat({
    onPlanReady: handlePlanReady,
    onModeChange: setMode,
    refsRef,
    presetIdRef,
    sessionIdRef,
  });

  // ── generation chat ───────────────────────────────────────────────────────
  const {
    sendMessage: sendGenMessage,
    isStreaming: isGenStreaming,
    stop: stopGen,
  } = useGenChat({
    onFilesChange: setGeneratedFiles,
    onGenerationDone: () => setMode('generated'),
    planRef,
    refsRef,
    sessionIdRef,
  });

  // ── derived state ─────────────────────────────────────────────────────────
  const isStreaming = isPlanStreaming || isGenStreaming;
  const isGenerating = mode === 'generating' || mode === 'generated';
  const hasPlan = plan !== null;

  const activeRefs = useMemo(
    () =>
      references
        .filter((r) => r.collection.trim())
        .map((r) => ({
          collection: r.collection,
          dataLoading: 'server' as const,
          isBeingUsed: true,
          limit: r.limit,
        })),
    [references]
  );

  // ── handlers ──────────────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollToEnd = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  }, []);

  const handleStartPlanning = useCallback(async () => {
    if (!firstPrompt.trim() || isPlanStreaming) return;
    syncRefs();
    setMode('planning');
    setPlan(null);
    planRef.current = null;

    // Create session in Payload
    let sid = sessionId;
    if (!sid) {
      try {
        const res = await fetch('/api/ai-composer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: firstPrompt.slice(0, 50),
            firstPrompt: firstPrompt,
            preset: presetId || null,
            referenceMedia: mediaRefs.map((m) => m.mediaId),
            referenceCollections: references.map((r) => ({
              referenceCollection: r.collection,
              limit: r.limit,
              isBeingUsed: true,
              dataLoading: 'server',
            })),
          }),
        });
        if (res.ok) {
          const doc = await res.json();
          sid = doc.doc.id;
          setSessionId(sid);
        }
      } catch (err) {
        console.error('Failed to create session:', err);
      }
    }

    // Pass media refs in the message
    const attachments = mediaRefs.map((m) => ({
      type: 'file' as const,
      name: m.alt || 'attachment',
      url: m.url,
      contentType: m.url.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      mediaType: m.url.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
    }));

    sendMessage({
      text: firstPrompt.trim(),
      files: attachments.length > 0 ? attachments : undefined,
    });
    scrollToEnd();
  }, [
    firstPrompt,
    mediaRefs,
    isPlanStreaming,
    sendMessage,
    scrollToEnd,
    syncRefs,
    sessionId,
    presetId,
    references,
  ]);

  const handleRefine = useCallback(() => {
    if (!refinementText.trim()) return;

    if (isGenerating) {
      if (isGenStreaming) return;
      syncRefs();
      sendGenMessage({ text: refinementText.trim() });
    } else {
      if (isPlanStreaming) return;
      syncRefs();
      setMode('refining');
      sendMessage({ text: refinementText.trim() });
    }

    setRefinementText('');
    scrollToEnd();
  }, [
    refinementText,
    isPlanStreaming,
    isGenStreaming,
    isGenerating,
    sendMessage,
    sendGenMessage,
    scrollToEnd,
    syncRefs,
  ]);

  const handleProceed = useCallback(() => {
    if (!planRef.current || isGenStreaming) return;
    syncRefs();
    setMode('generating');
    setGeneratedFiles([]);
    sendGenMessage({ text: 'Generate the UI now based on the plan.' });
  }, [isGenStreaming, sendGenMessage, syncRefs]);

  const handleBackToPlan = useCallback(() => {
    setMode('plan-ready');
    setGeneratedFiles([]);
  }, []);

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

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="grid h-[calc(100vh-45px)] grid-cols-[300px_1fr_360px] gap-3 bg-[#0f0f11] p-3 font-sans text-[#e2e2e8]">
      {/* LEFT: setup */}
      <LeftSidebar
        activeRefs={activeRefs}
        firstPrompt={firstPrompt}
        isStreaming={isStreaming}
        mode={mode}
        onAddRef={() =>
          setReferences((p) => [...p, { id: crypto.randomUUID(), collection: '', limit: 10 }])
        }
        onRemoveRef={(id) => setReferences((p) => p.filter((r) => r.id !== id))}
        onStartPlanning={handleStartPlanning}
        onUpdateRef={(id, field, value) =>
          setReferences((p) => p.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
        }
        presetId={presetId}
        presets={presets}
        referenceCollections={referenceCollections}
        references={references}
        mediaRefs={mediaRefs}
        onUploadMedia={handleUploadMedia}
        onRemoveMedia={(id) => setMediaRefs((p) => p.filter((m) => m.id !== id))}
        setFirstPrompt={setFirstPrompt}
        setPresetId={setPresetId}
      />

      {/* CENTER: chat stream OR code editor */}
      <main className="flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        {/* Header bar */}
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5">
          <span className="text-xs font-semibold text-zinc-400">
            {isGenerating ? 'Code Editor' : 'Live Stream'}
          </span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-[11px] text-violet-400">
              <span className="animate-pulse">●</span>
              {isGenStreaming ? 'Generating…' : 'Thinking…'}
            </span>
          )}
          {mode === 'plan-ready' && !isGenerating && (
            <span className="text-[11px] text-emerald-400">✓ Plan ready</span>
          )}
          {mode === 'generated' && (
            <span className="text-[11px] text-emerald-400">
              ✓ {generatedFiles.length} file{generatedFiles.length !== 1 ? 's' : ''} generated
            </span>
          )}
          {isStreaming && (
            <button
              type="button"
              onClick={isGenStreaming ? stopGen : stopPlan}
              className="ml-auto rounded-md bg-red-950 px-2 py-0.5 text-[11px] font-semibold text-red-400 hover:bg-red-900"
            >
              Stop
            </button>
          )}
        </div>

        {/* Body */}
        {isGenerating ? (
          <div className="flex-1 overflow-hidden">
            <CodeEditorView files={generatedFiles} isGenerating={isGenStreaming} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-zinc-700">
                <div className="text-3xl">✦</div>
                <p className="text-sm">Enter your prompt and click Analyse &amp; Plan</p>
                <p className="text-xs text-zinc-800">
                  AI thinking, tool calls, and reasoning will appear here
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <MessageRow key={msg.id} msg={msg} />
            ))}
            {isPlanStreaming && (
              <div className="flex items-center gap-2 pb-2">
                <div className="flex gap-1 rounded-lg rounded-bl-sm border border-zinc-800 bg-zinc-950 px-3 py-2">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-violet-600"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Refinement input */}
        {(mode === 'plan-ready' || mode === 'refining' || mode === 'generated') && (
          <div className="border-t border-zinc-800 p-3">
            <div className="flex gap-2">
              <textarea
                className="flex-1 resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-700"
                rows={2}
                placeholder={
                  isGenerating
                    ? "Refine the generated UI — e.g. 'make the button blue'…"
                    : "Refine the plan — e.g. 'make it mobile-first, use a card grid instead'…"
                }
                value={refinementText}
                onChange={(e) => setRefinementText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRefine();
                }}
              />
              <button
                type="button"
                disabled={!refinementText.trim() || isPlanStreaming || isGenStreaming}
                onClick={handleRefine}
                className="self-end rounded-lg bg-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 disabled:opacity-40 hover:bg-zinc-600"
              >
                Refine
              </button>
            </div>
          </div>
        )}
      </main>

      {/* RIGHT: plan panel */}
      <aside className="flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
          <span className="text-xs font-semibold text-zinc-400">Generation Plan</span>
          {hasPlan && (
            <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              Ready
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!hasPlan ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-zinc-700">
              <div className="text-2xl opacity-30">📋</div>
              <p className="text-xs">Plan will appear here once AI finishes analysis</p>
            </div>
          ) : (
            <PlanView plan={plan} />
          )}
        </div>

        {hasPlan && !isPlanStreaming && (
          <div className="border-t border-zinc-800 p-3">
            {isGenerating ? (
              <div className="flex flex-col gap-2">
                {isGenStreaming && (
                  <button
                    type="button"
                    onClick={stopGen}
                    className="w-full rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-900"
                  >
                    Stop generation
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleBackToPlan}
                  className="w-full rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  ← Back to plan
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleProceed}
                  className="w-full rounded-lg bg-violet-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-violet-600"
                >
                  Proceed with Plan →
                </button>
                <p className="text-center text-[10px] text-zinc-600">
                  or refine using the chat below
                </p>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
