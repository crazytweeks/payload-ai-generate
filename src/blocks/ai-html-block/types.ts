import type { BasePayload } from 'payload';

export type AiHtmlReferenceLoadingMode = 'client' | 'server';

export type AiHtmlReferenceCollection = {
  collection?: string | null;
  dataLoading?: AiHtmlReferenceLoadingMode | null;
  filtersJSON?: string | null;
  id?: number | string | null;
  isBeingUsed?: boolean | null;
  limit?: number | null;
};

export type AiHtmlVariable = {
  key?: string | null;
  value?: string | null;
};

export type AiHtmlPromptDoc = {
  css?: string | null;
  dataJSON?: string | null;
  html?: string | null;
  id?: number | string | null;
  js?: string | null;
  referenceCollections?: AiHtmlReferenceCollection[] | null;
  variablesJSON?: string | null;
};

export type AiHtmlBlockProps = {
  id?: number | string | null;
  code?: AiHtmlPromptDoc | number | string | null;
  payload?: BasePayload;
};
