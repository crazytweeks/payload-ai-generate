'use client';

import { useMemo } from 'react';
import type { AiHtmlBlockProps, AiHtmlVariable } from './types';

const parseVariables = (variablesJSON?: string | null): AiHtmlVariable[] => {
  if (!variablesJSON?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(variablesJSON);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const applyVariables = (html: string, variables: AiHtmlVariable[]) => {
  let processed = html;

  for (const variable of variables) {
    if (!variable?.key) {
      continue;
    }

    const regex = new RegExp(`{{\\s*${variable.key}\\s*}}`, 'g');
    processed = processed.replace(regex, variable.value ?? '');
  }

  return processed;
};

/**
 * Escapes closing tags that would break srcdoc string parsing.
 * Only needed for style/script content injected into the srcdoc string.
 */
const escapeClosingTag = (str: string, tag: string) =>
  str.replace(new RegExp(`</${tag}`, 'gi'), `<\\/${tag}`);

export function AiHtmlBlockComponentClient({ code, id }: AiHtmlBlockProps) {
  const promptDoc = typeof code === 'object' && code !== null ? code : null;
  const html = typeof promptDoc?.html === 'string' ? promptDoc.html : '';
  const css = typeof promptDoc?.css === 'string' ? promptDoc.css : '';
  const js = typeof promptDoc?.js === 'string' ? promptDoc.js : '';
  const dataJSON = typeof promptDoc?.dataJSON === 'string' ? promptDoc.dataJSON : 'null';

  const processedHtml = useMemo(
    () => applyVariables(html, parseVariables(promptDoc?.variablesJSON)),
    [html, promptDoc?.variablesJSON]
  );

  /**
   * AI-generated content is rendered inside a sandboxed iframe with allow-scripts only.
   * This ensures the generated JS cannot access the parent page's DOM, cookies,
   * localStorage, or make credentialed requests — fully isolated from the host app.
   */
  const srcdoc = useMemo(() => {
    const safeCss = css ? escapeClosingTag(css, 'style') : '';
    const safeDataJSON = escapeClosingTag(dataJSON || 'null', 'script');
    const safeJs = js ? escapeClosingTag(js, 'script') : '';

    return [
      '<!DOCTYPE html><html lang="en"><head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      safeCss ? `<style>${safeCss}</style>` : '',
      '</head><body>',
      processedHtml,
      safeJs
        ? `<script>(function(){try{var CMS_DATA=${safeDataJSON};${safeJs}}catch(e){console.error('[ai-html-block] script error:',e)}})()</script>`
        : '',
      '</body></html>',
    ]
      .filter(Boolean)
      .join('');
  }, [css, dataJSON, js, processedHtml]);

  return (
    <iframe
      className={`cms-ai-html-block w-full${id ? ` cms-ai-html-block--${id}` : ''}`}
      key={id}
      sandbox="allow-scripts"
      srcDoc={srcdoc}
      style={{ border: 'none', minHeight: '100px', width: '100%' }}
      title="AI generated content"
    />
  );
}
