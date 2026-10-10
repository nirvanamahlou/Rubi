import { afterEach, describe, expect, it, vi } from 'vitest';

import { browserRandomUuid } from './browser-random-uuid';

describe('browserRandomUuid', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses random values when LAN HTTP does not expose randomUUID', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.set(Array.from({ length: 16 }, (_, index) => index));
        return bytes;
      },
    });
    expect(browserRandomUuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
