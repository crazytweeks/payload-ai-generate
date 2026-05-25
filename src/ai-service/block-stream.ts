import {
  type ModelMessage,
  Output,
  parsePartialJson,
  stepCountIs,
  streamText,
  type ToolSet,
} from 'ai';
import type {
  AIGeneratedDangerousCustomRenderBlock,
  AIGenerationEvent,
  AIGenerationField,
  AIPluginOptions,
  AIProviderName,
  AIStreamBlockGenerationParams,
} from '../ai-types';
import {
  buildBlockGenerationSystemPrompt,
  buildGenerationPayload,
  buildPartialFieldSnapshots,
  buildPartialGenerationPayload,
  buildRepairPrompt,
  createRunSummary,
  generatedDangerousCustomRenderSchema,
  validateGeneratedBlock,
} from '../block-generation';
import { createContextTools } from '../tools/contextTools';
import {
  createEventQueue,
  extractJSONObjectCandidate,
  summarizeEmptyResult,
  truncateSummary,
} from './stream-utils';
import type { ProviderModelResolver, SingleAttemptResult } from './types';

/**
 * Creates the high-level block-generation stream orchestrator used by `payload.ai`.
 *
 * @param params.getDefaultModelId - Returns the default model ID for a provider.
 * @param params.getPrimaryProvider - Resolves the provider to use for a request.
 * @param params.resolveProviderModel - Resolves the provider/model pair into an SDK model instance.
 * @param params.resolvedOptions - Normalized plugin options.
 * @returns Function that streams structured generation events for the admin composer.
 *
 * @example
 * ```ts
 * const streamBlockGeneration = createBlockStreamGenerator({
 *   getDefaultModelId,
 *   getPrimaryProvider,
 *   resolveProviderModel,
 *   resolvedOptions,
 * });
 * ```
 */
