import { SessionStatus } from '@rubi/database';
import { describe, expect, it } from 'vitest';

import { classifyRefreshFailure } from './refresh-token-policy';

describe('refresh token reuse policy', () => {
  const now = new Date('2026-08-31T12:00:00.000Z');

  it('treats a just-rotated matching token as a concurrent browser refresh', () => {
    expect(
      classifyRefreshFailure(
        {
          status: SessionStatus.ROTATED,
          revokedAt: new Date(now.getTime() - 1_000),
          revokedReason: 'rotated',
        },
        true,
        now,
      ),
    ).toBe('CONCURRENT_REFRESH');
  });

  it('treats an old rotated token as reuse', () => {
    expect(
      classifyRefreshFailure(
        {
          status: SessionStatus.ROTATED,
          revokedAt: new Date(now.getTime() - 10_000),
          revokedReason: 'rotated',
        },
        true,
        now,
      ),
    ).toBe('TOKEN_REUSE');
  });

  it('never grants a grace window to a mismatched secret', () => {
    expect(
      classifyRefreshFailure(
        {
          status: SessionStatus.ROTATED,
          revokedAt: new Date(now.getTime() - 100),
          revokedReason: 'rotated',
        },
        false,
        now,
      ),
    ).toBe('TOKEN_REUSE');
  });
});
