'use client';

import type { AIReferenceDataSource, ComposerMode, ReferenceRow } from '../types';

type Props = {
  activeRefs: AIReferenceDataSource[];
  firstPrompt: string;
  isStreaming: boolean;
  mode: ComposerMode;
  onAddRef: () => void;
  onRemoveRef: (id: string) => void;
  onStartPlanning: () => void;
  onUpdateRef: (id: string, field: 'collection' | 'limit', value: number | string) => void;
  presetId: string;
  presets: { id: string; title: string }[];
  referenceCollections: string[];
  references: ReferenceRow[];
  mediaRefs: { id: string; url: string; alt: string; mediaId: string }[];
  onUploadMedia: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveMedia: (id: string) => void;
  setFirstPrompt: (v: string) => void;
  setPresetId: (v: string) => void;
};

export function LeftSidebar({
  activeRefs,
  firstPrompt,
  isStreaming,
  mode,
  onAddRef,
  onRemoveRef,
  onStartPlanning,
  onUpdateRef,
  presetId,
  presets,
  referenceCollections,
  references,
  mediaRefs,
  onUploadMedia,
  onRemoveMedia,
  setFirstPrompt,
  setPresetId,
}: Props) {
  return (
    <aside className="flex flex-col gap-3 overflow-y-auto">
      {/* Header */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h1 className="text-sm font-bold text-zinc-100">AI Composer</h1>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Describe a UI — AI will analyse, plan, then generate.
        </p>
      </div>

      {/* Prompt input (idle) */}
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
            placeholder="A pricing table using our products collection…"
            value={firstPrompt}
            onChange={(e) => setFirstPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onStartPlanning();
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <label className="cursor-pointer rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700">
              + Image/File
              <input type="file" className="hidden" accept="image/*,.pdf,text/*" onChange={onUploadMedia} />
            </label>
            <button
              type="button"
              disabled={!firstPrompt.trim()}
              onClick={onStartPlanning}
              className="flex-1 rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 hover:bg-violet-600"
            >
              Analyse & Plan ⌘↵
            </button>
          </div>
          
          {mediaRefs.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {mediaRefs.map((m) => (
                <div key={m.id} className="group relative flex items-center gap-2 rounded-md bg-zinc-800 px-2 py-1">
                  <span className="max-w-[120px] truncate text-[10px] text-zinc-300">{m.alt || 'Attachment'}</span>
                  <button type="button" onClick={() => onRemoveMedia(m.id)} className="text-[10px] text-zinc-500 hover:text-red-400">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Prompt summary + new session (after planning starts) */}
      {mode !== 'idle' && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[11px] text-zinc-500">Initial prompt</p>
          <p className="mt-1 line-clamp-4 text-xs leading-relaxed text-zinc-300">{firstPrompt}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
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
            onClick={onAddRef}
            className="rounded-md bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200"
          >
            + Add
          </button>
        </div>

        {references.length === 0 && (
          <p className="text-[11px] text-zinc-700">No reference data. Add a collection to give AI context.</p>
        )}

        {references.map((ref) => (
          <div key={ref.id} className="mb-2 grid grid-cols-[1fr_52px_20px] items-center gap-1.5">
            {referenceCollections.length > 0 ? (
              <select
                className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-300 outline-none"
                value={ref.collection}
                onChange={(e) => onUpdateRef(ref.id, 'collection', e.target.value)}
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
                onChange={(e) => onUpdateRef(ref.id, 'collection', e.target.value)}
              />
            )}
            <input
              type="number"
              min={1}
              max={100}
              className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-center text-xs text-zinc-300 outline-none"
              value={ref.limit}
              onChange={(e) => onUpdateRef(ref.id, 'limit', Number(e.target.value))}
            />
            <button
              type="button"
              onClick={() => onRemoveRef(ref.id)}
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
  );
}
