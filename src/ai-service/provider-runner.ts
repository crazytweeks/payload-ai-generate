import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';
import type {
  AIGenerateTextParams,
  AIPluginOptions,
  AIProviderName,
  AIStreamTextParams,
  PayloadAIService,
} from '../ai-types';
import type { GoogleModelId, OpenAIModelId } from '../models';
import { createBlockStreamGenerator } from './block-stream';
import { resolveOptions } from './options';

type PromptRunner = {
  generate: PayloadAIService['generateText'];
  stream: PayloadAIService['streamText'];
  streamBlockGeneration: PayloadAIService['streamBlockGeneration'];
};

type ProviderModelIdMap = {
  google: GoogleModelId;
  openai: OpenAIModelId;
};

const _DefaultModelIdMap: ProviderModelIdMap = {
  google: 'gemini-pro-latest',
  openai: 'gpt-5.4-pro',
} as const;

/**
 * Builds provider-specific generate/stream helpers used by the exported AI service.
 *
 * @param options - Plugin options used to configure provider clients and defaults.
 * @returns Internal runner object that powers `payload.ai`.
 *
 * @example
 * ```ts
 * const runner = createPromptRunner({
 *   defaultProvider: 'google',
 *   googleApiKey: process.env.GOOGLE_AI_API,
 * });
 * ```
 */
export const createPromptRunner = (options: AIPluginOptions): PromptRunner => {
  const resolvedOptions = resolveOptions(options);

  const google = resolvedOptions.googleApiKey
    ? createGoogleGenerativeAI({ apiKey: resolvedOptions.googleApiKey })
    : null;

  const openai = resolvedOptions.openaiApiKey
    ? createOpenAI({ apiKey: resolvedOptions.openaiApiKey })
    : null;

  /**
   * Resolves the provider used for the current request.
   *
   * @param provider - Optional explicit provider from the caller.
   * @returns Explicit provider when present, otherwise the configured default.
   */
  const getPrimaryProvider = (provider?: AIProviderName) =>
    provider ?? resolvedOptions.defaultProvider ?? 'google';

  /**
   * Returns the package-level default model ID for a provider.
   *
   * @param provider - Provider name used by the request.
   * @returns Default model ID narrowed to the requested provider.
   */
  const getDefaultModelId = <TProvider extends AIProviderName>(
    provider: TProvider
  ): ProviderModelIdMap[TProvider] => _DefaultModelIdMap[provider] as ProviderModelIdMap[TProvider];

  /**
   * Resolves a provider/model pair into a concrete AI SDK model instance.
   *
   * @param provider - Provider to resolve.
   * @param model - Optional explicit model override.
   * @returns AI SDK model instance passed to `generateText` / `streamText`.
   *
   * @example
   * ```ts
   * const model = resolveProviderModel('google', 'gemini-2.5-flash');
   * ```
   */
  const resolveProviderModel = (provider: AIProviderName, model?: string) => {
    if (provider === 'google') {
      if (!google) {
        throw new Error('Google API key not configured');
      }

      return google(model ?? getDefaultModelId(provider));
    }

    if (!openai) {
      throw new Error('OpenAI API key not configured');
    }

    return openai(model ?? getDefaultModelId(provider));
  };

  const streamBlockGeneration = createBlockStreamGenerator({
    getDefaultModelId,
    getPrimaryProvider,
    resolveProviderModel,
    resolvedOptions,
  });

  /**
   * Runs a single non-streaming text generation request.
   *
   * @param params - Text-generation params accepted by `payload.ai.generateText`.
   * @returns Generated text plus the provider that produced it.
   *
   * @example
   * ```ts
   * const result = await runner.generate({
   *   prompt: 'Summarize this section.',
   *   provider: 'openai',
   * });
   * ```
   */
  const generate = async ({
    prompt,
    system,
    provider,
    fallback = true,
    model,
  }: AIGenerateTextParams) => {
    const primaryProvider = getPrimaryProvider(provider);

    const run = async (providerToUse: AIProviderName) => {
      const result = await generateText({
        model: resolveProviderModel(providerToUse, model),
        prompt,
        system,
      });

      return {
        providerUsed: providerToUse,
        text: result.text,
      };
    };

    try {
      return await run(primaryProvider);
    } catch (error) {
      if (!fallback) {
        throw error;
      }

      const fallbackProvider = primaryProvider === 'google' ? 'openai' : 'google';
      return run(fallbackProvider);
    }
  };

  /**
   * Runs a low-level raw text stream without block orchestration.
   *
   * @param params - Stream params accepted by `payload.ai.streamText`.
   * @returns Raw AI SDK stream result.
   *
   * @example
   * ```ts
   * const stream = runner.stream({
   *   prompt: 'Explain the design system.',
   *   provider: 'google',
   * });
   * ```
   */
  const stream = ({ prompt, system, provider, model }: AIStreamTextParams) => {
    const primaryProvider = getPrimaryProvider(provider);

    return streamText({
      model: resolveProviderModel(primaryProvider, model),
      prompt,
      system,
    });
  };

  return {
    generate,
    stream,
    streamBlockGeneration,
  };
};

/**
 * Creates the runtime AI service exposed on `payload.ai`.
 *
 * @param pluginOptions - Plugin options used to configure provider clients and defaults.
 * @returns Public AI service mounted on the Payload instance.
 *
 * @example
 * ```ts
 * const aiService = aiServiceCreate({
 *   defaultProvider: 'google',
 * });
 * ```
 */
export const aiServiceCreate = (pluginOptions: AIPluginOptions): PayloadAIService => {
  const runner = createPromptRunner(pluginOptions);

  return {
    generateText: runner.generate,
    streamText: runner.stream,
    streamBlockGeneration: runner.streamBlockGeneration,
  };
};
