import type { Block, Field } from 'payload';
import { aiPromptCollectionSlug } from '../../collections/constants';

export type DangerousCustomRenderBlockOptions = {
  interfaceName?: string;
  slug?: string;
};

export const buildDangerousCustomRenderBlockFields = (): Field[] => [
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

export const buildDangerousCustomRenderBlock = ({
  interfaceName = 'DangerousCustomRenderBlockType',
  slug = 'dangerous-custom-render',
}: DangerousCustomRenderBlockOptions = {}): Block => ({
  slug,
  admin: {},
  interfaceName,
  fields: [...buildDangerousCustomRenderBlockFields()],
});

export const dangerousCustomRenderBlockFields = buildDangerousCustomRenderBlockFields();
export const DangerousCustomRenderBlock = buildDangerousCustomRenderBlock();
