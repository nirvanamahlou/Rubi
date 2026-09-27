import { describe, expect, it } from 'vitest';

import {
  REPORTING_OPERATIONS_CELL_CLASS,
  REPORTING_OPERATIONS_LIMIT,
  reportingOperationsShowOwnerExecutor,
  reportingRunActionLabel,
} from './reporting-operations-view';

describe('Reporting run action labels', () => {
  it('keeps operational history bounded to the 30 most recent records', () => {
    expect(REPORTING_OPERATIONS_LIMIT).toBe(30);
  });

  it('vertically centers every cell in the reporting operation tables', () => {
    expect(REPORTING_OPERATIONS_CELL_CLASS).toContain('align-middle');
  });

  it('explains each persisted form action and keeps legacy rows understandable', () => {
    expect(reportingRunActionLabel('PREVIEW')).toBe('نمایش نتیجه');
    expect(reportingRunActionLabel('SAVE')).toBe('ذخیره گزارش');
    expect(reportingRunActionLabel('EXPORT')).toBe('خروجی گرفتن نتیجه');
    expect(reportingRunActionLabel('DELETE_SAVED')).toBe('حذف گزارش من');
    expect(
      reportingRunActionLabel('SHARE', { recipientName: 'کاربر مجاز' }),
    ).toBe('اشتراک‌گذاری شده با «کاربر مجاز»');
    expect(reportingRunActionLabel(null)).toBe('اجرای پیشین');
  });

  it('keeps the owner or executor column exclusive to shared reports', () => {
    expect(reportingOperationsShowOwnerExecutor('shared')).toBe(true);
    expect(reportingOperationsShowOwnerExecutor('saved')).toBe(false);
    expect(reportingOperationsShowOwnerExecutor('recent')).toBe(false);
    expect(reportingOperationsShowOwnerExecutor('downloads')).toBe(false);
  });

});
