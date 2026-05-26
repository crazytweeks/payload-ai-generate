'use client';

import type { ReactNode } from 'react';
import type { ComposerPlan } from '../types';

function renderMarkdownLine(line: string, idx: number): ReactNode {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span key={idx}>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: static inline parts
          <strong key={i} className="font-semibold text-zinc-200">
            {part.slice(2, -2)}
          </strong>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: static inline parts
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

function PlanTextField({ value }: { value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      {value.split('\n').map((line, i) => {
        const trimmed = line.trim();
        // biome-ignore lint/suspicious/noArrayIndexKey: static text lines
        if (!trimmed) return <div key={i} className="h-1" />;
        if (/^[-*]\s/.test(trimmed)) {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: static text lines
            <div key={i} className="flex gap-2 text-xs text-zinc-400">
              <span className="mt-0.5 shrink-0 text-zinc-600">•</span>
              <span>{renderMarkdownLine(trimmed.slice(2).trim(), i)}</span>
            </div>
          );
        }
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: static text lines
          <p key={i} className="text-xs leading-relaxed text-zinc-400">
            {renderMarkdownLine(trimmed, i)}
          </p>
        );
      })}
    </div>
  );
}

function PlanSection({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div>
      <p className={`mb-1.5 text-[11px] font-semibold uppercase tracking-wider ${color}`}>
        {label}
      </p>
      <PlanTextField value={value} />
    </div>
  );
}

export function PlanView({ plan }: { plan: ComposerPlan }) {
  return (
    <div className="flex flex-col gap-5">
      <PlanSection label="Design" value={plan.design} color="text-sky-400" />
      <PlanSection label="Approach" value={plan.approach} color="text-emerald-400" />
      <PlanSection label="Data Mapping" value={plan.dataMapping} color="text-amber-400" />
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-violet-400">
          Components
          <span className="ml-2 rounded-full bg-violet-950 px-1.5 py-0.5 text-[10px] text-violet-400">
            {plan.components?.length ?? 0}
          </span>
        </p>
        <ul className="flex flex-col gap-2">
          {(plan.components ?? []).map((c, i) => {
            const [name, ...rest] = c.split(':');
            const desc = rest.join(':').trim();
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: static list
              <li key={i} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2">
                <p className="text-xs font-semibold text-violet-300">{name.trim()}</p>
                {desc && <p className="mt-0.5 text-[11px] text-zinc-500">{desc}</p>}
              </li>
            );
          })}
        </ul>
      </div>
      {plan.notes && <PlanSection label="Notes" value={plan.notes} color="text-zinc-500" />}
    </div>
  );
}
