import { SessionStatus } from '@rubi/database';

import { CONCURRENT_REFRESH_GRACE_MS } from './iam.constants';

interface RefreshSessionState {
  revokedAt: Date | null;
  revokedReason: string | null;
  status: SessionStatus;
}

export type RefreshFailureClassification = 'CONCURRENT_REFRESH' | 'TOKEN_REUSE';

export function classifyRefreshFailure(
  session: RefreshSessionState,
  hashMatches: boolean,
  now = new Date(),
): RefreshFailureClassification {
  if (
    hashMatches &&
    session.status === SessionStatus.ROTATED &&
    session.revokedReason === 'rotated' &&
    session.revokedAt
  ) {
    const elapsed = now.getTime() - session.revokedAt.getTime();
    if (elapsed >= 0 && elapsed <= CONCURRENT_REFRESH_GRACE_MS)
      return 'CONCURRENT_REFRESH';
  }
  return 'TOKEN_REUSE';
}
