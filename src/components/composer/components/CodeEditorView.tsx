'use client';

import { useState } from 'react';
import type { GeneratedFile } from '../types';
import { CodeBlock } from './CodeBlock';
import { FileTree } from './FileTree';

const LANG_DOT: Record<string, string> = {
  css: 'bg-blue-500',
  html: 'bg-orange-500',
  javascript: 'bg-yellow-400',
  json: 'bg-emerald-500',
  tsx: 'bg-sky-400',
  typescript: 'bg-sky-500',
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
  const [activeFile, setActiveFile] = useState<string | undefined>(undefined);

  const active =
    files.find((f) => f.path === activeFile) ?? files.find((f) => f.isEntryPoint) ?? files[0];

  if (files.length === 0) return <EmptyState isGenerating={isGenerating} />;

  return (
    <div className="flex h-full overflow-hidden">
      {/* File tree sidebar */}
      <div className="flex w-44 shrink-0 flex-col overflow-hidden border-r border-zinc-800 bg-zinc-950">
        <div className="border-b border-zinc-800 px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Files
          </span>
          {isGenerating && (
            <span className="ml-2 animate-pulse text-[10px] text-violet-500">writing…</span>
          )}
        </div>
        <FileTree
          activeFile={active?.path}
          files={files.map((f) => f.path)}
          onSelect={setActiveFile}
        />
      </div>

      {/* Code pane */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Active file tab */}
        {active && (
          <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-3 py-1.5">
            <span
              className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${LANG_DOT[active.language] ?? 'bg-zinc-600'}`}
            />
            <span className="font-mono text-[11px] text-zinc-400">{active.path}</span>
            {active.isEntryPoint && (
              <span className="rounded bg-violet-950 px-1 text-[9px] text-violet-400">entry</span>
            )}
          </div>
        )}

        {/* Highlighted code */}
        {active ? (
          <div className="flex-1 overflow-hidden">
            <CodeBlock code={active.content} language={active.language} />
          </div>
        ) : (
          <EmptyState isGenerating={isGenerating} />
        )}
      </div>
    </div>
  );
}
