import { describe, expect, it } from 'vitest';

import {
  shouldShowWorkbenchRequestStatus,
  workbenchRequestStatusLabel,
} from './workbench-request-status';

describe('shouldShowWorkbenchRequestStatus', () => {
  it('keeps NEW only on the latest request', () => {
    expect(shouldShowWorkbenchRequestStatus('NEW', true)).toBe(true);
    expect(shouldShowWorkbenchRequestStatus('new', false)).toBe(false);
  });

  it('keeps other statuses visible on every request', () => {
    expect(shouldShowWorkbenchRequestStatus('IN_PROGRESS', false)).toBe(true);
    expect(shouldShowWorkbenchRequestStatus('DONE', false)).toBe(true);
  });

  it('renders request statuses in Persian', () => {
    expect(workbenchRequestStatusLabel('NEW')).toBe('جدید');
    expect(workbenchRequestStatusLabel('in_progress')).toBe('در حال پیگیری');
    expect(workbenchRequestStatusLabel('UNKNOWN')).toBe('تعیین نشده');
  });
});
