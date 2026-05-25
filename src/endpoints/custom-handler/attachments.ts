import type { FilePart, ImagePart, ModelMessage, TextPart, UserModelMessage } from 'ai';
import type { CollectionSlug, PayloadHandler } from 'payload';
import type { AIGenerationEvent } from '../../ai-types';
import type { AttachmentReference, ResolvedAttachment } from './types';

/**
 * Derives the absolute origin for the current request.
 *
 * @param req - Payload request carrying URL and forwarded host headers.
 * @returns Absolute origin string when it can be derived, otherwise `undefined`.
 *
 * @example
 * ```ts
 * const origin = getRequestOrigin(req);
 * // "http://localhost:3000"
 * ```
 */
export const getRequestOrigin = (req: Parameters<PayloadHandler>[0]) => {
  if (typeof req.url === 'string') {
    try {
      return new URL(req.url).origin;
    } catch {
      // Ignore invalid request URLs and fall back to headers below.
    }
  }

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');

  if (!host) {
    return undefined;
  }

  const protocol = req.headers.get('x-forwarded-proto') ?? 'http';
  return `${protocol}://${host}`;
};

/**
 * Normalizes a relative or absolute URL into an absolute URL string.
 *
 * @param value - Candidate URL string from an upload doc.
 * @param origin - Optional request origin used for relative URLs.
 * @returns Absolute URL string when valid, otherwise `undefined`.
 *
 * @example
 * ```ts
 * const absoluteURL = toAbsoluteURL('/api/media/file/example.webp', 'http://localhost:3000');
 * // "http://localhost:3000/api/media/file/example.webp"
 * ```
 */
export const toAbsoluteURL = (value: string | null | undefined, origin?: string) => {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value, origin).toString();
  } catch {
    return undefined;
  }
};

/**
 * Resolves a raw upload relationship into a normalized attachment descriptor.
 *
 * @param params.collectionSlug - Upload collection slug configured for prompt references.
 * @param params.origin - Request origin used to normalize relative upload URLs.
 * @param params.payload - Payload instance used for upload document lookups.
 * @param params.ref - Raw upload relationship value from the request body.
 * @param params.req - Active Payload request used for `findByID`.
 * @returns Normalized attachment metadata, or `null` if resolution fails.
 *
 * @example
 * ```ts
 * const attachment = await resolveAttachmentDoc({
 *   collectionSlug: 'media',
 *   origin: 'http://localhost:3000',
 *   payload: req.payload,
 *   ref: '661f5c2d4b2a9f0a12345678',
 *   req,
 * });
 * ```
 */
export const resolveAttachmentDoc = async ({
  collectionSlug,
  origin,
  payload,
  ref,
  req,
}: {
  collectionSlug: string;
  origin?: string;
  payload: Parameters<PayloadHandler>[0]['payload'];
  ref: AttachmentReference;
  req: Parameters<PayloadHandler>[0];
}): Promise<ResolvedAttachment | null> => {
  if (!ref) {
    return null;
  }

  if (typeof ref === 'object' && typeof ref.url === 'string') {
    const absoluteURL = toAbsoluteURL(ref.url, origin);

    if (!absoluteURL) {
      return null;
    }

    return {
      alt: typeof ref.alt === 'string' ? ref.alt : undefined,
      filename: typeof ref.filename === 'string' ? ref.filename : undefined,
      id: ref.id,
      mimeType: typeof ref.mimeType === 'string' ? ref.mimeType : undefined,
      url: absoluteURL,
    };
  }

  const id = typeof ref === 'object' ? ref.id : ref;

  if (id === undefined || id === null) {
    return null;
  }

  const doc = (await payload.findByID({
    collection: collectionSlug as any as CollectionSlug,
    depth: 0,
    id,
    req,
  })) as {
    alt?: string | null;
    filename?: string | null;
    id?: number | string;
    mimeType?: string | null;
    url?: string | null;
  } | null;

  const absoluteURL = toAbsoluteURL(doc?.url, origin);

  if (!doc || !absoluteURL) {
    return null;
  }

  return {
    alt: typeof doc.alt === 'string' ? doc.alt : undefined,
    filename: typeof doc.filename === 'string' ? doc.filename : undefined,
    id: doc.id,
    mimeType: typeof doc.mimeType === 'string' ? doc.mimeType : undefined,
    url: absoluteURL,
  };
};

/**
 * Downloads an attachment so it can be sent inline as bytes to the model.
 *
 * @param attachment - Normalized attachment metadata with a fetchable URL.
 * @returns Attachment bytes plus the detected media type.
 *
 * @example
 * ```ts
 * const { bytes, mediaType } = await fetchAttachmentBytes(attachment);
 * ```
 */
