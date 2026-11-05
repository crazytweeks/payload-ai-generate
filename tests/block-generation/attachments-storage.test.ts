import type { PayloadHandler } from 'payload';
import { describe, expect, it, vi } from 'vitest';
import { buildAttachmentParts, fetchAttachmentBytes } from '../../src/endpoints/custom-handler/attachments';
import type { ResolvedAttachment } from '../../src/endpoints/custom-handler/types';

/**
 * Reference attachments used to be fetched over HTTP from the host app's own
 * `/api/media/file/...` URL. That only worked while the collection was
 * world-readable; once reads require a session, the cookie-less server-side
 * fetch 403s and every reference silently disappears from the prompt.
 *
 * These pin the replacement: read through the collection's storage handlers as
 * the caller, and never hand a provider a private upload URL.
 */

type Handler = (req: unknown, args: unknown) => Promise<Response | undefined> | Response | undefined;

const contextWith = (handlers: Handler[] | undefined, doc: unknown) => {
  const findById = vi.fn(async () => doc);
  return {
    payload: {
      collections: { media: { config: { upload: { handlers } } } },
      findByID: findById,
    } as unknown as Parameters<PayloadHandler>[0]['payload'],
    req: { payload: {} } as unknown as Parameters<PayloadHandler>[0],
    findById,
  };
};

const uploadAttachment: ResolvedAttachment = {
  id: 'm1',
  filename: 'exhibit.pdf',
  mimeType: 'application/pdf',
  url: 'https://lex.example/api/media/file/exhibit.pdf',
  collectionSlug: 'media',
};

describe('fetchAttachmentBytes', () => {
  it('reads an upload through its storage handler, passing the doc for the object key', async () => {
    const handler = vi.fn(async () => new Response('pdf-bytes'));
    const context = contextWith([handler], {
      filename: 'exhibit.pdf',
      mimeType: 'application/pdf',
    });

    const result = await fetchAttachmentBytes(uploadAttachment, context);

    expect(result.bytes).toEqual(new Uint8Array(Buffer.from('pdf-bytes')));
    expect(result.mediaType).toBe('application/pdf');
    expect(handler).toHaveBeenCalledTimes(1);
    const [, args] = handler.mock.calls[0] as unknown as [unknown, { doc?: unknown }];
    expect(args.doc).toEqual({ filename: 'exhibit.pdf', mimeType: 'application/pdf' });
  });

  it('loads the document as the caller, never with overrideAccess', async () => {
    const context = contextWith([async () => new Response('bytes')], {
      filename: 'exhibit.pdf',
      mimeType: 'application/pdf',
    });

    await fetchAttachmentBytes(uploadAttachment, context);

    expect(context.findById).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'media', overrideAccess: false })
    );
  });

  it('returns nothing for an upload the caller cannot read', async () => {
    const handler = vi.fn(async () => new Response('bytes'));
    const context = contextWith([handler], null);

    await expect(fetchAttachmentBytes(uploadAttachment, context)).rejects.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it('still fetches a non-upload attachment by URL', async () => {
    const external: ResolvedAttachment = {
      filename: 'pasted.png',
      mimeType: 'image/png',
      url: 'https://cdn.example/pasted.png',
    };

    const fetchMock = vi.fn(async () => new Response('png', { headers: { 'content-type': 'image/png' } }));
    vi.stubGlobal('fetch', fetchMock);

    try {
      const result = await fetchAttachmentBytes(external, contextWith([], null));
      expect(result.mediaType).toBe('image/png');
      expect(fetchMock).toHaveBeenCalledWith('https://cdn.example/pasted.png');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('buildAttachmentParts', () => {
  it('does not fall back to the provider fetching a private upload URL', async () => {
    const context = contextWith([], null);
    const parts = await buildAttachmentParts([uploadAttachment], context);

    // Only the explanatory text part; no image/file part pointing at
    // `/api/media/file/...`, which the provider could never authenticate.
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ type: 'text' });
    expect(JSON.stringify(parts)).not.toContain('api/media/file');
  });

  it('inlines the bytes it could read from storage', async () => {
    const context = contextWith([async () => new Response('doc-bytes')], {
      filename: 'exhibit.pdf',
      mimeType: 'application/pdf',
    });

    const parts = await buildAttachmentParts([uploadAttachment], context);
    const filePart = parts.find((part) => part.type === 'file');

    expect(filePart).toMatchObject({ type: 'file', mediaType: 'application/pdf' });
  });
});
