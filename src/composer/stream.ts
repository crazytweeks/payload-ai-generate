import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { stepCountIs, streamText } from 'ai';
import { resolveOptions } from '../ai-service/options';
import type { AIPluginOptions, AIProviderName } from '../ai-types';
import { buildComposerSystemPrompt, buildComposerUserPrompt } from './prompt';
import type { ComposerMessage, ComposerPlan, ComposerStreamParams } from './types';

const extractPlan = (text: string): ComposerPlan | null => {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(match[1]) as ComposerPlan;
  } catch {
    return null;
  }
};

export const createComposerStreamGenerator = (pluginOptions: AIPluginOptions) => {
  const resolved = resolveOptions(pluginOptions);

  const google = resolved.googleApiKey
    ? createGoogleGenerativeAI({ apiKey: resolved.googleApiKey })
    : null;

  const openai = resolved.openaiApiKey ? createOpenAI({ apiKey: resolved.openaiApiKey }) : null;

  const resolveModel = (provider: AIProviderName, model?: string) => {
    if (provider === 'openai') {
      if (!openai) throw new Error('OpenAI API key not configured.');
      return openai(model ?? 'gpt-5.5');
    }
    if (!google) throw new Error('Google API key not configured.');
    return google(model ?? 'gemini-2.5-flash');
  };

  return async function* streamComposerGeneration({
    firstPrompt,
    messages = [],
    references = [],
    model,
    provider = resolved.defaultProvider ?? 'openai',
    system,
    requestTools = {},
    abortSignal,
  }: ComposerStreamParams): AsyncGenerator<Record<string, unknown>> {
    const resolvedModel = resolveModel(provider, model);
    const systemPrompt = system ?? buildComposerSystemPrompt();
    const userPrompt = buildComposerUserPrompt({ firstPrompt, messages, references });

    yield { type: 'status', stage: 'starting', message: 'Initialising AI composer...' };

    const result = streamText({
      model: resolvedModel,
      system: systemPrompt,
      prompt: userPrompt,
      tools: Object.keys(requestTools).length > 0 ? requestTools : undefined,
      stopWhen: stepCountIs(10),
      abortSignal,
      providerOptions: undefined,
    });

    yield { type: 'status', stage: 'thinking', message: 'Analysing request...' };

    for await (const chunk of result.fullStream) {
      if (chunk.type === 'text-delta') {
        yield { type: 'text-delta', delta: chunk.text };
      } else if (chunk.type === 'tool-call') {
        const tc = chunk as { toolName: string; input?: unknown; type: 'tool-call' };
        yield { type: 'tool-call', toolName: tc.toolName, args: tc.input };
      } else if (chunk.type === 'tool-result') {
        const tr = chunk as { toolName: string; type: 'tool-result' };
        yield { type: 'tool-result', toolName: tr.toolName };
      } else if (chunk.type === 'reasoning-delta') {
        yield { type: 'reasoning', delta: chunk.text };
      }
    }

    const fullText = await result.text;
    const plan = extractPlan(fullText);

    if (plan) {
      const updatedMessages: ComposerMessage[] = [
        ...messages,
        { role: 'user', content: firstPrompt, createdAt: new Date().toISOString() },
        { role: 'assistant', content: fullText, createdAt: new Date().toISOString() },
      ];
      yield { type: 'plan-ready', plan, messages: updatedMessages };
    } else {
      yield {
        type: 'error',
        message: 'AI did not produce a valid plan JSON block. Try rephrasing your prompt.',
      };
    }

    yield { type: 'status', stage: 'done', message: 'Done.' };
  };
};
