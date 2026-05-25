import type { BasePayload } from 'payload';
import { aiPromptCollectionSlug } from '../../collections/constants';
import { AiHtmlBlockComponentClient } from './ClientComponent';
import { withServerReferenceData } from './referenceData';
import type { AiHtmlBlockProps, AiHtmlPromptDoc } from './types';

const fetchPromptDoc = async (
  promptId: number | string,
  payload: BasePayload | undefined
): Promise<AiHtmlPromptDoc | null> => {
  if (!payload) {
    console.error('[AiHtmlBlock] Payload instance is required to fetch prompt document');
    return null;
  }

  if (!promptId) {
    console.error('[AiHtmlBlock] Prompt ID is required to fetch prompt document');
    return null;
  }

  try {
    const doc = await payload.findByID({
      id: promptId,
      collection: aiPromptCollectionSlug,
    });

    return (doc as AiHtmlPromptDoc) ?? null;
  } catch (_err) {
    return null;
  }
};

export const resolveAiHtmlPromptDoc = async ({
  code,
  payload,
}: Pick<AiHtmlBlockProps, 'code' | 'payload'>) => {
  if (!code) {
    return null;
  }

  const promptDoc = typeof code === 'object' ? code : await fetchPromptDoc(code, payload);
  return withServerReferenceData(promptDoc, payload);
};

export const AiHtmlBlockComponent = async ({ code, payload }: AiHtmlBlockProps) => {
  if (!code) {
    return <div>No AI prompt selected</div>;
  }

  const promptDocWithReferences = await resolveAiHtmlPromptDoc({ code, payload });

  return <AiHtmlBlockComponentClient code={promptDocWithReferences} />;
};

export default AiHtmlBlockComponent;
