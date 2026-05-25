/** biome-ignore-all lint/security/noDangerouslySetInnerHtml: We need to use dangerouslySetInnerHTML to render custom HTML */
'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { DangerousCustomRenderBlockProps, DangerousCustomRenderVariable } from './types';

const parseVariables = (variablesJSON?: string | null): DangerousCustomRenderVariable[] => {
  if (!variablesJSON?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(variablesJSON);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error parsing variablesJSON in DangerousCustomRenderBlockComponent:', error);
    return [];
  }
};

const applyVariables = (html: string, variables: DangerousCustomRenderVariable[]) => {
  let processedHtml = html;

  for (const variable of variables) {
    if (!variable?.key) {
      continue;
    }

    const regex = new RegExp(`{{\\s*${variable.key}\\s*}}`, 'g');
    processedHtml = processedHtml.replace(regex, variable.value ?? '');
  }

  return processedHtml;
};

export function DangerousCustomRenderBlockComponentClient({
  code,
  id,
}: DangerousCustomRenderBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const promptDoc = typeof code === 'object' && code !== null ? code : null;
  const html = typeof promptDoc?.html === 'string' ? promptDoc.html : '';
  const css = typeof promptDoc?.css === 'string' ? promptDoc.css : '';
  const js = typeof promptDoc?.js === 'string' ? promptDoc.js : '';
  const dataJSON = typeof promptDoc?.dataJSON === 'string' ? promptDoc.dataJSON : 'null';
  const processedHtml = useMemo(
    () => applyVariables(html, parseVariables(promptDoc?.variablesJSON)),
    [html, promptDoc?.variablesJSON]
  );

  useEffect(() => {
    if (!js?.trim() || !containerRef.current) {
      return;
    }

    let isMounted = true;
    let scriptElement: HTMLScriptElement | null = null;

    async function executeScript() {
      if (!isMounted || !containerRef.current) {
        return;
      }

      scriptElement = document.createElement('script');
      scriptElement.type = 'text/javascript';
      scriptElement.innerHTML = `
        (function () {
          try {
            const CMS_DATA = ${dataJSON || 'null'};
            ${js}
          } catch (error) {
            console.error('Error executing CMS injected script:', error);
          }
        })();
      `;

      containerRef.current.appendChild(scriptElement);
    }

    executeScript();

    return () => {
      isMounted = false;

      if (scriptElement && containerRef.current?.contains(scriptElement)) {
        containerRef.current.removeChild(scriptElement);
      }
    };
  }, [dataJSON, js]);

  return (
    <div className="cms-dynamic-renderer w-full" ref={containerRef} key={id}>
      {css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      {processedHtml ? (
        <div
          className="dynamic-html-container w-full h-full"
          dangerouslySetInnerHTML={{ __html: processedHtml }}
        />
      ) : null}
    </div>
  );
}
