import type { CollectionConfig } from 'payload';
import { describe, expect, it } from 'vitest';

import { upsertCollection } from '../../src/config/upsertCollection';

const existingCollection = {
  slug: 'existing',
  fields: [],
} satisfies CollectionConfig;

const aiCollection = {
  slug: 'ai-models-options',
  fields: [],
} satisfies CollectionConfig;

describe('upsertCollection', () => {
  it('identifies an undefined collection import', () => {
    expect(() => upsertCollection([undefined, existingCollection], aiCollection)).toThrowError(
      'aiGenerate: config.collections[0] is undefined; a collection import probably resolved to undefined (circular import?)'
    );
  });
});
