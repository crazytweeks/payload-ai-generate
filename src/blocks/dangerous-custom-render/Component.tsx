import type { BasePayload } from 'payload';
import type { AIGeneratedDangerousCustomRenderBlock } from '../../ai-types';
import { aiPresetCollectionSlug } from '../../collections/constants';
import { DangerousCustomRenderBlockComponentClient } from './ClientComponent';
import type { DangerousCustomRenderBlockProps } from './types';

const getCodeBlocks = async (codeId: number | string, payload: BasePayload | undefined) => {
  if (!payload) {
    console.error('Payload is required to fetch code blocks');
    return null;
  }

  if (!codeId) {
    console.error('Code ID is required to fetch code blocks');
    return null;
  }

  try {
    const codeBlock = await payload.findByID({
      id: codeId,
      collection: aiPresetCollectionSlug,
      // overrideAccess: true
    }) as unknown as AIGeneratedDangerousCustomRenderBlock;

    return codeBlock?.data || null;
  } catch (_err) {
    return null;
  }
};

export const DangerousCustomRenderBlockComponent = async ({
  code,
  payload,
}: DangerousCustomRenderBlockProps) => {
  if (!code) {
    return <div>No code provided</div>;
  }

  const promptDoc = typeof code === 'object' ? code : await getCodeBlocks(code, payload);
  return <DangerousCustomRenderBlockComponentClient code={promptDoc} />;
};

export default DangerousCustomRenderBlockComponent;
