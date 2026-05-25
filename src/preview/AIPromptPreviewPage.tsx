import config from '@payload-config';
import { draftMode } from 'next/headers';
import { notFound } from 'next/navigation';
import { getPayload } from 'payload';
import { cache } from 'react';
import type { AIPreviewAdditionalData } from '../ai-types';
import { aiPromptCollectionSlug } from '../collections/constants';
import { LivePreviewListener } from './LivePreviewListener';
import { PreviewFrame } from './PreviewFrame';

type Params = {
  id: string;
};

type Props = {
  params: Promise<Params> | Params;
  defaultAdditionalData?: AIPreviewAdditionalData;
  serverURL?: string;
};

type AIPromptPreviewDoc = {
  css?: string | null;
  dataJSON?: string | null;
  html?: string | null;
  js?: string | null;
  variablesJSON?: string | null;
};

const queryPromptByID = cache(async (id: string, draft: boolean) => {
  const payload = await getPayload({ config });

  try {
    return (await payload.findByID({
      collection: aiPromptCollectionSlug,
      id,
      draft,
      overrideAccess: draft,
    })) as AIPromptPreviewDoc | null;
  } catch {
    return null;
  }
});

export async function AIPromptPreviewPage({ defaultAdditionalData, params, serverURL }: Props) {
  const { isEnabled: draft } = await draftMode();
  const resolvedParams = await params;
  const payload = await getPayload({ config });
  const doc = await queryPromptByID(resolvedParams.id, draft);

  if (!doc) {
    notFound();
  }

  const previewDoc = doc;
  const resolvedDefaultAdditionalData =
    defaultAdditionalData ??
    (payload.config.custom?.aiPluginOptions as { defaultAdditionalData?: AIPreviewAdditionalData })
      ?.defaultAdditionalData ??
    undefined;

  return (
    <main
      style={{
        background: '#fff',
        minHeight: '100vh',
      }}
    >
      {draft ? <LivePreviewListener serverURL={serverURL} /> : null}
      <PreviewFrame
        css={typeof previewDoc.css === 'string' ? previewDoc.css : ''}
        dataJSON={typeof previewDoc.dataJSON === 'string' ? previewDoc.dataJSON : ''}
        defaultAdditionalData={resolvedDefaultAdditionalData}
        html={typeof previewDoc.html === 'string' ? previewDoc.html : ''}
        js={typeof previewDoc.js === 'string' ? previewDoc.js : ''}
        variablesJSON={typeof previewDoc.variablesJSON === 'string' ? previewDoc.variablesJSON : ''}
      />
    </main>
  );
}
