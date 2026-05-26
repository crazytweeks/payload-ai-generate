'use client';

import { useState } from 'react';
import type { GeneratedFile } from '../types';

const LANG_DOT: Record<string, string> = {
  html: 'bg-orange-500',
  css: 'bg-blue-500',
  javascript: 'bg-yellow-400',
  json: 'bg-emerald-500',
  typescript: 'bg-sky-500',
  tsx: 'bg-sky-400',
};

function EmptyState({ isGenerating }: { isGenerating: boolean }) {
  if (isGenerating) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-700">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="inline-block h-2 w-2 animate-bounce rounded-full bg-violet-600"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
        <p className="text-xs text-zinc-500">AI is writing files…</p>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-700">
      <span className="text-2xl opacity-20">{'</>'}</span>
      <p className="text-xs">Generated files will appear here</p>
    </div>
  );
}

export function CodeEditorView({
  files,
  isGenerating,
}: {
  files: GeneratedFile[];
  isGenerating: boolean;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = files[Math.min(activeIdx, files.length - 1)];

  if (files.length === 0) return <EmptyState isGenerating={isGenerating} />;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-0 overflow-x-auto border-b border-zinc-800 bg-zinc-950 px-1 pt-1">
        {files.map((f, i) => (
          <button
            key={f.path}
            type="button"
            onClick={() => setActiveIdx(i)}
            className={[
              'flex shrink-0 items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-1.5 text-[11px] font-mono transition-colors',
              i === activeIdx
                ? 'border-zinc-700 bg-zinc-900 text-zinc-200'
                : 'border-transparent text-zinc-600 hover:text-zinc-400',
            ].join(' ')}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${LANG_DOT[f.language] ?? 'bg-zinc-600'}`}
            />
            {f.path}
            {f.isEntryPoint && (
              <span className="rounded bg-violet-950 px-1 text-[9px] text-violet-400">entry</span>
            )}
          </button>
        ))}
        {isGenerating && (
          <span className="ml-2 animate-pulse text-[11px] text-violet-500">writing…</span>
        )}
      </div>

      {/* Code pane */}
      {active && (
        <div className="relative flex-1 overflow-auto bg-[#0d0d12]">
          <pre className="p-4 font-mono text-[12px] leading-relaxed text-zinc-300 whitespace-pre">
            <code>{active.content}</code>
          </pre>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(active.content)}
            className="absolute right-3 top-3 rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300"
          >
            copy
          </button>
        </div>
      )}
    </div>
  );
}
