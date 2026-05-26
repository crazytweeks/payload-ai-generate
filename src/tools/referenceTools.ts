import { type ToolSet, tool } from 'ai';
import type { CollectionSlug, Payload, Where } from 'payload';
import { z } from 'zod';
import type { AIPluginOptions, AIReferenceDataSource } from '../ai-types';

const parseJSON = (value: string | null | undefined): unknown => {
  if (!value?.trim()) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const parseWhere = (value: string | null | undefined): Where | undefined => {
  const parsed = parseJSON(value);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Where)
    : undefined;
};

const normalizeLimit = (limit: number | null | undefined) => {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) {
    return 10;
  }

  return Math.max(1, Math.floor(limit));
};

const getActiveServerReferences = ({
  pluginOptions,
  references,
}: {
  pluginOptions: AIPluginOptions;
  references: AIReferenceDataSource[];
}) =>
  references.filter(
    (reference): reference is AIReferenceDataSource & { referenceCollection: string } =>
      reference.isBeingUsed === true &&
      reference.dataLoading !== 'client' &&
      typeof reference.referenceCollection === 'string' &&
      reference.referenceCollection.length > 0 &&
      pluginOptions.referenceCollections?.[reference.referenceCollection] === true
  );

export const createReferenceTools = ({
  payload,
  pluginOptions,
  references,
}: {
  payload: Payload;
  pluginOptions: AIPluginOptions;
  references: AIReferenceDataSource[];
}): ToolSet => {
  const activeReferences = getActiveServerReferences({ pluginOptions, references });

  if (activeReferences.length === 0) {
    return {};
  }

  const referenceByCollection = new Map(
    activeReferences.map((reference) => [reference.referenceCollection, reference])
  );

  return {
    fetch_reference_docs: tool({
      description:
        'Fetch documents from an active AI prompt reference collection before generating the component. Use this when reference data sources are provided in the prompt.',
      inputSchema: z.object({
        collection: z
          .string()
          .describe('Collection slug from the active reference sources listed in the prompt.'),
      }),
      execute: async ({ collection }) => {
        console.warn(
          `AI Step of checking collection "${collection}" for reference data source documents. This tool is intended for use in development and testing, and should not be used in production environments.`
        );

        const reference = referenceByCollection.get(collection);

        if (!reference) {
          payload.logger.info({
            collection,
            msg: 'AI reference tool rejected unavailable collection',
          });
          throw new Error(`Reference collection "${collection}" is not active for this prompt.`);
        }

        const limit = normalizeLimit(reference.limit);
        const where = parseWhere(reference.filtersJSON);

        payload.logger.info({
          collection,
          limit,
          msg: 'AI reference tool fetching documents',
          where,
        });

        const result = await payload.find({
          collection: collection as CollectionSlug,
          depth: 0,
          limit,
          where,
        });

        payload.logger.info({
          collection,
          docsReturned: result.docs.length,
          msg: 'AI reference tool fetched documents',
          totalDocs: result.totalDocs,
        });

        return {
          collection,
          docs: result.docs,
          limit: result.limit,
          page: result.page,
          totalDocs: result.totalDocs,
          totalPages: result.totalPages,
        };
      },
    }),
  };
};