export const fetchAttachmentBytes = async (attachment: ResolvedAttachment) => {
  const response = await fetch(attachment.url);

  if (!response.ok) {
    throw new Error(`Failed to fetch attachment: ${attachment.filename ?? attachment.url}`);
  }

  const mediaType = response.headers.get('content-type') ?? attachment.mimeType;
  const bytes = new Uint8Array(await response.arrayBuffer());

  return {
    bytes,
    mediaType: mediaType ?? 'application/octet-stream',
  };
};

/**
 * Builds multimodal content parts for uploaded prompt references.
 *
 * @param attachments - Resolved attachment metadata.
 * @returns Multimodal parts appended after the main prompt text.
 *
 * @example
 * ```ts
 * const parts = await buildAttachmentParts(attachments);
 * ```
 */
export const buildAttachmentParts = async (
  attachments: ResolvedAttachment[]
): Promise<Array<TextPart | ImagePart | FilePart>> => {
  const attachmentSummary = attachments
    .map((attachment, index) => {
      const label = attachment.filename ?? `attachment-${index + 1}`;
      const mimeLabel = attachment.mimeType ?? 'unknown';
      const altLabel = attachment.alt ? ` (${attachment.alt})` : '';
      return `${index + 1}. ${label}${altLabel} [${mimeLabel}]`;
    })
    .join('\n');

  const parts: Array<TextPart | ImagePart | FilePart> = [
    {
      type: 'text',
      text: `Reference attachments are included with this request. Use them as visual or document context when relevant.\n\nAttachments:\n${attachmentSummary}`,
    },
  ];

  for (const attachment of attachments) {
    try {
      const { bytes, mediaType } = await fetchAttachmentBytes(attachment);

      if (mediaType.startsWith('image/')) {
        parts.push({
          type: 'image',
          image: bytes,
          mediaType,
        });
        continue;
      }

      parts.push({
        type: 'file',
        data: bytes,
        filename: attachment.filename,
        mediaType,
      });
    } catch {
      if (attachment.mimeType?.startsWith('image/')) {
        parts.push({
          type: 'image',
          image: new URL(attachment.url),
          mediaType: attachment.mimeType,
        });
        continue;
      }

      if (attachment.mimeType) {
        parts.push({
          type: 'file',
          data: new URL(attachment.url),
          filename: attachment.filename,
          mediaType: attachment.mimeType,
        });
      }
    }
  }

  return parts;
};

/**
 * Builds the final model input messages for the generation request.
 *
 * The prompt text and reference attachments are intentionally placed in a
 * single user turn so multimodal providers treat them as one instruction.
 *
 * @param params.attachments - Resolved attachments selected for the prompt.
 * @param params.prompt - Final prompt text sent to the model.
 * @returns Model messages ready for `payload.ai.streamBlockGeneration`.
 *
 * @example
 * ```ts
 * const inputMessages = await buildInputMessages({
 *   attachments,
 *   prompt,
 * });
 * ```
 */
export const buildInputMessages = async ({
  attachments,
  prompt,
}: {
  attachments: ResolvedAttachment[];
  prompt: string;
}): Promise<ModelMessage[]> => {
  if (attachments.length === 0) {
    return [
      {
        role: 'user',
        content: prompt,
      } satisfies UserModelMessage,
    ];
  }

  return [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: prompt,
        },
        ...(await buildAttachmentParts(attachments)),
      ],
    } satisfies UserModelMessage,
  ];
};

/**
 * Creates the lightweight reference event shown in the composer activity panel.
 *
 * @param attachments - Resolved attachments that were included with the request.
 * @param mode - Indicates whether the references were sent as direct inline bytes or metadata-only.
 * @returns Stream event describing the references, or `null` when none exist.
 *
 * @example
 * ```ts
 * const event = buildReferenceEvent(attachments, 'direct-upload');
 * ```
 */
export const buildReferenceEvent = (
  attachments: ResolvedAttachment[],
  mode: 'direct-upload' | 'metadata-only'
): AIGenerationEvent | null => {
  if (attachments.length === 0) {
    return null;
  }

  return {
    type: 'references',
    mode,
    items: attachments.map((attachment) => ({
      kind: attachment.mimeType?.startsWith('image/') ? 'image' : 'file',
      label: attachment.filename ?? String(attachment.id ?? 'attachment'),
      mimeType: attachment.mimeType,
      url: attachment.url,
    })),
  };
};
