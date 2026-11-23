import { describe, expect, it } from 'vitest';

import { modelSyncSkipReason, shouldSkipModelSync } from '../src/modelSync';

describe('modelSyncSkipReason', () => {
  it('skips during the Next.js production build phase', () => {
    expect(modelSyncSkipReason({}, { NEXT_PHASE: 'phase-production-build' })).toBe(
      'production-build'
    );
    // The build phase wins even when the caller did not opt in.
    expect(
      modelSyncSkipReason({}, { NEXT_PHASE: 'phase-production-build', NODE_ENV: 'production' })
    ).toBe('production-build');
  });

  it('skips when the host app sets skipModelSync', () => {
    expect(modelSyncSkipReason({ skipModelSync: true }, {})).toBe('plugin-option');
    expect(
      modelSyncSkipReason({ skipModelSync: true }, { NEXT_PHASE: 'phase-production-server' })
    ).toBe('plugin-option');
  });

  it('does not skip a normal runtime boot', () => {
    expect(modelSyncSkipReason({}, {})).toBeNull();
    expect(modelSyncSkipReason({ skipModelSync: false }, {})).toBeNull();
    expect(modelSyncSkipReason(undefined, { NODE_ENV: 'production' })).toBeNull();
  });

  it('exposes the boolean form', () => {
    expect(shouldSkipModelSync({ skipModelSync: true }, {})).toBe(true);
    expect(shouldSkipModelSync({}, {})).toBe(false);
    expect(shouldSkipModelSync({}, { NEXT_PHASE: 'phase-production-build' })).toBe(true);
  });
});
