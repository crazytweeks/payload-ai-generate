import type { PayloadHandler } from 'payload';
import type { AIPluginOptions, AIReferenceDataSource } from '../ai-types';
import { createComposerStreamGenerator } from '../composer';
import type { ComposerMessage } from '../composer/types';
import { createReferenceTools } from '../tools/referenceTools';
import { resolvePresetValues } from './custom-handler/preset';

type ComposerRequestBody = {
  firstPrompt?: string;
  messages?: ComposerMessage[];
  presetId?: number | string;
  references?: AIReferenceDataSource[];
};

export const composerEndpointHandler: PayloadHandler = async (req) => {
  const pluginOptions = (req.payload.config.custom?.aiPluginOptions ?? {}) as AIPluginOptions;

  if (typeof req.json !== 'function') {
    return Response.json({ error: 'Request body not available.' }, { status: 400 });
  }

  const body = (await req.json()) as ComposerRequestBody;

  if (!body.firstPrompt?.trim()) {
    return Response.json({ error: 'firstPrompt is required.' }, { status: 400 });
  }

  const { model, provider, system } = await resolvePresetValues(
    req.payload,
    body.presetId,
    req,
    ''
  );

  const requestTools = createReferenceTools({
    payload: req.payload,
    pluginOptions,
    references: body.references ?? [],
  });

  const streamGenerator = createComposerStreamGenerator(pluginOptions);

  const events = streamGenerator({
    firstPrompt: body.firstPrompt,
    messages: body.messages ?? [],
    references: body.references ?? [],
    model,
    provider,
    system: system || undefined,
    requestTools,
    abortSignal: 'signal' in req ? (req as unknown as { signal: AbortSignal }).signal : undefined,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of events) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
    },
  });
};
