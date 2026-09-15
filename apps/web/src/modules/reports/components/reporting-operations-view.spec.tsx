import { describe, expect, it } from 'vitest';

import { reportingRunActionLabel } from './reporting-operations-view';

describe('Reporting run action labels', () => {
  it('explains each persisted form action and keeps legacy rows understandable', () => {
    expect(reportingRunActionLabel('PREVIEW')).toBe('نمایش نتیجه');
    expect(reportingRunActionLabel('SAVE')).toBe('ذخیره گزارش');
    expect(reportingRunActionLabel('EXPORT')).toBe('خروجی گرفتن نتیجه');
    expect(reportingRunActionLabel(null)).toBe('اجرای پیشین');
  });
});
