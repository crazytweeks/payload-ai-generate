'use client';

import { ArrowDown, Send, Square } from 'lucide-react';
import type { FormEvent, HTMLAttributes, IframeHTMLAttributes, ReactNode } from 'react';

const cx = (...classes: Array<false | null | string | undefined>) =>
  classes.filter(Boolean).join(' ');

export function Conversation({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx('relative flex min-h-0 flex-1 flex-col overflow-hidden', className)}
      {...props}
    />
  );
}

export function ConversationContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx('flex-1 space-y-4 overflow-y-auto p-4', className)}
      data-conversation-content=""
      {...props}
    />
  );
}

export function ConversationEmptyState({
  description,
  icon,
  title,
}: {
  description: string;
  icon?: ReactNode;
  title: string;
}) {
  return (
    <div className="flex h-full min-h-[260px] flex-col items-center justify-center text-center text-zinc-500">
      {icon ? <div className="mb-3 text-zinc-700">{icon}</div> : null}
      <p className="text-sm font-semibold text-zinc-300">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed">{description}</p>
    </div>
  );
}

export function ConversationScrollButton() {
  return (
    <button
      aria-label="Scroll to latest"
      className="absolute bottom-3 right-3 inline-flex size-8 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-zinc-400 shadow-lg"
      onClick={() => {
        const container = document.querySelector('[data-conversation-content]');
        container?.scrollTo({ behavior: 'smooth', top: container.scrollHeight });
      }}
      type="button"
    >
      <ArrowDown size={14} />
    </button>
  );
}

export function Message({
  children,
  from,
}: {
  children: ReactNode;
  from: 'assistant' | 'data' | 'system' | 'user';
}) {
  return (
    <div className={cx('flex', from === 'user' ? 'justify-end' : 'justify-start')}>
      <div className={cx('max-w-[88%]', from === 'user' ? 'text-right' : 'text-left')}>
        {children}
      </div>
    </div>
  );
}

export function MessageContent({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200">
      {children}
    </div>
  );
}

export function MessageResponse({ children }: { children: string }) {
  return <div className="whitespace-pre-wrap leading-relaxed">{children}</div>;
}

export type PromptInputMessage = { text: string };

export function PromptInput({
  children,
  className,
  onSubmit,
}: {
  children: ReactNode;
  className?: string;
  onSubmit: (message: PromptInputMessage) => void;
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    onSubmit({ text: String(data.get('prompt') ?? '') });
  };

  return (
    <form className={cx('relative', className)} onSubmit={handleSubmit}>
      {children}
    </form>
  );
}

export function PromptInputTextarea({
  className,
  value,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        'min-h-20 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-3 pr-12 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-cyan-600',
        className
      )}
      name="prompt"
      value={value}
      {...props}
    />
  );
}

export function PromptInputSubmit({
  disabled,
  status,
}: {
  disabled?: boolean;
  status: 'ready' | 'streaming' | 'submitted';
}) {
  return (
    <button
      aria-label={status === 'ready' ? 'Send' : 'Stop'}
      className="absolute bottom-2 right-2 inline-flex size-9 items-center justify-center rounded-md bg-cyan-500 text-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
      disabled={disabled}
      type="submit"
    >
      {status === 'ready' ? <Send size={16} /> : <Square size={14} />}
    </button>
  );
}

export function ToolCard({
  input,
  name,
  output,
  state,
}: {
  input?: unknown;
  name: string;
  output?: unknown;
  state?: string;
}) {
  return (
    <details className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-400">
      <summary className="cursor-pointer font-mono text-zinc-300">
        {name} <span className="text-zinc-600">{state ?? 'running'}</span>
      </summary>
      <pre className="mt-2 max-h-52 overflow-auto rounded bg-black/40 p-2 text-[11px]">
        {JSON.stringify({ input, output }, null, 2)}
      </pre>
    </details>
  );
}

export function WebPreview({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        'flex h-full flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950',
        className
      )}
    >
      {children}
    </div>
  );
}

export function WebPreviewNavigation({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-zinc-800 px-3">
      {children}
    </div>
  );
}

export function WebPreviewUrl({ value }: { value: string }) {
  return (
    <div className="truncate rounded-md bg-zinc-900 px-2 py-1 font-mono text-[11px] text-zinc-500">
      {value}
    </div>
  );
}

export function WebPreviewBody(props: IframeHTMLAttributes<HTMLIFrameElement>) {
  return (
    <iframe
      className="min-h-0 flex-1 bg-white"
      sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
      {...props}
    />
  );
}
