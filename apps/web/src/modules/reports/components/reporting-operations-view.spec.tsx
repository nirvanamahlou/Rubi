import { describe, expect, it } from 'vitest';

import {
  REPORTING_OPERATIONS_LIMIT,
  reportingOperationsShowOwnerExecutor,
  reportingRunActionLabel,
  reportingRunSavedReportId,
} from './reporting-operations-view';

describe('Reporting run action labels', () => {
  it('keeps operational history bounded to the 30 most recent records', () => {
    expect(REPORTING_OPERATIONS_LIMIT).toBe(30);
  });

  it('explains each persisted form action and keeps legacy rows understandable', () => {
    expect(reportingRunActionLabel('PREVIEW')).toBe('نمایش نتیجه');
    expect(reportingRunActionLabel('SAVE')).toBe('ذخیره گزارش');
    expect(reportingRunActionLabel('EXPORT')).toBe('خروجی گرفتن نتیجه');
    expect(reportingRunActionLabel(null)).toBe('اجرای پیشین');
  });

  it('keeps the owner or executor column exclusive to shared reports', () => {
    expect(reportingOperationsShowOwnerExecutor('shared')).toBe(true);
    expect(reportingOperationsShowOwnerExecutor('saved')).toBe(false);
    expect(reportingOperationsShowOwnerExecutor('recent')).toBe(false);
    expect(reportingOperationsShowOwnerExecutor('downloads')).toBe(false);
  });

  it('only enables deleting a saved report from an execution with a saved-report link', () => {
    expect(
      reportingRunSavedReportId({
        id: 'run-1',
        savedReportId: 'saved-1',
      }),
    ).toBe('saved-1');
    expect(reportingRunSavedReportId({ id: 'run-2' })).toBeUndefined();
  });
});
