import { describe, expect, it } from 'vitest';

import { parseRedisUrl } from '@rubi/config';

describe('worker Redis configuration', () => {
  it('supports TLS Redis URLs for future hosted environments', () => {
    expect(
      parseRedisUrl('rediss://worker:secret@redis.rubi.test:6380'),
    ).toEqual({
      host: 'redis.rubi.test',
      port: 6380,
      username: 'worker',
      password: 'secret',
      tls: {},
    });
  });
});
