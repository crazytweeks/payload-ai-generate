import { devToolsMiddleware } from '@ai-sdk/devtools';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import configPromise from '@payload-config';
import type { UIMessage } from 'ai';
import { convertToModelMessages, stepCountIs, streamText, wrapLanguageModel } from 'ai';
import { getPayload } from 'payload';
import type { AIPluginOptions, AIReferenceDataSource } from '@plugin/ai-types';
import { buildComposerSystemPrompt } from '@plugin/composer/prompt';
import { createReferenceTools } from '@plugin/tools/referenceTools';

export const dynamic = 'force-dynamic';

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

export async function POST(req: Request) {
  const payload = await getPayload({ config: configPromise });
  const pluginOptions = (payload.config.custom?.aiPluginOptions ?? {}) as AIPluginOptions;

  const body = (await req.json()) as {
    messages: UIMessage[];
    presetId?: string;
    references?: AIReferenceDataSource[];
  };

  const { model: baseModel, provider } = resolveModel(pluginOptions);

  const model = wrapLanguageModel({
    model: baseModel,
    middleware: devToolsMiddleware(),
  });

  const requestTools = createReferenceTools({
    payload,
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

  console.log('[composer] POST', {
    provider,
    messageCount: body.messages.length,
    referenceCount: body.references?.length ?? 0,
    references: body.references,
    hasTools,
    prompt: lastUserMessage.slice(0, 120),
  });

  const result = streamText({
    model,
    system: buildComposerSystemPrompt(body.references ?? []),
    messages: await convertToModelMessages(body.messages),
    tools: hasTools ? requestTools : undefined,
    stopWhen: stepCountIs(12),
    onStepFinish: ({ toolCalls, toolResults, text, finishReason }) => {
      console.log('[composer] step', {
        finishReason,
        textLength: text?.length ?? 0,
        toolCalls: toolCalls?.map((tc) => tc.toolName),
        toolResults: toolResults?.length ?? 0,
      });
    },
    onFinish: ({ text, finishReason, usage }) => {
      console.log('[composer] done', {
        finishReason,
        textLength: text.length,
        inputTokens: usage?.inputTokens,
        outputTokens: usage?.outputTokens,
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
