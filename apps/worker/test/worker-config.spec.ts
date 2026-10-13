import { describe, expect, it } from 'vitest';

import { parseRedisUrl } from '@nora/config';

describe('worker Redis configuration', () => {
  it('supports TLS Redis URLs for future hosted environments', () => {
    expect(
      parseRedisUrl('rediss://worker:secret@redis.nora.test:6380'),
    ).toEqual({
      host: 'redis.nora.test',
      port: 6380,
      username: 'worker',
      password: 'secret',
      tls: {},
    });
  });
});