export const createBlockStreamGenerator = ({
  getDefaultModelId,
  getPrimaryProvider,
  resolveProviderModel,
  resolvedOptions,
}: {
  getDefaultModelId: (provider: AIProviderName) => string;
  getPrimaryProvider: (provider?: AIProviderName) => AIProviderName;
  resolveProviderModel: ProviderModelResolver;
  resolvedOptions: AIPluginOptions;
}) => {
  return ({
    abortSignal,
    currentArtifact,
    existingMessages = [],
    messages,
    mode = 'generate',
    model,
    prompt,
    provider,
    system,
  }: AIStreamBlockGenerationParams): AsyncIterable<AIGenerationEvent> => {
    const primaryProvider = getPrimaryProvider(provider);
    const modelId = model ?? getDefaultModelId(primaryProvider);
    const tools = createContextTools(resolvedOptions);
    const toolNames = Object.keys(tools);
    const enableTools = primaryProvider !== 'openai' && toolNames.length > 0;
    const queue = createEventQueue<AIGenerationEvent>();
    const systemPrompt = buildBlockGenerationSystemPrompt(system);
    const maxRepairAttempts = resolvedOptions.generationMaxRepairAttempts ?? 3;
    const initialMessages = messages;
    const hasNonTextUserInput = (initialMessages ?? []).some(
      (message) =>
        message.role === 'user' &&
        Array.isArray(message.content) &&
        message.content.some((part) => part.type === 'image' || part.type === 'file')
    );
    const useCompatibilityTextMode =
      primaryProvider === 'openai' || enableTools || hasNonTextUserInput;

    const emitSnapshots = (
      snapshots: Partial<Record<AIGenerationField, string>>,
      previousSnapshots: Map<string, string>
    ) => {
      for (const [field, value] of Object.entries(snapshots)) {
        if (typeof value !== 'string' || previousSnapshots.get(field) === value) {
          continue;
        }

        previousSnapshots.set(field, value);
        queue.push({
          type: 'field-update',
          field: field as AIGenerationField,
          value,
        });
      }
    };

    const emitFailureWithPartial = ({
      errorMessage,
      partialGenerated,
      repairAttemptsUsed,
    }: {
      errorMessage: string;
      partialGenerated: Partial<AIGeneratedDangerousCustomRenderBlock>;
      repairAttemptsUsed: number;
    }) => {
      const partialPayload = buildPartialGenerationPayload({
        generated: partialGenerated,
        lastError: errorMessage,
        maxRepairAttempts,
        modelId,
        provider: primaryProvider,
        repairAttemptsUsed,
      });

      if (partialPayload) {
        queue.push({
          type: 'final',
          ...partialPayload,
        });
      } else {
        queue.push({
          type: 'error',
          message: errorMessage,
          run: {
            lastError: errorMessage,
            maxRepairAttempts,
            modelId,
            outcome: 'failed-no-usable-output',
            provider: primaryProvider,
            repairAttemptsUsed,
          },
          stage: 'error',
        });
      }
    };

    /**
     * Executes one generate-or-repair attempt and returns the raw block candidate.
     *
     * @param params.attempt - Zero-based attempt index.
     * @param params.attemptPrompt - Prompt string used for this attempt.
     * @returns Raw generated block data and partial stream state.
     *
     * @example
     * ```ts
     * const attempt = await runSingleAttempt({
     *   attempt: 0,
     *   attemptPrompt: prompt,
     * });
     * ```
     */
    const runSingleAttempt = async ({
      attempt,
      attemptPrompt,
    }: {
      attempt: number;
      attemptPrompt: string;
    }): Promise<SingleAttemptResult> => {
      const previousSnapshots = new Map<string, string>();
      let hasEmittedGeneratingStatus = false;
      let latestText = '';
      let generated: AIGeneratedDangerousCustomRenderBlock | null = null;
      let partialGenerated: Partial<AIGeneratedDangerousCustomRenderBlock> = {};
      const modelMessages: ModelMessage[] | undefined =
        attempt === 0 && Array.isArray(initialMessages) && initialMessages.length > 0
          ? initialMessages
          : undefined;

      const result = useCompatibilityTextMode
        ? streamText({
            abortSignal,
            ...(modelMessages ? { messages: modelMessages } : { prompt: attemptPrompt }),
            model: resolveProviderModel(primaryProvider, modelId),
            providerOptions:
              primaryProvider === 'google'
                ? {
                    google: {
                      structuredOutputs: false,
                    },
                  }
                : undefined,
            stopWhen: enableTools ? stepCountIs(toolNames.length + 2) : undefined,
            system: systemPrompt,
            tools: enableTools ? (tools as ToolSet) : undefined,
          })
        : streamText({
            abortSignal,
            ...(modelMessages ? { messages: modelMessages } : { prompt: attemptPrompt }),
            model: resolveProviderModel(primaryProvider, modelId),
            output: Output.object({
              description: 'Structured dangerous-custom-render block output',
              name: 'dangerousCustomRenderBlock',
              schema: generatedDangerousCustomRenderSchema,
            }),
            stopWhen: enableTools ? stepCountIs(toolNames.length + 2) : undefined,
            system: systemPrompt,
            tools: enableTools ? (tools as ToolSet) : undefined,
          });

      const partialTask = useCompatibilityTextMode
        ? Promise.resolve()
        : (async () => {
            for await (const partialOutput of result.partialOutputStream) {
              partialGenerated = partialOutput as Partial<AIGeneratedDangerousCustomRenderBlock>;
              emitSnapshots(buildPartialFieldSnapshots(partialGenerated), previousSnapshots);
            }
          })();

      const fullTask = (async () => {
        for await (const part of result.fullStream) {
          switch (part.type) {
            case 'reasoning-start':
              queue.push({
                type: 'status',
                attempt,
                maxAttempts: maxRepairAttempts,
                message: 'Analyzing the request.',
                stage: attempt > 0 ? 'repairing' : 'thinking',
              });
              break;

            case 'start-step':
              queue.push({
                type: 'status',
                attempt,
                maxAttempts: maxRepairAttempts,
                message: enableTools ? 'Preparing generation context.' : 'Preparing generation.',
                stage:
                  enableTools && attempt === 0
                    ? 'gathering-context'
                    : attempt > 0
                      ? 'repairing'
                      : 'thinking',
              });
              break;

            case 'text-delta':
              if (!hasEmittedGeneratingStatus) {
                hasEmittedGeneratingStatus = true;
                queue.push({
                  type: 'status',
                  attempt,
                  maxAttempts: maxRepairAttempts,
                  message:
                    attempt > 0
                      ? 'Streaming repaired block fields.'
                      : 'Streaming generated block fields.',
                  stage: attempt > 0 ? 'repairing' : 'generating',
                });
              }

              queue.push({
                type: 'text-delta',
                value: part.text,
              });
              latestText += part.text;

              if (useCompatibilityTextMode) {
                const jsonCandidate = extractJSONObjectCandidate(latestText);
                const { value } = await parsePartialJson(jsonCandidate);

                if (value && typeof value === 'object' && !Array.isArray(value)) {
                  partialGenerated = value as Partial<AIGeneratedDangerousCustomRenderBlock>;
                  emitSnapshots(buildPartialFieldSnapshots(partialGenerated), previousSnapshots);
                }
              }
              break;

            case 'tool-call':
              queue.push({
                type: 'status',
                attempt,
                maxAttempts: maxRepairAttempts,
                message: `Running ${part.toolName}.`,
                reason: attempt > 0 ? 'repair' : mode,
                stage: 'tool-calling',
              });
              queue.push({
                type: 'tool-call',
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                summary: truncateSummary(part.input),
              });
              break;

            case 'tool-result':
              queue.push({
                type: 'tool-result',
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                summary: truncateSummary(part.output),
              });
              break;

            case 'tool-error':
              queue.push({
                type: 'tool-result',
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                summary: `Tool failed: ${truncateSummary(part.error)}`,
              });
              break;

            default:
              break;
          }
        }
      })();

      await Promise.all([partialTask, fullTask]);

      if (useCompatibilityTextMode) {
        const generatedText = await result.text;
        latestText = generatedText || latestText;
        if (!latestText.trim()) {
          throw new Error(await summarizeEmptyResult(result, latestText));
        }
        const jsonCandidate = extractJSONObjectCandidate(latestText);
        generated = generatedDangerousCustomRenderSchema.parse(JSON.parse(jsonCandidate));
      } else {
        generated = (await result.output) as AIGeneratedDangerousCustomRenderBlock;
      }

      return {
        generated,
        lastGeneratedJSON: latestText,
        partialGenerated,
      };
    };

    queue.push({
      type: 'status',
      attempt: 0,
      maxAttempts: maxRepairAttempts,
      message: 'Initializing AI generation.',
      modelId,
      provider: primaryProvider,
      stage: 'starting',
    });

    if (useCompatibilityTextMode) {
      queue.push({
        type: 'status',
        attempt: 0,
        maxAttempts: maxRepairAttempts,
        message:
          'Using compatibility mode for this model request. Structured output is replaced with streamed JSON parsing for better model/provider support.',
        modelId,
        provider: primaryProvider,
        stage: 'thinking',
      });
    }

    void (async () => {
      let repairAttemptsUsed = 0;
      let workingPrompt = prompt;
      let lastErrorMessage: string | null = null;
      let lastAttemptResult: SingleAttemptResult | null = null;

      try {
        for (let attempt = 0; attempt <= maxRepairAttempts; attempt += 1) {
          if (attempt > 0) {
            queue.push({
              attempt,
              maxAttempts: maxRepairAttempts,
              reason: lastErrorMessage ?? 'Attempting to repair invalid output.',
              type: 'repair-start',
            });
          }

          lastAttemptResult = await runSingleAttempt({
            attempt,
            attemptPrompt: workingPrompt,
          });

          queue.push({
            type: 'status',
            attempt,
            maxAttempts: maxRepairAttempts,
            message: 'Validating final block payload.',
            stage: 'finalizing',
          });

          try {
            if (!lastAttemptResult.generated) {
              throw new Error('No output generated. Check the stream for errors.');
            }

            const validation = validateGeneratedBlock(lastAttemptResult.generated);
            const run = createRunSummary({
              lastError: null,
              maxRepairAttempts,
              modelId,
              normalizationApplied: validation.normalizationApplied,
              provider: primaryProvider,
              repaired: attempt > 0,
              repairAttemptsUsed,
            });

            const finalPayload = buildGenerationPayload({
              generated: validation.normalized,
              run,
            });

            if (attempt > 0) {
              queue.push({
                attempt,
                fixed: true,
                message: 'Repair attempt produced a valid block.',
                type: 'repair-result',
              });
            }

            queue.push({
              type: 'final',
              ...finalPayload,
            });
            queue.push({
              type: 'status',
              attempt,
              maxAttempts: maxRepairAttempts,
              message: 'Generation complete.',
              modelId,
              provider: primaryProvider,
              stage: 'done',
            });
            queue.close();
            return;
          } catch (error) {
            lastErrorMessage = error instanceof Error ? error.message : 'AI generation failed.';

            if (attempt < maxRepairAttempts && lastAttemptResult.generated) {
              repairAttemptsUsed += 1;
              queue.push({
                attempt: repairAttemptsUsed,
                fixed: false,
                message: lastErrorMessage,
                type: 'repair-result',
              });

              workingPrompt = buildRepairPrompt({
                currentArtifact: {
                  ...currentArtifact,
                  css:
                    typeof lastAttemptResult.generated.css === 'string'
                      ? lastAttemptResult.generated.css
                      : currentArtifact?.css,
                  dataJSON:
                    lastAttemptResult.generated.data !== undefined
                      ? JSON.stringify(lastAttemptResult.generated.data, null, 2)
                      : currentArtifact?.dataJSON,
                  html:
                    typeof lastAttemptResult.generated.html === 'string'
                      ? lastAttemptResult.generated.html
                      : currentArtifact?.html,
                  js:
                    typeof lastAttemptResult.generated.js === 'string'
                      ? lastAttemptResult.generated.js
                      : currentArtifact?.js,
                  variablesJSON:
                    lastAttemptResult.generated.variables !== undefined
                      ? JSON.stringify(lastAttemptResult.generated.variables, null, 2)
                      : currentArtifact?.variablesJSON,
                },
                errorMessage: lastErrorMessage,
                existingMessages,
                lastGeneratedJSON:
                  lastAttemptResult.lastGeneratedJSON ||
                  JSON.stringify(lastAttemptResult.generated, null, 2),
              });
              continue;
            }

            repairAttemptsUsed = Math.min(attempt, maxRepairAttempts);
            break;
          }
        }

        if (lastAttemptResult) {
          emitFailureWithPartial({
            errorMessage: lastErrorMessage ?? 'AI generation failed.',
            partialGenerated: lastAttemptResult.generated ?? lastAttemptResult.partialGenerated,
            repairAttemptsUsed,
          });
        } else {
          queue.push({
            type: 'error',
            message: lastErrorMessage ?? 'AI generation failed.',
            run: {
              lastError: lastErrorMessage ?? 'AI generation failed.',
              maxRepairAttempts,
              modelId,
              outcome: 'failed-no-usable-output',
              provider: primaryProvider,
              repairAttemptsUsed,
            },
            stage: 'error',
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'AI generation failed.';
        queue.push({
          type: 'error',
          message,
          run: {
            lastError: message,
            maxRepairAttempts,
            modelId,
            outcome: 'failed-no-usable-output',
            provider: primaryProvider,
            repairAttemptsUsed,
          },
          stage: 'error',
        });
      }

      queue.close();
    })();

    return queue;
  };
};
