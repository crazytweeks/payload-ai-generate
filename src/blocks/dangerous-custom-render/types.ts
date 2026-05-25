import type { BasePayload } from 'payload';

export type DangerousCustomRenderVariable = {
  key?: string | null;
  value?: string | null;
};

export type DangerousCustomRenderPromptDoc = {
  css?: string | null;
  dataJSON?: string | null;
  html?: string | null;
  id?: number | string | null;
  js?: string | null;
  variablesJSON?: string | null;
};

export type DangerousCustomRenderBlockProps = {
  id?: number | string | null;
  code?: DangerousCustomRenderPromptDoc | number | string | null;
  payload?: BasePayload;
};
