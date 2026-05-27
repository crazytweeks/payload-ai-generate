import type { Block, Field } from 'payload';
import { aiComposerUICollectionSlug } from '../../collections/constants';

export type AiComposerUiBlockOptions = {
  interfaceName?: string;
  slug?: string;
};

export const buildAiComposerUiBlockFields = (): Field[] => [
  {
    name: 'composerUI',
    type: 'relationship',
    relationTo: aiComposerUICollectionSlug,
    required: true,
    label: 'AI Composer UI',
    admin: {
      description:
        'Select an AI Composer UI document whose generated multi-file source files should be rendered by this block.',
    },
  },
];

export const buildAiComposerUiBlock = ({
  interfaceName = 'AiComposerUiBlockType',
  slug = 'ai-composer-ui-block',
}: AiComposerUiBlockOptions = {}): Block => ({
  slug,
  admin: {},
  interfaceName,
  fields: [...buildAiComposerUiBlockFields()],
});

export const aiComposerUiBlockFields = buildAiComposerUiBlockFields();
export const AiComposerUiBlock = buildAiComposerUiBlock();
