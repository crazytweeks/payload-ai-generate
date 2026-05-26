import { type ToolSet, tool } from 'ai';
import type { CollectionSlug, Payload, Where } from 'payload';
import { z } from 'zod';
import type { AIPluginOptions } from '../ai-types';

const parseJSON = (value: string | null | undefined): unknown => {
  if (!value?.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

/**
 * Additional Payload tools for the AI agent:
 * - query_collection: flexible filtered query
 * - update_document: patch a single document field
 * - create_document: insert a new document
 */
export const createCollectionTools = ({
  payload,
  pluginOptions,
}: {
  payload: Payload;
  pluginOptions: AIPluginOptions;
}): ToolSet => {
  const allowed = new Set(
    Object.entries(pluginOptions.referenceCollections ?? {})
      .filter(([, enabled]) => enabled)
      .map(([slug]) => slug)
  );

  const guard = (collection: string) => {
    if (!allowed.has(collection)) {
      throw new Error(
        `Collection "${collection}" is not in the allowed reference list for this session.`
      );
    }
  };

  return {
    query_collection: tool({
      description:
        'Query documents from an allowed reference collection with optional filters, sort, and field selection.',
      inputSchema: z.object({
        collection: z.string().describe('Collection slug.'),
        where: z
          .string()
          .optional()
          .describe('Payload where clause as JSON string, e.g. \'{"status":{"equals":"published"}}\'.'),
        limit: z.number().int().min(1).max(100).default(10),
        sort: z.string().optional().describe('Field to sort by, prefix with - for descending.'),
      }),
      execute: async ({ collection, where, limit, sort }) => {
        guard(collection);
        const whereClause = parseJSON(where) as Where | undefined;
        payload.logger.info({ collection, limit, sort, msg: '[ai] query_collection' });
        const result = await payload.find({
          collection: collection as CollectionSlug,
          depth: 0,
          limit,
          sort: sort as never,
          where: whereClause,
        });
        return { docs: result.docs, totalDocs: result.totalDocs };
      },
    }),

    update_document: tool({
      description:
        'Update specific fields on a single document in an allowed collection. Use sparingly — only when the user explicitly asks to persist changes.',
      inputSchema: z.object({
        collection: z.string().describe('Collection slug.'),
        id: z.string().describe('Document ID.'),
        data: z.string().describe('JSON string of fields to update, e.g. \'{"status":"published"}\'.'),
      }),
      execute: async ({ collection, id, data }) => {
        guard(collection);
        const parsedData = parseJSON(data);
        if (!parsedData || typeof parsedData !== 'object') {
          throw new Error('data must be a valid JSON object.');
        }
        payload.logger.info({ collection, id, msg: '[ai] update_document' });
        const updated = await payload.update({
          collection: collection as CollectionSlug,
          id,
          data: parsedData as Record<string, unknown>,
        });
        return { id: updated.id, updated: true };
      },
    }),

    create_document: tool({
      description:
        'Create a new document in an allowed collection. Use only when the user explicitly asks to create data.',
      inputSchema: z.object({
        collection: z.string().describe('Collection slug.'),
        data: z.string().describe('JSON string of the document fields to create.'),
      }),
      execute: async ({ collection, data }) => {
        guard(collection);
        const parsedData = parseJSON(data);
        if (!parsedData || typeof parsedData !== 'object') {
          throw new Error('data must be a valid JSON object.');
        }
        payload.logger.info({ collection, msg: '[ai] create_document' });
        const created = await payload.create({
          collection: collection as CollectionSlug,
          data: parsedData as Record<string, unknown>,
        });
        return { id: created.id, created: true };
      },
    }),
  };
};
