import type { PayloadHandler } from 'payload';
import type { AIPreviewAdditionalData } from '../ai-types';
import { aiPromptCollectionSlug } from '../collections/constants';

type VariableItem = {
  key?: string;
  value?: string;
};

type AIPromptPreviewDoc = {
  css?: string | null;
  dataJSON?: string | null;
  html?: string | null;
  js?: string | null;
  variablesJSON?: string | null;
};

const escapeScriptValue = (value: string) =>
  value.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');

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

const buildPreviewDocument = ({
  css,
  dataJSON,
  defaultAdditionalData,
  html,
  js,
  serverURL,
  variablesJSON,
}: {
  css?: string | null;
  dataJSON?: string | null;
  defaultAdditionalData?: AIPreviewAdditionalData;
  html: string;
  js?: string | null;
  serverURL: string;
  variablesJSON?: string | null;
}) => {
  const processedHtml = applyVariables(html, parseVariables(variablesJSON));
  const safeServerURL = escapeScriptValue(serverURL);
  const safeDataJSON = dataJSON?.trim() ? dataJSON : 'null';
  const combinedCSS = [
    defaultAdditionalData?.injectTailwind ? tailwindPreviewStylesheet : '',
    defaultAdditionalData?.beforeCSS ?? '',
    css ?? '',
    defaultAdditionalData?.afterCSS ?? '',
  ]
    .filter((value) => value.trim())
    .join('\n');
  const combinedJS = [
    defaultAdditionalData?.beforeJS ?? '',
    js ?? '',
    defaultAdditionalData?.afterJS ?? '',
  ]
    .filter((value) => value.trim())
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AI Prompt Preview</title>
    <style>
      html, body {
        margin: 0;
        min-height: 100%;
        background: #fff;
      }
    </style>
    ${combinedCSS.trim() ? `<style>${combinedCSS}</style>` : ''}
  </head>
  <body>
    <div id="ai-generate-preview-root">${processedHtml}</div>
    <script>
      (function () {
        const serverURL = \`${safeServerURL}\`;
        const notifyReady = function () {
          try {
            const target = window.opener || window.parent;
            if (!target || !serverURL) return;
            target.postMessage({ type: 'payload-live-preview', ready: true }, serverURL);
          } catch (error) {
            console.error('AI prompt preview ready message failed', error);
          }
        };

        window.addEventListener('message', function (event) {
          if (event.origin !== serverURL) return;
          if (!event.data || typeof event.data !== 'object') return;
          if (event.data.type !== 'payload-document-event') return;
          window.location.reload();
        });

        notifyReady();

        try {
          const CMS_DATA = ${safeDataJSON};
          ${combinedJS.trim() ? combinedJS : ''}
        } catch (error) {
          console.error('AI prompt preview script failed', error);
        }
      })();
    </script>
  </body>
</html>`;
};

export const previewEndpointHandler: PayloadHandler = async (req) => {
  const requestURL = req.url ? new URL(req.url) : null;
  const previewSecret = requestURL?.searchParams.get('previewSecret');
  const id = requestURL?.searchParams.get('id');

  if (previewSecret !== process.env.PREVIEW_SECRET) {
    return new Response('You are not allowed to preview this page', { status: 403 });
  }

  if (!id) {
    return new Response('Insufficient search params', { status: 404 });
  }

  let user: unknown;

  try {
    const authResult = await req.payload.auth({
      headers: req.headers,
      req,
    });
    user = 'user' in authResult ? authResult.user : authResult;
  } catch (error) {
    req.payload.logger.error({ err: error }, 'Error verifying token for AI prompt preview');
    return new Response('You are not allowed to preview this page', { status: 403 });
  }

  if (!user) {
    return new Response('You are not allowed to preview this page', { status: 403 });
  }

  let doc: AIPromptPreviewDoc | null = null;

  try {
    doc = (await req.payload.findByID({
      collection: aiPromptCollectionSlug,
      id,
      draft: true,
      overrideAccess: true,
      req,
    })) as AIPromptPreviewDoc | null;
  } catch {
    doc = null;
  }

  if (!doc) {
    return new Response('Preview document not found', { status: 404 });
  }

  const origin =
    requestURL?.origin ||
    process.env.PAYLOAD_PUBLIC_SERVER_URL ||
    process.env.NEXT_PUBLIC_SERVER_URL ||
    '';
  const html = typeof doc.html === 'string' ? doc.html : '';
  const defaultAdditionalData = (
    req.payload.config.custom?.aiPluginOptions as {
      defaultAdditionalData?: AIPreviewAdditionalData;
    }
  )?.defaultAdditionalData;

  if (!html.trim() || !origin) {
    return new Response('Preview document is missing HTML content or origin', { status: 400 });
  }

  return new Response(
    buildPreviewDocument({
      css: typeof doc.css === 'string' ? doc.css : '',
      dataJSON: typeof doc.dataJSON === 'string' ? doc.dataJSON : '',
      defaultAdditionalData,
      html,
      js: typeof doc.js === 'string' ? doc.js : '',
      serverURL: origin,
      variablesJSON: typeof doc.variablesJSON === 'string' ? doc.variablesJSON : '',
    }),
    {
      headers: {
        'cache-control': 'no-store',
        'content-type': 'text/html; charset=utf-8',
      },
      status: 200,
    }
  );
};
