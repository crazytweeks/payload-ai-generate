'use client';

import type { UIMessage } from 'ai';
import { ReasoningPart } from './ReasoningPart';
import { ToolPart } from './ToolPart';

export function MessageRow({ msg }: { msg: UIMessage }) {
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
              const rp = part as { state?: string; text: string; type: 'reasoning' };
              return <ReasoningPart key={key} text={rp.text} state={rp.state} />;
            }

            if (part.type === 'tool-invocation' || part.type.startsWith('tool-')) {
              const ti = part as unknown as {
                args?: unknown;
                input?: unknown;
                output?: unknown;
                result?: unknown;
                state: string;
                toolName?: string;
                type: string;
              };
              return (
                <ToolPart
                  key={key}
                  toolName={ti.toolName ?? ti.type.replace(/^tool-/, '')}
                  input={ti.input ?? ti.args}
                  output={ti.output ?? ti.result}
                  state={ti.state}
                />
              );
            }

            if (part.type === 'text') {
              const tp = part as { text: string; type: 'text' };
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
