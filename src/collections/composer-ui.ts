import type { CollectionConfig } from 'payload';
import { aiComposerCollectionSlug, aiComposerUICollectionSlug } from './constants';

export const buildAIComposerUICollection = (): CollectionConfig => ({
  slug: aiComposerUICollectionSlug,
  admin: {
    group: 'AI',
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'updatedAt'],
    description: 'AI-generated multi-file UI outputs linked to a Composer planning session.',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Generating', value: 'generating' },
        { label: 'Complete', value: 'complete' },
        { label: 'Error', value: 'error' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'composerSession',
      type: 'relationship',
      relationTo: aiComposerCollectionSlug,
      admin: {
        position: 'sidebar',
        description: 'The planning session this UI was generated from.',
      },
    },
    {
      name: 'plan',
      type: 'json',
      admin: {
        readOnly: true,
        description: 'The generation plan used to produce this UI.',
      },
    },
    {
      name: 'files',
      type: 'array',
      admin: {
        description: 'Generated source files. index.html is the entry point.',
      },
      fields: [
        {
          name: 'path',
          type: 'text',
          required: true,
          admin: { description: 'Relative path e.g. index.html, styles.css, script.js' },
        },
        {
          name: 'language',
          type: 'select',
          required: true,
          defaultValue: 'html',
          options: [
            { label: 'HTML', value: 'html' },
            { label: 'CSS', value: 'css' },
            { label: 'JavaScript', value: 'javascript' },
            { label: 'JSON', value: 'json' },
            { label: 'TypeScript', value: 'typescript' },
            { label: 'TSX', value: 'tsx' },
          ],
        },
        {
          name: 'content',
          type: 'textarea',
          required: true,
          admin: { rows: 20 },
        },
        {
          name: 'isEntryPoint',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Mark as the main entry point (index.html)' },
        },
      ],
    },
    {
      name: 'generationLog',
      type: 'textarea',
      admin: {
        hidden: true,
        readOnly: true,
        description: 'AI generation trace — steps, tool calls, token counts.',
      },
    },
  ],
});
