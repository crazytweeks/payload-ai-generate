import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import configPromise from '@payload-config';
import type { UIMessage } from 'ai';
import { convertToModelMessages, stepCountIs, streamText } from 'ai';
import { getPayload } from 'payload';
import type { AIPluginOptions, AIReferenceDataSource } from '../../../../../src/ai-types';
import { buildComposerSystemPrompt } from '../../../../../src/composer/prompt';
import { createReferenceTools } from '../../../../../src/tools/referenceTools';

export const dynamic = 'force-dynamic';

function resolveModel(pluginOptions: AIPluginOptions) {
  const openaiKey = pluginOptions.openaiApiKey ?? process.env.OPENAI_API_KEY;
  if (openaiKey) {
    const openai = createOpenAI({ apiKey: openaiKey });
    return { model: openai('gpt-5.5'), provider: 'openai' as const };
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

  const { model, provider } = resolveModel(pluginOptions);

  const requestTools = createReferenceTools({
    payload,
    pluginOptions,
    references: body.references ?? [],
  });

  const result = streamText({
    model,
    system: buildComposerSystemPrompt(),
    messages: await convertToModelMessages(body.messages),
    tools: Object.keys(requestTools).length > 0 ? requestTools : undefined,
    stopWhen: stepCountIs(12),
    providerOptions: undefined,
  });

  return result.toUIMessageStreamResponse();
}
