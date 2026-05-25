import type { ModelMessage, streamText } from 'ai';
import type { ToolSet } from 'ai';
import type { CollectionSlug } from 'payload';
import { type GoogleModelId, models, type OpenAIModelId } from './models';

const aiProviders = Object.keys(models) as Array<keyof typeof models>;
export type AIProviderName = (typeof aiProviders)[number];

export type AIGenerationStage =
  | 'starting'
  | 'gathering-context'
  | 'thinking'
  | 'tool-calling'
  | 'generating'
  | 'repairing'
  | 'finalizing'
  | 'done'
  | 'error';

export type AIGenerationField =
  | 'html'
  | 'css'
  | 'js'
  | 'variablesJSON'
  | 'dataJSON'
  | 'blockPayloadJSON';

export type AIGeneratedVariable = {
  key: string;
  value: string;
};

export type AIGeneratedHtmlBlock = {
  html: string;
  css?: string;
  js?: string;
  variables?: unknown;
  data?: unknown;
};

export type AIGenerationOutcome =
  | 'completed'
  | 'completed-with-normalization'
  | 'completed-after-repair'
  | 'failed-with-partial-output'
  | 'failed-no-usable-output';

export type AIGenerationRunSummary = {
  lastError?: string | null;
  maxRepairAttempts: number;
  modelId: string;
  outcome: AIGenerationOutcome;
  provider: AIProviderName;
  repairAttemptsUsed: number;
};

export type AIConversationRole = 'user' | 'assistant' | 'system';

export type AIConversationMessage = {
  content: string;
  createdAt: string;
  metadata?: {
    modelId?: string;
    outcome?: AIGenerationOutcome;
    provider?: AIProviderName;
    repairAttempt?: number;
    source?: 'followup' | 'instructions' | 'repair';
  };
  role: AIConversationRole;
};

export type AIGenerationFinalPayload = {
  blockPayload: {
    blockType: 'ai-html-block';
    css: string;
    data: unknown;
    html: string;
    js: string;
    variables: AIGeneratedVariable[];
  };
  css: string;
  dataJSON: string;
  html: string;
  js: string;
  run: AIGenerationRunSummary;
  variablesJSON: string;
};

export type AIGenerationEvent =
  | {
      type: 'status';
      attempt?: number;
      maxAttempts?: number;
      message?: string;
      modelId?: string;
      provider?: AIProviderName;
      reason?: string;
      stage: AIGenerationStage;
    }
  | {
      type: 'tool-call';
      toolCallId: string;
      toolName: string;
      summary?: string;
    }
  | {
      type: 'tool-result';
      toolCallId: string;
      toolName: string;
      summary?: string;
    }
  | {
      items: Array<{
        kind: 'file' | 'image';
        label: string;
        mimeType?: string;
        url?: string;
      }>;
      mode?: 'direct-upload' | 'metadata-only';
      type: 'references';
    }
  | {
      type: 'field-update';
      field: AIGenerationField;
      value: string;
    }
  | {
      type: 'text-delta';
      value: string;
    }
  | {
      attempt: number;
      maxAttempts: number;
      reason: string;
      type: 'repair-start';
    }
  | {
      attempt: number;
      fixed: boolean;
      message: string;
      type: 'repair-result';
    }
  | ({
      type: 'final';
    } & AIGenerationFinalPayload)
  | {
      message: string;
      run?: AIGenerationRunSummary;
      stage?: AIGenerationStage;
      type: 'error';
    };

export interface AIPluginToolingOptions {
  enabled?: boolean;
}

export type AIReferenceCollectionsConfig = Record<CollectionSlug | string, boolean>;

export interface AIPreviewAdditionalData {
  beforeCSS?: string;
  afterCSS?: string;
  beforeJS?: string;
  afterJS?: string;
  injectTailwind?: boolean;
}

/**
 * Options accepted by `aiGenerate()`.
 */
export interface AIPluginOptions {
  googleApiKey?: string;
  openaiApiKey?: string;
  defaultProvider?: AIProviderName;
  disabled?: boolean;
  referenceMediaCollectionSlug?: CollectionSlug | string;
  referenceCollections?: AIReferenceCollectionsConfig;
  devTestCollections?: boolean;
  previewPagePath?: string;
  defaultAdditionalData?: AIPreviewAdditionalData;
  tooling?: AIPluginToolingOptions;
  contextRoots?: string[];
  contextAllowlist?: string[];
  contextFileExtensions?: string[];
  contextMaxFileBytes?: number;
  contextMaxToolCallsPerRequest?: number;
  generationMaxRepairAttempts?: number;
}

type AIProviderParams = {
  fallback?: boolean;
  model?: GoogleModelId | OpenAIModelId | string;
  prompt: string;
  provider?: AIProviderName;
  system?: string;
};

export type AIGenerateTextParams = AIProviderParams;
export type AIStreamTextParams = Omit<AIProviderParams, 'fallback'>;

export type AIGenerationArtifact = {
  css?: string;
  dataJSON?: string;
  html?: string;
  js?: string;
  variablesJSON?: string;
};

export type AIReferenceDataSource = {
  collection?: string | null;
  dataLoading?: 'client' | 'server' | null;
  filtersJSON?: string | null;
  id?: number | string | null;
  isBeingUsed?: boolean | null;
  limit?: number | null;
};

export type AIStreamBlockGenerationParams = AIStreamTextParams & {
  abortSignal?: AbortSignal;
  currentArtifact?: AIGenerationArtifact;
  existingMessages?: AIConversationMessage[];
  messages?: ModelMessage[];
  mode?: 'followup' | 'generate' | 'retry-fix';
  requestTools?: ToolSet;
};

/**
 * Runtime surface exposed on `payload.ai`.
 */
export interface PayloadAIService {
  generateText: (params: AIGenerateTextParams) => Promise<{
    text: string;
    providerUsed: AIProviderName;
  }>;
  streamText: (params: AIStreamTextParams) => ReturnType<typeof streamText>;
  streamBlockGeneration: (
    params: AIStreamBlockGenerationParams
  ) => AsyncIterable<AIGenerationEvent>;
}

declare module 'payload' {
  export interface BasePayload {
    ai?: PayloadAIService;
  }
}
