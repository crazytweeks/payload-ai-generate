import { devToolsMiddleware } from '@ai-sdk/devtools';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import type { UIMessage } from 'ai';
import { convertToModelMessages, stepCountIs, streamText, wrapLanguageModel } from 'ai';
import type { PayloadHandler } from 'payload';
import type { AIPluginOptions, AIReferenceDataSource } from '../ai-types';
import { buildComposerSystemPrompt } from '../composer/prompt';
import { createReferenceTools } from '../tools/referenceTools';
import { aiComposerCollectionSlug } from '../collections/constants';

function resolveModel(pluginOptions: AIPluginOptions) {
  const openaiKey = pluginOptions.openaiApiKey ?? process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const openai = createOpenAI({ apiKey: openaiKey });
    return { model: openai('gpt-4o'), provider: 'openai' as const };
  }
  const googleKey = pluginOptions.googleApiKey ?? process.env.GOOGLE_AI_API;
  if (googleKey) {
    const google = createGoogleGenerativeAI({ apiKey: googleKey });
    return { model: google('gemini-2.5-flash'), provider: 'google' as const };
  }
  throw new Error('No AI provider configured. Set OPENAI_API_KEY or GOOGLE_AI_API.');
}

export const composerEndpointHandler: PayloadHandler = async (req) => {
  const pluginOptions = (req.payload.config.custom?.aiPluginOptions ?? {}) as AIPluginOptions;

  if (typeof req.json !== 'function') {
    return Response.json({ error: 'Request body not available.' }, { status: 400 });
  }

  const body = (await req.json()) as {
    messages: UIMessage[];
    presetId?: string;
    references?: AIReferenceDataSource[];
    sessionId?: string;
  };

  const { model: baseModel, provider } = resolveModel(pluginOptions);

  const model = wrapLanguageModel({
    model: baseModel,
    middleware: devToolsMiddleware(),
  });

  const requestTools = createReferenceTools({
    payload: req.payload,
    pluginOptions,
    references: body.references ?? [],
  });

  const hasTools = Object.keys(requestTools).length > 0;
  const lastUserMsg = [...body.messages].reverse().find((m) => m.role === 'user');
  const lastUserMessage =
    lastUserMsg?.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => (p as { type: 'text'; text: string }).text)
      .join('') ?? '';

  req.payload.logger.info({
    msg: '[composer] POST',
    provider,
    messageCount: body.messages.length,
    referenceCount: body.references?.length ?? 0,
    hasTools,
  });

  let initialMessages = body.messages;
  if (!initialMessages || initialMessages.length === 0) {
    return Response.json({ error: 'messages are required' }, { status: 400 });
  }

  const result = streamText({
    model,
    system: buildComposerSystemPrompt(body.references ?? []),
    messages: await convertToModelMessages(initialMessages),
    tools: hasTools ? requestTools : undefined,
    stopWhen: stepCountIs(12),
    onStepFinish: ({ toolCalls, toolResults, text, finishReason }) => {
      req.payload.logger.info({
        msg: '[composer] step',
        finishReason,
        textLength: text?.length ?? 0,
        toolCalls: toolCalls?.map((tc) => tc.toolName),
        toolResults: toolResults?.length ?? 0,
      });
    },
    onFinish: async ({ text, finishReason, usage, response }) => {
      req.payload.logger.info({
        msg: '[composer] done',
        finishReason,
        textLength: text.length,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
      });

      if (body.sessionId) {
        try {
          const finalMessages = [
            ...body.messages,
            {
              id: `assistant-${Date.now()}`,
              role: 'assistant',
              content: text,
              parts: [{ type: 'text', text }],
            },
          ];

          // Try to extract the JSON plan to save it properly
          let extractedPlan = null;
          const match = text.match(/```json\s*\n([\s\S]*?)\n\s*```/);
          if (match && match[1]) {
            try {
              extractedPlan = JSON.parse(match[1]);
            } catch (e) {
              req.payload.logger.warn({ msg: 'Failed to parse JSON plan from composer output' });
            }
          }

          const updateData: any = { messages: finalMessages };
          if (extractedPlan) {
            updateData.plan = extractedPlan;
          }

          await req.payload.update({
            collection: aiComposerCollectionSlug,
            id: body.sessionId,
            data: updateData,
          });
        } catch (err) {
          req.payload.logger.error({ msg: 'Failed to persist composer session', err });
        }
      }
    },
  });

  return result.toUIMessageStreamResponse();
};
