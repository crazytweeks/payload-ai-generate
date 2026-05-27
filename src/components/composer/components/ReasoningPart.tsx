'use client';

import { useState } from 'react';

function formatReasoningText(raw: string): string {
  return raw.replace(/(\{[\s\S]*?\})/g, (match) => {
    try {
      return JSON.stringify(JSON.parse(match), null, 2);
    } catch {
      return match;
    }
  });
}

export function ReasoningPart({ text, state }: { state?: string; text: string }) {
  const [open, setOpen] = useState(false);
  const formatted = formatReasoningText(text);

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
        {state !== 'streaming' && text.length > 0 && (
          <span className="ml-auto text-[10px] text-purple-800">
            ~{Math.round(text.length / 4)} tokens
          </span>
        )}
      </button>
      {open && (
        <div className="border-t border-purple-900/30 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-500 whitespace-pre-wrap">
          {formatted}
        </div>
      )}
    </div>
  );
}
