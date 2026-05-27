import type { ComposerPlan } from '@plugin/composer/types';

export type { ComposerPlan };

export type ReferenceRow = { collection: string; id: string; limit: number };

export type ComposerMode =
  | 'idle'
  | 'planning'
  | 'plan-ready'
  | 'refining'
  | 'generating'
  | 'generated';

export type GeneratedFile = {
  content: string;
  isEntryPoint: boolean;
  language: 'css' | 'html' | 'javascript' | 'json' | 'tsx' | 'typescript';
  path: string;
};
