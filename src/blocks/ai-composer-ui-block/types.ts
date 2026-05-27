import type { BasePayload } from 'payload';
import type { ComposerUIFile } from '../../composer-ui';

export type AiComposerUiDoc = {
  id?: number | string | null;
  title?: string | null;
  status?: 'draft' | 'generating' | 'complete' | 'error' | null;
  plan?: Record<string, unknown> | null;
  files?: ComposerUIFile[] | null;
  generationLog?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
};

export type AiComposerUiBlockProps = {
  id?: number | string | null;
  composerUI?: AiComposerUiDoc | number | string | null;
  payload?: BasePayload;
};
