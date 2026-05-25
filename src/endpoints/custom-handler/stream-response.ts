import type { AIGenerationEvent } from '../../ai-types';

/**
 * Serializes one generation event into the NDJSON format used by the admin UI.
 *
 * @param event - Stream event to serialize.
 * @returns NDJSON line containing the serialized event.
 *
 * @example
 * ```ts
 * const line = encodeEvent({ type: 'status', stage: 'starting' });
 * ```
 */
export const encodeEvent = (event: AIGenerationEvent) => `${JSON.stringify(event)}\n`;

/**
 * Prepends synthetic events ahead of an existing async event source.
 *
 * @param initialEvents - Events that should be yielded before the main source starts.
 * @param events - Async iterable that emits the remaining generation events.
 * @returns Combined async iterable preserving order.
 *
 * @example
 * ```ts
 * const stream = prependEvents([referenceEvent], events);
 * ```
 */
export async function* prependEvents(
  initialEvents: AIGenerationEvent[],
  events: AsyncIterable<AIGenerationEvent>
): AsyncIterable<AIGenerationEvent> {
  for (const event of initialEvents) {
    yield event;
  }

  for await (const event of events) {
    yield event;
  }
}

/**
 * Converts an async event source into an NDJSON HTTP response.
 *
 * @param events - Async iterable of endpoint events.
 * @returns Streaming NDJSON response consumed by the composer UI.
 *
 * @example
 * ```ts
 * return streamEventsResponse(events);
 * ```
 */
export const streamEventsResponse = (events: AsyncIterable<AIGenerationEvent>) => {
  const encoder = new TextEncoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          for await (const event of events) {
            controller.enqueue(encoder.encode(encodeEvent(event)));
          }
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              encodeEvent({
                type: 'error',
                message: error instanceof Error ? error.message : 'AI generation failed.',
                stage: 'error',
              })
            )
          );
        } finally {
          controller.close();
        }
      },
    }),
    {
      headers: {
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Content-Type': 'application/x-ndjson; charset=utf-8',
      },
      status: 200,
    }
  );
};

/**
 * Reads the final payload from an event stream when the endpoint is used in
 * non-streaming JSON mode.
 *
 * @param events - Async iterable of generation events.
 * @returns The final event payload.
 * @throws Error when the stream ends with an error or without a final payload.
 *
 * @example
 * ```ts
 * const finalPayload = await collectFinalPayload(events);
 * ```
 */
export const collectFinalPayload = async (events: AsyncIterable<AIGenerationEvent>) => {
  let finalPayload: Extract<AIGenerationEvent, { type: 'final' }> | null = null;

  for await (const event of events) {
    if (event.type === 'error') {
      throw new Error(event.message);
    }

    if (event.type === 'final') {
      finalPayload = event;
    }
  }

  if (!finalPayload) {
    throw new Error('AI generation did not produce a final block payload.');
  }

  return finalPayload;
};
