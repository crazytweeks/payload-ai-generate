'use client';

import { useState } from 'react';

export function ToolPart({
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
