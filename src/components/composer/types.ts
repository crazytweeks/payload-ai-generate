import type { AIReferenceDataSource } from '../../ai-types';
import type { ComposerPlan } from '../../composer/types';

export type { AIReferenceDataSource, ComposerPlan };

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
  language: string;
  path: string;
};
