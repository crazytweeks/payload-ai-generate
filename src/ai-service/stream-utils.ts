import type { streamText } from 'ai';

/**
 * Produces a compact string summary suitable for stream activity logs.
 *
 * @param value - Value to summarize.
 * @param maxLength - Maximum serialized length before truncation.
 * @returns Human-readable summary string.
 *
 * @example
 * ```ts
 * const summary = truncateSummary({ tool: 'read_file' }, 120);
 * ```
 */
export const truncateSummary = (value: unknown, maxLength = 200) => {
  const serialized =
    typeof value === 'string' ? value : (JSON.stringify(value, null, 2) ?? String(value));

  return serialized.length > maxLength
    ? `${serialized.slice(0, maxLength).trimEnd()}...`
    : serialized;
};

/**
 * Extracts the most likely JSON object candidate from a streamed text response.
 *
 * The helper understands fenced ```json blocks and raw object-shaped text.
 *
 * @param value - Raw streamed text accumulated so far.
 * @returns Best-effort JSON object substring.
 *
 * @example
 * ```ts
 * const candidate = extractJSONObjectCandidate('```json\\n{\"html\":\"...\"}\\n```');
 * ```
 */
export const extractJSONObjectCandidate = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }

  const startIndex = trimmed.indexOf('{');
  const endIndex = trimmed.lastIndexOf('}');

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    return trimmed.slice(startIndex, endIndex + 1);
  }

  return trimmed;
};

/**
 * Minimal async event queue used to bridge model streaming into endpoint events.
 *
 * @returns Push/close controls plus an async iterator interface.
 *
 * @example
 * ```ts
 * const queue = createEventQueue<string>();
 * queue.push('hello');
 * queue.close();
 * ```
 */
export const createEventQueue = <T>() => {
  const values: T[] = [];
  const resolvers: Array<(result: IteratorResult<T>) => void> = [];
  let done = false;

  const flush = () => {
    while (resolvers.length > 0 && values.length > 0) {
      const resolve = resolvers.shift();

      if (resolve) {
        resolve({ done: false, value: values.shift() as T });
      }
    }

    if (done && values.length === 0) {
      while (resolvers.length > 0) {
        const resolve = resolvers.shift();

        if (resolve) {
          resolve({ done: true, value: undefined as T });
        }
      }
    }
  };

  return {
    close() {
      done = true;
      flush();
    },
    push(value: T) {
      values.push(value);
      flush();
    },
    [Symbol.asyncIterator]() {
      return {
        next: () => {
          if (values.length > 0) {
            return Promise.resolve({
              done: false,
              value: values.shift() as T,
            });
          }

          if (done) {
            return Promise.resolve({ done: true, value: undefined as T });
          }

          return new Promise<IteratorResult<T>>((resolve) => {
            resolvers.push(resolve);
          });
        },
      };
    },
  };
};

const settle = async <T>(value: PromiseLike<T> | T): Promise<T | undefined> => {
  try {
    return await value;
  } catch {
    return undefined;
  }
};

/**
 * Builds a diagnostic message when a streamed model request finishes without text.
 *
 * @param result - `streamText()` result object returned by the AI SDK.
 * @param latestText - Text accumulated before the empty-output condition was detected.
 * @returns Detailed diagnostic string for logs and surfaced endpoint errors.
 *
 * @example
 * ```ts
 * const message = await summarizeEmptyResult(result, latestText);
 * ```
 */
export const summarizeEmptyResult = async (
  result: ReturnType<typeof streamText>,
  latestText: string
) => {
  const [finishReason, warnings, response, providerMetadata] = await Promise.all([
    settle(result.finishReason),
    settle(result.warnings),
    settle(result.response),
    settle(result.providerMetadata),
  ]);

  const responseMessages =
    response?.messages && response.messages.length > 0
      ? truncateSummary(
          response.messages.map((message: { content: unknown; role: string }) => ({
            content: message.content,
            role: message.role,
          })),
          600
        )
      : undefined;

  const warningSummary =
    Array.isArray(warnings) && warnings.length > 0 ? truncateSummary(warnings, 400) : undefined;

  const providerSummary = providerMetadata ? truncateSummary(providerMetadata, 400) : undefined;

  const details = [
    finishReason ? `finishReason=${finishReason}` : null,
    latestText.trim() ? `partialText=${truncateSummary(latestText, 300)}` : null,
    responseMessages ? `responseMessages=${responseMessages}` : null,
    warningSummary ? `warnings=${warningSummary}` : null,
    providerSummary ? `providerMetadata=${providerSummary}` : null,
  ].filter(Boolean);

  return details.length > 0
    ? `Model returned no text output. ${details.join(' | ')}`
    : 'Model returned no text output.';
};
