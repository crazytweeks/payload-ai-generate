'use client';

import { Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { codeToHtml } from 'shiki';

type Props = {
  code: string;
  language: string;
};

const LANG_MAP: Record<string, string> = {
  css: 'css',
  html: 'html',
  javascript: 'javascript',
  json: 'json',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  typescript: 'typescript',
};

export function CodeBlock({ code, language }: Props) {
  const [html, setHtml] = useState('');
  const [copied, setCopied] = useState(false);

  const lang = LANG_MAP[language] ?? 'text';

  useEffect(() => {
    let cancelled = false;
    codeToHtml(code, {
      lang,
      theme: 'vesper',
    })
      .then((result) => {
        if (!cancelled) setHtml(result);
      })
      .catch(() => {
        if (!cancelled) setHtml('');
      });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group relative h-full overflow-auto bg-[#101010]">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-[10px] text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-zinc-200"
      >
        <Copy size={10} />
        {copied ? 'copied!' : 'copy'}
      </button>

      {html ? (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: shiki produces safe highlighted HTML
        <div
          className="h-full [&>pre]:h-full [&>pre]:overflow-auto [&>pre]:p-4 [&>pre]:font-mono [&>pre]:text-[12px] [&>pre]:leading-relaxed"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="p-4 font-mono text-[12px] leading-relaxed text-zinc-400 whitespace-pre">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
