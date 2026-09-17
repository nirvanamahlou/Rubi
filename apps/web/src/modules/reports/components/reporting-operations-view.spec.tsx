import { describe, expect, it } from 'vitest';

import {
  REPORTING_OPERATIONS_LIMIT,
  reportingRunActionLabel,
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
});
