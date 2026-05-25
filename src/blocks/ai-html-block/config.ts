import type { Block, Field } from 'payload';
import { aiPromptCollectionSlug } from '../../collections/constants';

export type AiHtmlBlockOptions = {
  interfaceName?: string;
  slug?: string;
};

export const buildAiHtmlBlockFields = (): Field[] => [
  {
    name: 'code',
    type: 'relationship',
    relationTo: aiPromptCollectionSlug,
    required: true,
    label: 'AI Prompt',
    admin: {
      description:
        'Select an AI prompt document whose generated HTML, CSS, JS, and variables should be rendered by this block.',
    },
  },
];

export const buildAiHtmlBlock = ({
  interfaceName = 'AiHtmlBlockType',
  slug = 'ai-html-block',
}: AiHtmlBlockOptions = {}): Block => ({
  slug,
  admin: {},
  interfaceName,
  fields: [...buildAiHtmlBlockFields()],
});

export const aiHtmlBlockFields = buildAiHtmlBlockFields();
export const AiHtmlBlock = buildAiHtmlBlock();
