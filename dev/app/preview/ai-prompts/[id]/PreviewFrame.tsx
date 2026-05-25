'use client';

import { useEffect, useMemo, useRef } from 'react';

type VariableItem = {
  key?: string;
  value?: string;
};

type Props = {
  css?: string | null;
  dataJSON?: string | null;
  html: string;
  js?: string | null;
  variablesJSON?: string | null;
};

const parseVariables = (value?: string | null): VariableItem[] => {
  if (!value?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const applyVariables = (html: string, variables: VariableItem[]) => {
  let processed = html;

  for (const item of variables) {
    if (!item?.key) {
      continue;
    }

    const pattern = new RegExp(`{{\\s*${item.key}\\s*}}`, 'g');
    processed = processed.replace(pattern, item.value ?? '');
  }

  return processed;
};

export function PreviewFrame({ css, dataJSON, html, js, variablesJSON }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const processedHtml = useMemo(
    () => applyVariables(html, parseVariables(variablesJSON)),
    [html, variablesJSON]
  );

  useEffect(() => {
    if (!js?.trim() || !containerRef.current) {
      return;
    }

    const scriptElement = document.createElement('script');
    scriptElement.type = 'text/javascript';
    scriptElement.innerHTML = `
      (function () {
        try {
          const CMS_DATA = ${dataJSON?.trim() ? dataJSON : 'null'};
          ${js}
        } catch (error) {
          console.error('AI prompt preview script failed', error);
        }
      })();
    `;

    containerRef.current.appendChild(scriptElement);

    return () => {
      if (containerRef.current?.contains(scriptElement)) {
        containerRef.current.removeChild(scriptElement);
      }
    };
  }, [dataJSON, js]);

  return (
    <div ref={containerRef} style={{ minHeight: '100vh' }}>
      {css?.trim() ? (
        // biome-ignore lint/security/noDangerouslySetInnerHtml: previewing user-authored CSS in isolated preview route
        <style dangerouslySetInnerHTML={{ __html: css }} />
      ) : null}
      {
        // biome-ignore lint/security/noDangerouslySetInnerHtml: previewing generated HTML in the plugin dev preview route
        <div dangerouslySetInnerHTML={{ __html: processedHtml }} />
      }
    </div>
  );
}
