import { describe, expect, test } from 'vitest';
import { extractCatalogModels, validateModels } from '../src/models-extract';

describe('SDK model extraction', () => {
  test('reads only catalog entries supporting the requested category', () => {
    const source = `declare const catalog: {
      readonly 'text-model': { readonly types: readonly ["language", "interactions"]; readonly definition: { nested: true } };
      readonly 'image-model': { readonly types: readonly ["image"]; readonly definition: undefined };
    };`;
    expect(extractCatalogModels(source, 'catalog', 'types', 'language')).toEqual(['text-model']);
    expect(() => extractCatalogModels(source, 'missing', 'types', 'language')).toThrow('Could not find model catalog');
  });

  test('rejects incomplete provider lists', () => {
    expect(() => validateModels({ google: Array(10).fill('model'), openai: ['responses'] }))
      .toThrow('Extracted only 1 openai models');
  });
});
