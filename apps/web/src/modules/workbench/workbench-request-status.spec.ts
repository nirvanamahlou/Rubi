import { describe, expect, it } from 'vitest';

import { shouldShowWorkbenchRequestStatus } from './workbench-request-status';

describe('shouldShowWorkbenchRequestStatus', () => {
  it('keeps NEW only on the latest request', () => {
    expect(shouldShowWorkbenchRequestStatus('NEW', true)).toBe(true);
    expect(shouldShowWorkbenchRequestStatus('new', false)).toBe(false);
  });

  it('keeps other statuses visible on every request', () => {
    expect(shouldShowWorkbenchRequestStatus('IN_PROGRESS', false)).toBe(true);
    expect(shouldShowWorkbenchRequestStatus('DONE', false)).toBe(true);
  });
});
