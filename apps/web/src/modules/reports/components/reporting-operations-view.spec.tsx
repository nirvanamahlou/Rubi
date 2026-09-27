import { describe, expect, it } from 'vitest';

import {
  REPORTING_OPERATIONS_CELL_CLASS,
  REPORTING_OPERATIONS_LIMIT,
  reportingOperationsShowOwnerExecutor,
  reportingOperationsShowRunMetrics,
  reportingOperationTitle,
  reportingRunActionLabel,
} from './reporting-operations-view';

describe('Reporting run action labels', () => {
  it('keeps operational history bounded to the 30 most recent records', () => {
    expect(REPORTING_OPERATIONS_LIMIT).toBe(30);
  });

  it('vertically centers every cell in the reporting operation tables', () => {
    expect(REPORTING_OPERATIONS_CELL_CLASS).toContain('align-middle');
  });

  it('hides output count and duration only from execution rows', () => {
    expect(reportingOperationsShowRunMetrics('recent')).toBe(false);
    expect(reportingOperationsShowRunMetrics('saved')).toBe(true);
    expect(reportingOperationsShowRunMetrics('shared')).toBe(true);
    expect(reportingOperationsShowRunMetrics('downloads')).toBe(true);
  });

  it('uses the Persian catalog title instead of an English report code', () => {
    expect(reportingOperationTitle({ id: 'row-1' }, 'sales_by_service_route')).toBe(
      'کدام خدمت، مسیر یا شهر مقصد بیشترین فروش را ایجاد کرده است؟',
    );
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
