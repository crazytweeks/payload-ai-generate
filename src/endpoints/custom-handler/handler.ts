import type { PayloadHandler } from 'payload';
import { resolvePayloadAI } from '../../aiService';
import { buildAiHtmlPrompt } from '../../block-generation';
import {
  buildInputMessages,
  buildReferenceEvent,
  getRequestOrigin,
  resolveAttachmentDoc,
} from './attachments';
import { resolvePresetValues } from './preset';
import { collectFinalPayload, prependEvents, streamEventsResponse } from './stream-response';
import type { GenerateRequestBody, ResolvedAttachment } from './types';

/**
 * Payload endpoint that streams `ai-html-block` generation
 * events to the admin UI.
 *
 * @param req - Payload request containing the prompt body, active user context, and Payload instance.
 * @returns NDJSON stream by default, or JSON when `stream: false` is requested.
 *
 * @example
 * ```ts
 * export const customEndpointHandler: PayloadHandler = createCustomEndpointHandler();
 * ```
 */
export const customEndpointHandler: PayloadHandler = async (req) => {
  const payloadAI = resolvePayloadAI(req.payload);

  if (!payloadAI) {
    return Response.json(
      {
        error: 'Payload AI service is not available on this instance.',
      },
      { status: 500 }
    );
  }

  try {
    if (typeof req.json !== 'function') {
      throw new Error('Request body is not available.');
    }

    const body = (await req.json()) as GenerateRequestBody;
    const mode = body.mode ?? 'generate';
    const pluginOptions = (req.payload.config.custom?.aiPluginOptions ?? {}) as {
      referenceMediaCollectionSlug?: string;
    };
    const origin = getRequestOrigin(req);
    const prompt = buildAiHtmlPrompt({
      currentArtifact: body.currentArtifact,
      existingMessages: body.messages ?? [],
      followup: body.followup,
      instructions: body.instructions,
      mode,
      title: body.title,
    });

    const attachments: ResolvedAttachment[] =
      pluginOptions.referenceMediaCollectionSlug && Array.isArray(body.attachments)
        ? (
            await Promise.all(
              body.attachments.map((attachment) =>
                resolveAttachmentDoc({
                  collectionSlug: pluginOptions.referenceMediaCollectionSlug as string,
                  origin,
                  payload: req.payload,
                  ref: attachment,
                  req,
                })
              )
            )
          ).filter((attachment): attachment is ResolvedAttachment => Boolean(attachment))
        : [];

    const inputMessages = await buildInputMessages({
      attachments,
      prompt,
    });

    const defaultSystem =
      'Generate production-usable frontend output for Payload CMS. Stay aligned with the project structure when tools expose relevant context.';

    const { model, provider, system } = await resolvePresetValues(
      req.payload,
      body.presetId,
      req,
      defaultSystem
    );

    const events = payloadAI.streamBlockGeneration({
      abortSignal: 'signal' in req ? req.signal : undefined,
      currentArtifact: body.currentArtifact,
      existingMessages: body.messages,
      messages: inputMessages,
      mode,
      model,
      prompt,
      provider,
      system,
    });

    const referenceEvent = buildReferenceEvent(
      attachments,
      attachments.length > 0 ? 'direct-upload' : 'metadata-only'
    );
    const streamedEvents = referenceEvent ? prependEvents([referenceEvent], events) : events;

    if (body.stream === false) {
      const finalPayload = await collectFinalPayload(streamedEvents);
      const { type: _type, ...responseBody } = finalPayload;
      return Response.json(responseBody);
    }

    return streamEventsResponse(streamedEvents);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI generation failed.';

    return Response.json(
      {
        error: message,
      },
      { status: 400 }
    );
  }
};
