'use client';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { DefaultChatTransport } from 'ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AIReferenceDataSource } from '../../../../src/ai-types';
import type { ComposerPlan } from '../../../../src/composer/types';

// ─── plan extraction ──────────────────────────────────────────────────────────

const extractPlan = (text: string): ComposerPlan | null => {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1].trim()) as ComposerPlan;
  } catch {
    return null;
  }
};

// ─── types ────────────────────────────────────────────────────────────────────

type ReferenceRow = { collection: string; id: string; limit: number };

type ComposerMode = 'idle' | 'planning' | 'plan-ready' | 'refining';

// ─── sub-components ───────────────────────────────────────────────────────────

function ReasoningPart({ text, state }: { state?: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-2 overflow-hidden rounded-lg border border-purple-900/40 bg-[#1a1625]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-purple-400 hover:bg-white/5"
      >
        <span className="opacity-60">{open ? '▼' : '▶'}</span>
        <span>Thinking</span>
        {state === 'streaming' && <span className="ml-auto animate-pulse text-purple-500">●</span>}
      </button>
      {open && (
        <div className="border-t border-purple-900/30 px-3 py-2 text-xs leading-relaxed text-zinc-500 whitespace-pre-wrap">
          {text}
        </div>
      )}
    </div>
  );
}

function ToolPart({
  toolName,
  input,
  output,
  state,
}: {
  input?: unknown;
  output?: unknown;
  state: string;
  toolName: string;
}) {
  const [open, setOpen] = useState(false);
  const dot =
    state === 'output-available'
      ? 'bg-emerald-500'
      : state.includes('error')
        ? 'bg-red-500'
        : 'bg-amber-400 animate-pulse';

  return (
    <div className="mb-2 overflow-hidden rounded-lg border border-zinc-800 bg-[#0d0d12]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-white/5"
      >
        <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <span className="font-mono text-xs text-violet-400">{toolName}</span>
        <span className="ml-auto text-[10px] text-zinc-600">
          {state === 'output-available' ? 'done' : state}
        </span>
        <span className="text-[10px] text-zinc-700">{open ? '▼' : '▶'}</span>
      </button>
      {open && (
        <div className="border-t border-zinc-800 px-3 pb-3">
          {input !== undefined && (
            <>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                Input
              </p>
              <pre className="mt-1 max-h-40 overflow-auto text-[11px] text-violet-300 whitespace-pre-wrap break-all">
                {JSON.stringify(input, null, 2)}
              </pre>
            </>
          )}
          {output !== undefined && (
            <>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                Output
              </p>
              <pre className="mt-1 max-h-48 overflow-auto text-[11px] text-emerald-400 whitespace-pre-wrap break-all">
                {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MessageRow({ msg }: { msg: UIMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-4`}>
      <span className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
        {isUser ? 'You' : 'AI'}
      </span>
      <div
        className={
          isUser
            ? 'max-w-[85%] rounded-xl rounded-tr-sm border border-violet-800/50 bg-violet-950/60 px-3 py-2 text-sm text-zinc-200'
            : 'w-full'
        }
      >
        {isUser ? (
          <span className="whitespace-pre-wrap break-words">
            {msg.parts
              .filter((p) => p.type === 'text')
              .map((p) => (p as { type: 'text'; text: string }).text)
              .join('')}
          </span>
        ) : (
          msg.parts.map((part, i) => {
            const key = `${msg.id}-${i}`;

            if (part.type === 'step-start') {
              return i === 0 ? null : (
                <div
                  key={key}
                  className="my-3 border-t border-zinc-800 text-center text-[10px] text-zinc-700"
                >
                  ─ step ─
                </div>
              );
            }

            if (part.type === 'reasoning') {
              return <ReasoningPart key={key} text={part.text} state={part.state} />;
            }

            if (part.type === 'dynamic-tool') {
              const dp = part as {
                input?: unknown;
                output?: unknown;
                state: string;
                toolName: string;
                type: 'dynamic-tool';
              };
              return (
                <ToolPart
                  key={key}
                  toolName={dp.toolName}
                  input={dp.input}
                  output={dp.output}
                  state={dp.state}
                />
              );
            }

            if (part.type === 'text') {
              const tp = part as { text: string; type: 'text' };
              // Hide the plan JSON block — it's shown in the right panel
              const visible = tp.text.replace(/```json[\s\S]*?```/g, '').trim();
              if (!visible) return null;
              return (
                <p
                  key={key}
                  className="mb-2 text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap"
                >
                  {visible}
                </p>
              );
            }

            return null;
          })
        )}
      </div>
    </div>
  );
}

function PlanView({ plan }: { plan: ComposerPlan }) {
  return (
    <div className="flex flex-col gap-4">
      <PlanSection label="Design" value={plan.design} color="text-sky-400" />
      <PlanSection label="Approach" value={plan.approach} color="text-emerald-400" />
      <PlanSection label="Data Mapping" value={plan.dataMapping} color="text-amber-400" />
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-violet-400">
          Components
        </p>
        <ul className="flex flex-col gap-1.5">
          {(plan.components ?? []).map((c, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static list
            <li key={i} className="flex gap-2 text-xs text-zinc-300">
              <span className="mt-0.5 text-violet-500">▸</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>
      {plan.notes && <PlanSection label="Notes" value={plan.notes} color="text-zinc-500" />}
    </div>
  );
}

function PlanSection({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div>
      <p className={`mb-1 text-[11px] font-semibold uppercase tracking-wider ${color}`}>{label}</p>
      <p className="text-xs leading-relaxed text-zinc-400">{value}</p>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function ComposerClient({
  presets,
  referenceCollections,
}: {
  presets: { id: string; title: string }[];
  referenceCollections: string[];
}) {
  const [firstPrompt, setFirstPrompt] = useState('');
  const [refinementText, setRefinementText] = useState('');
  const [presetId, setPresetId] = useState('');
  const [references, setReferences] = useState<ReferenceRow[]>([]);
  const [plan, setPlan] = useState<ComposerPlan | null>(null);
  const [mode, setMode] = useState<ComposerMode>('idle');

  const refsRef = useRef(references);
  const presetIdRef = useRef(presetId);
  // keep refs in sync without causing re-renders that recreate transport
  const syncRefs = useCallback(() => {
    refsRef.current = references;
    presetIdRef.current = presetId;
  }, [references, presetId]);

  const activeRefs: AIReferenceDataSource[] = useMemo(
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

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/ai-generate/composer',
        prepareSendMessagesRequest: async ({ messages }) => ({
          body: {
            messages,
            references: refsRef.current
              .filter((r) => r.collection.trim())
              .map((r) => ({
                collection: r.collection,
                dataLoading: 'server',
                isBeingUsed: true,
                limit: r.limit,
              })),
            presetId: presetIdRef.current || undefined,
          },
        }),
      }),
    []
  );

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollToEnd = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
  }, []);

  const { messages, sendMessage, status, stop } = useChat({ transport });

  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current !== 'ready' && status === 'ready' && messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === 'assistant') {
        const text = last.parts
          .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
          .map((p) => p.text)
          .join('');
        const extracted = extractPlan(text);
        setPlan(extracted);
        setMode('plan-ready');
      }
    }
    prevStatus.current = status;
  }, [status, messages]);

  const isStreaming = status === 'streaming' || status === 'submitted';

  const handleStartPlanning = useCallback(() => {
    if (!firstPrompt.trim() || isStreaming) return;
    syncRefs();
    setMode('planning');
    setPlan(null);
    sendMessage({ text: firstPrompt.trim() });
    scrollToEnd();
  }, [firstPrompt, isStreaming, sendMessage, scrollToEnd, syncRefs]);

  const handleRefine = useCallback(() => {
    if (!refinementText.trim() || isStreaming) return;
    syncRefs();
    setMode('refining');
    sendMessage({ text: refinementText.trim() });
    setRefinementText('');
    scrollToEnd();
  }, [refinementText, isStreaming, sendMessage, scrollToEnd, syncRefs]);

  const handleProceed = useCallback(() => {
    // TODO: wire into block generation flow
    alert('Generation mode coming soon!');
  }, []);

  const addRef = () =>
    setReferences((p) => [...p, { id: crypto.randomUUID(), collection: '', limit: 10 }]);
  const removeRef = (id: string) => setReferences((p) => p.filter((r) => r.id !== id));
  const updateRef = (id: string, field: 'collection' | 'limit', value: number | string) =>
    setReferences((p) => p.map((r) => (r.id === id ? { ...r, [field]: value } : r)));

  const hasPlan = plan !== null;
  const hasMessages = messages.length > 0;

  return (
    <div className="grid h-[calc(100vh-45px)] grid-cols-[300px_1fr_360px] gap-3 bg-[#0f0f11] p-3 font-sans text-[#e2e2e8]">
      {/* ── LEFT: setup ── */}
      <aside className="flex flex-col gap-3 overflow-y-auto">
        {/* Header */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h1 className="text-sm font-bold text-zinc-100">AI Composer</h1>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Describe a UI — AI will analyse, plan, then generate.
          </p>
        </div>

        {/* First prompt (visible until planning starts) */}
        {mode === 'idle' && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <label
              htmlFor="first-prompt"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
            >
              What do you want to build?
            </label>
            <textarea
              id="first-prompt"
              className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-700"
              rows={5}
              placeholder="A pricing table using our products collection, with a CTA button and feature comparison grid…"
              value={firstPrompt}
              onChange={(e) => setFirstPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleStartPlanning();
              }}
            />
            <button
              type="button"
              disabled={!firstPrompt.trim()}
              onClick={handleStartPlanning}
              className="mt-2 w-full rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 hover:bg-violet-600"
            >
              Analyse & Plan ⌘↵
            </button>
          </div>
        )}

        {/* Shown after first send: the prompt summary + new chat */}
        {mode !== 'idle' && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-[11px] text-zinc-500">Initial prompt</p>
            <p className="mt-1 text-xs leading-relaxed text-zinc-300 line-clamp-4">{firstPrompt}</p>
            <button
              type="button"
              onClick={() => {
                setMode('idle');
                setPlan(null);
                window.location.reload();
              }}
              className="mt-3 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
            >
              ↺ New session
            </button>
          </div>
        )}

        {/* Preset */}
        {presets.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <label
              htmlFor="preset"
              className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-zinc-500"
            >
              Preset
            </label>
            <select
              id="preset"
              value={presetId}
              onChange={(e) => setPresetId(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 outline-none"
            >
              <option value="">— none —</option>
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Reference collections */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              References
            </span>
            <button
              type="button"
              onClick={addRef}
              className="rounded-md bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200"
            >
              + Add
            </button>
          </div>

          {references.length === 0 && (
            <p className="text-[11px] text-zinc-700">
              No reference data. Add a collection to give AI context.
            </p>
          )}

          {references.map((ref) => (
            <div key={ref.id} className="mb-2 grid grid-cols-[1fr_52px_20px] items-center gap-1.5">
              {referenceCollections.length > 0 ? (
                <select
                  className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-300 outline-none"
                  value={ref.collection}
                  onChange={(e) => updateRef(ref.id, 'collection', e.target.value)}
                >
                  <option value="">— pick —</option>
                  {referenceCollections.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-300 outline-none"
                  placeholder="slug"
                  value={ref.collection}
                  onChange={(e) => updateRef(ref.id, 'collection', e.target.value)}
                />
              )}
              <input
                type="number"
                min={1}
                max={100}
                className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-center text-xs text-zinc-300 outline-none"
                value={ref.limit}
                onChange={(e) => updateRef(ref.id, 'limit', Number(e.target.value))}
              />
              <button
                type="button"
                onClick={() => removeRef(ref.id)}
                className="text-center text-sm leading-none text-zinc-700 hover:text-zinc-400"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Active refs indicator */}
        {activeRefs.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2">
            <p className="text-[11px] text-zinc-500">
              {activeRefs.length} reference{activeRefs.length !== 1 ? 's' : ''} active
            </p>
          </div>
        )}
      </aside>

      {/* ── CENTER: live stream ── */}
      <main className="flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        {/* Stream header */}
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5">
          <span className="text-xs font-semibold text-zinc-400">Live Stream</span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-[11px] text-violet-400">
              <span className="animate-pulse">●</span> Running
            </span>
          )}
          {mode === 'plan-ready' && (
            <span className="text-[11px] text-emerald-400">✓ Plan ready</span>
          )}
          {isStreaming && (
            <button
              type="button"
              onClick={() => stop()}
              className="ml-auto rounded-md bg-red-950 px-2 py-0.5 text-[11px] font-semibold text-red-400 hover:bg-red-900"
            >
              Stop
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {!hasMessages && (
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
          {isStreaming && (
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

        {/* Refinement input — visible after plan is ready */}
        {(mode === 'plan-ready' || mode === 'refining') && (
          <div className="border-t border-zinc-800 p-3">
            <div className="flex gap-2">
              <textarea
                className="flex-1 resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-700"
                rows={2}
                placeholder="Refine the plan — e.g. 'make it mobile-first, use a card grid instead'…"
                value={refinementText}
                onChange={(e) => setRefinementText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRefine();
                }}
              />
              <button
                type="button"
                disabled={!refinementText.trim() || isStreaming}
                onClick={handleRefine}
                className="self-end rounded-lg bg-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 disabled:opacity-40 hover:bg-zinc-600"
              >
                Refine
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── RIGHT: plan output ── */}
      <aside className="flex flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        {/* Plan header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
          <span className="text-xs font-semibold text-zinc-400">Generation Plan</span>
          {hasPlan && (
            <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
              Ready
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!hasPlan && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-zinc-700">
              <div className="text-2xl opacity-30">📋</div>
              <p className="text-xs">Plan will appear here once AI finishes analysis</p>
            </div>
          )}

          {hasPlan && <PlanView plan={plan} />}
        </div>

        {/* Action buttons — shown when plan is ready */}
        {hasPlan && !isStreaming && (
          <div className="border-t border-zinc-800 p-3">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleProceed}
                className="w-full rounded-lg bg-violet-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-violet-600"
              >
                Proceed with Plan →
              </button>
              <p className="text-center text-[10px] text-zinc-600">
                or refine the plan using the chat below
              </p>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
