import { describe, expect, it } from 'vitest';
import { parseGeneratedBlockCandidate, validateGeneratedBlock } from '../../src/block-generation';

describe('block generation normalization', () => {
  it('accepts model output that includes the Payload block wrapper type', () => {
    const parsed = parseGeneratedBlockCandidate({
      blockType: 'ai-html-block',
      html: '<section>Reference data</section>',
      css: '.demo { color: black; }',
      variables: [],
    });

    expect(parsed).toEqual({
      html: '<section>Reference data</section>',
      css: '.demo { color: black; }',
      variables: [],
    });

    const wrappedGenerated = {
      blockType: 'ai-html-block',
      html: '<section>Reference data</section>',
      variables: [],
    } as unknown as Parameters<typeof validateGeneratedBlock>[0];

    expect(validateGeneratedBlock(wrappedGenerated).normalized).toMatchObject({
      html: '<section>Reference data</section>',
      variables: [],
    });
  });
});
