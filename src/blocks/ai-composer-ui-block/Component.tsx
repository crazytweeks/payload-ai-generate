import type { BasePayload } from 'payload';
import { aiComposerUICollectionSlug } from '../../collections/constants';
import { AiComposerUiBlockComponentClient } from './ClientComponent';
import type { AiComposerUiBlockProps, AiComposerUiDoc } from './types';

const fetchComposerUiDoc = async (
  uiId: number | string,
  payload: BasePayload | undefined
): Promise<AiComposerUiDoc | null> => {
  if (!payload) {
    console.error('[AiComposerUiBlock] Payload instance is required to fetch UI document');
    return null;
  }

  if (!uiId) {
    console.error('[AiComposerUiBlock] UI ID is required to fetch UI document');
    return null;
  }

  try {
    const doc = await payload.findByID({
      id: uiId,
      collection: aiComposerUICollectionSlug,
    });

    return (doc as AiComposerUiDoc) ?? null;
  } catch (_err) {
    return null;
  }
};

export const resolveAiComposerUiDoc = async ({
  composerUI,
  payload,
}: Pick<AiComposerUiBlockProps, 'composerUI' | 'payload'>) => {
  if (!composerUI) {
    return null;
  }

  return typeof composerUI === 'object'
    ? composerUI
    : await fetchComposerUiDoc(composerUI, payload);
};

export const AiComposerUiBlockComponent = async ({
  id,
  composerUI,
  payload,
}: AiComposerUiBlockProps) => {
  if (!composerUI) {
    return <div>No AI Composer UI selected</div>;
  }

  const uiDoc = await resolveAiComposerUiDoc({ composerUI, payload });

  return <AiComposerUiBlockComponentClient id={id} composerUI={uiDoc} />;
};

export default AiComposerUiBlockComponent;
