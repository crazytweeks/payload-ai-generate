import type { ToolSet } from 'ai';
import type { AIProviderName, AIReferenceDataSource } from '../ai-types';

export type ComposerMessage = {
  content: string;
  createdAt: string;
  role: 'assistant' | 'user';
};

export type ComposerPlan = {
  approach: string;
  components: string[];
  dataMapping: string;
  design: string;
  notes?: string;
};

export type ComposerStreamParams = {
  abortSignal?: AbortSignal;
  firstPrompt: string;
  messages?: ComposerMessage[];
  model?: string;
  provider?: AIProviderName;
  references?: AIReferenceDataSource[];
  requestTools?: ToolSet;
  system?: string;
};
