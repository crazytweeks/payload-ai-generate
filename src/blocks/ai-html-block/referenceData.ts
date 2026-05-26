import type { BasePayload, CollectionSlug, Where } from 'payload';
import type { AIPluginOptions } from '../../ai-types';
import type { AiHtmlPromptDoc, AiHtmlReferenceCollection } from './types';

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
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Where) : undefined;
};

const getPluginOptions = (payload: BasePayload): AIPluginOptions => {
  const custom = (payload as { config?: { custom?: { aiPluginOptions?: AIPluginOptions } } }).config
    ?.custom;
  return custom?.aiPluginOptions ?? {};
};

const isAllowedReferenceCollection = (payload: BasePayload, collection: string) => {
  const referenceCollections = getPluginOptions(payload).referenceCollections ?? {};
  return referenceCollections[collection];
};

const getServerReferences = (references: AiHtmlReferenceCollection[] | null | undefined) =>
  (references ?? []).filter(
    (reference): reference is AiHtmlReferenceCollection & { referenceCollection: string } =>
      typeof reference?.referenceCollection === 'string' &&
      reference.referenceCollection.length > 0 &&
      (reference.dataLoading ?? 'server') === 'server'
  );

const normalizeLimit = (limit: number | null | undefined) => {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) {
    return 10;
  }

  return Math.max(1, Math.floor(limit));
};

const mergeReferenceData = (
  dataJSON: string | null | undefined,
  referenceData: Record<string, unknown>
) => {
  const parsedData = parseJSON(dataJSON);
  const baseData =
    parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData)
      ? parsedData
      : { value: parsedData };

  return JSON.stringify({
    ...baseData,
    references: referenceData,
  });
};

export const withServerReferenceData = async (
  promptDoc: AiHtmlPromptDoc | null,
  payload: BasePayload | undefined
): Promise<AiHtmlPromptDoc | null> => {
  if (!promptDoc || !payload) {
    return promptDoc;
  }

  const references = getServerReferences(promptDoc.referenceCollections);

  if (!references.length) {
    return promptDoc;
  }

  const referenceData: Record<string, unknown> = {};

  for (const reference of references) {
    if (!isAllowedReferenceCollection(payload, reference.referenceCollection)) {
      continue;
    }

    const result = await payload.find({
      collection: reference.referenceCollection as CollectionSlug,
      depth: 0,
      limit: normalizeLimit(reference.limit),
      where: parseWhere(reference.filtersJSON),
    });

    referenceData[reference.referenceCollection] = {
      docs: result.docs,
      limit: result.limit,
      page: result.page,
      totalDocs: result.totalDocs,
      totalPages: result.totalPages,
    };
  }

  return {
    ...promptDoc,
    dataJSON: mergeReferenceData(promptDoc.dataJSON, referenceData),
  };
};
