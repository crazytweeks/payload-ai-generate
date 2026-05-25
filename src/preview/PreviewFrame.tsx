/** biome-ignore-all lint/security/noDangerouslySetInnerHtml: PreviewFrame renders AI-generated content inside Payload's own admin preview iframe, which already provides page-level isolation from the host app. */
'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { AIPreviewAdditionalData } from '../ai-types';

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

  /**
   * Optional additional data that can be used in the preview. This is not stored in the database, but can be passed from the server when rendering the preview page. It can be used to provide additional context or data that might be needed for the preview, without having to store it in the database.
   * For example, you could use this to pass user information, feature flags, or any other relevant data that should be available in the preview but doesn't need to be persisted. This allows for more dynamic and flexible previews without cluttering the database with transient data.
   *
   * Note: This data will be available in the global scope of the preview page, so it can be accessed by the custom JS included in the prompt. You can choose to structure this data in a way that makes it easy to access and use within the preview.
   * EX: defaultAdditionalData={{ beforeJS: 'const user = { name: "John Doe" };' }} would make the `user` variable available in the JS context of the preview.
   * EX: Tailwind added as default CSS: defaultAdditionalData={{ injectTailwind: true }} would allow the use of Tailwind classes in the preview HTML.
   */
  defaultAdditionalData?: AIPreviewAdditionalData;
};

const tailwindPreviewStylesheet =
  '@import url("https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css");';

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

export function PreviewFrame({
  css,
  dataJSON,
  defaultAdditionalData,
  html,
  js,
  variablesJSON,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const processedHtml = useMemo(
    () => applyVariables(html, parseVariables(variablesJSON)),
    [html, variablesJSON]
  );
  const combinedCSS = useMemo(() => {
    const cssParts = [
      defaultAdditionalData?.injectTailwind ? tailwindPreviewStylesheet : '',
      defaultAdditionalData?.beforeCSS ?? '',
      css ?? '',
      defaultAdditionalData?.afterCSS ?? '',
    ].filter((value) => value.trim());

    return cssParts.join('\n');
  }, [
    css,
    defaultAdditionalData?.afterCSS,
    defaultAdditionalData?.beforeCSS,
    defaultAdditionalData?.injectTailwind,
  ]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const combinedJS = [
      defaultAdditionalData?.beforeJS ?? '',
      js ?? '',
      defaultAdditionalData?.afterJS ?? '',
    ]
      .filter((value) => value.trim())
      .join('\n');

    if (!combinedJS.trim()) {
      return;
    }

    const scriptElement = document.createElement('script');
    scriptElement.type = 'text/javascript';
    scriptElement.innerHTML = `
      (function () {
        try {
          const CMS_DATA = ${dataJSON?.trim() ? dataJSON : 'null'};
          ${combinedJS}
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
  }, [dataJSON, defaultAdditionalData?.afterJS, defaultAdditionalData?.beforeJS, js]);

  return (
    <div ref={containerRef} style={{ minHeight: '100vh' }}>
      {combinedCSS.trim() ? <style dangerouslySetInnerHTML={{ __html: combinedCSS }} /> : null}
      <div dangerouslySetInnerHTML={{ __html: processedHtml }} />
    </div>
  );
}
