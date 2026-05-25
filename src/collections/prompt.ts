import type { CollectionConfig, CollectionSlug, UIField } from 'payload';
import type { AIPluginOptions } from '../ai-types';
import { aiPresetCollectionSlug, aiPromptCollectionSlug } from './constants';

/**
 * Builds the live preview URL for an AI prompt document.
 */
const generatePreviewPath = (
  id: number | string | undefined | null,
  apiRoute: string = '/api',
  previewPagePath?: string
) => {
  if (id === undefined || id === null || id === '') {
    return '/';
  }

  const encodedID = encodeURIComponent(String(id));

  if (previewPagePath?.trim()) {
    const normalizedPreviewPagePath = previewPagePath.startsWith('/')
      ? previewPagePath
      : `/${previewPagePath}`;
    const searchParams = new URLSearchParams({
      collection: aiPromptCollectionSlug,
      path: `${normalizedPreviewPagePath}/${encodedID}`,
      previewSecret: process.env.PREVIEW_SECRET || '',
      slug: encodedID,
    });

    return `/next/preview?${searchParams.toString()}`;
  }

  const searchParams = new URLSearchParams({
    id: encodedID,
    previewSecret: process.env.PREVIEW_SECRET || '',
  });

  return `${apiRoute}/ai-generate/preview?${searchParams.toString()}`;
};

/**
 * Reusable admin UI field that mounts the AI composer client component.
 */
const aiComposerField = (pluginOptions: AIPluginOptions = {}): UIField => ({
  name: 'aiComposer',
  type: 'ui',
  admin: {
    components: {
      Field: {
        path: '@flash-lightning/ai-generate/client#AIGenerateComposerField',
        clientProps: {
          attachmentsFieldPath: pluginOptions.referenceMediaCollectionSlug
            ? 'referenceFiles'
            : null,
          messagesFieldPath: 'messages',
          lastRunFieldPath: 'lastRun',
          presetFieldPath: 'preset',
          titleFieldPath: 'title',
          instructionsFieldPath: 'instructions',
          htmlFieldPath: 'html',
          cssFieldPath: 'css',
          jsFieldPath: 'js',
          variablesJsonFieldPath: 'variablesJSON',
          dataJsonFieldPath: 'dataJSON',
          blockPayloadFieldPath: 'blockPayloadJSON',
        },
      },
    },
  },
  label: 'AI Composer',
});

/**
 * Builds the collection used to author prompt-driven generated block output.
 */
export const buildAIPromptCollection = ({
  apiRoute = '/api',
  previewPagePath,
  pluginOptions = {},
}: {
  apiRoute?: string;
  previewPagePath?: string;
  pluginOptions?: AIPluginOptions;
} = {}): CollectionConfig => ({
  slug: aiPromptCollectionSlug,
  labels: {
    singular: 'AI Prompt',
    plural: 'AI Prompts',
  },
  admin: {
    defaultColumns: ['title', 'updatedAt'],
    useAsTitle: 'title',
    group: 'AI',
    description: 'Generate HTML block code that can be pasted into Payload blocks fields.',
    livePreview: {
      url: ({ data }) =>
        generatePreviewPath(
          typeof data?.id === 'string' || typeof data?.id === 'number' ? data.id : null,
          apiRoute,
          previewPagePath
        ),
    },
    preview: (data) =>
      generatePreviewPath(
        typeof data?.id === 'string' || typeof data?.id === 'number' ? data.id : null,
        apiRoute,
        previewPagePath
      ),
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'preset',
      type: 'relationship',
      admin: {
        description: 'Optional preset that defines system prompt, provider, and model.',
      },
      relationTo: aiPresetCollectionSlug as never,
    },
    {
      name: 'instructions',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Describe the block you want to generate.',
        rows: 8,
      },
    },
    ...(pluginOptions.referenceMediaCollectionSlug
      ? [
          {
            name: 'referenceFiles',
            type: 'upload',
            relationTo: pluginOptions.referenceMediaCollectionSlug as any as CollectionSlug,
            hasMany: true,
            admin: {
              description:
                'Optional images or files to pass to the AI as reference material for this prompt or follow-up.',
            },
          } as const,
        ]
      : []),
    aiComposerField(pluginOptions),
    {
      name: 'messages',
      type: 'json',
      admin: {
        description: 'Persisted conversation history used for follow-up AI edits.',
        hidden: true,
        readOnly: true,
      },
      defaultValue: [],
    },
    {
      name: 'lastRun',
      type: 'json',
      admin: {
        description: 'Persisted summary of the last AI generation run.',
        hidden: true,
        readOnly: true,
      },
    },
    {
      name: 'html',
      type: 'code',
      required: true,
      admin: {
        language: 'html',
        description: 'Generated HTML for dangerous-custom-render block.',
      },
    },
    {
      name: 'css',
      type: 'code',
      admin: {
        language: 'css',
        description: 'Optional generated CSS for dangerous-custom-render block.',
      },
    },
    {
      name: 'js',
      type: 'code',
      admin: {
        language: 'javascript',
        description: 'Optional generated JavaScript for dangerous-custom-render block.',
      },
    },
    {
      name: 'variablesJSON',
      type: 'code',
      admin: {
        language: 'json',
        description:
          'JSON array for the block variables field. Example: [{"key":"heading","value":"Hello"}]',
      },
    },
    {
      name: 'dataJSON',
      type: 'code',
      admin: {
        language: 'json',
        description: 'Optional JSON payload for the block data field.',
      },
    },
    {
      name: 'blockPayloadJSON',
      type: 'code',
      admin: {
        language: 'json',
        readOnly: true,
        description:
          'Ready-to-paste Payload blocks item for slug "dangerous-custom-render". React renderer support is pending (TODO).',
      },
    },
  ],
  versions: {
    drafts: {
      autosave: {
        interval: 100,
      },
    },
  },
  timestamps: true,
});
