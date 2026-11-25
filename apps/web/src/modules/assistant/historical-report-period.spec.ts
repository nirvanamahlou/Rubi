import { expect, it } from 'vitest';
import { callCenterIntent } from './call-center-request-guide';
import {
  asksHistoricalOwnRequestCount,
  historicalReportPeriod,
} from './historical-report-period';

it('routes a dated no-outcome count separately from the current card', () => {
  const question = 'تو بازهٔ ۲۴ آبان ۱۴۰۵، تعداد تماسای بدون نتیجه چقده؟';
  expect(callCenterIntent(question, false)).toBe('historicalWithoutOutcome');
  expect(callCenterIntent('تعداد تماسای بدون نتیجه چقده؟', true)).toBe(
    'withoutOutcome',
  );
  expect(historicalReportPeriod(question)).toMatchObject({
    from: '2026-11-14T20:30:00.000Z',
    to: '2026-11-15T20:30:00.000Z',
  });
});

it('includes the last Tehran day and rejects invalid dates', () => {
  expect(historicalReportPeriod('۲۳ تا ۲۹ آبان ۱۴۰۵')).toMatchObject({
    from: '2026-11-13T20:30:00.000Z',
    to: '2026-11-20T20:30:00.000Z',
  });
  expect(historicalReportPeriod('۳۱ آبان ۱۴۰۵')).toBeUndefined();
  expect(historicalReportPeriod('۲۹ تا ۲۳ آبان ۱۴۰۵')).toBeUndefined();
});

it('recognizes a count of requests created by the current user', () => {
  expect(
    asksHistoricalOwnRequestCount(
      'تو بازهٔ ۲۴ آبان ۱۴۰۵، چن تا درخواست تو کارتابل خودم ثبت شده؟',
    ),
  ).toBe(true);
  expect(
    asksHistoricalOwnRequestCount('چطور درخواست تو کارتابل خودم ثبت کنم؟'),
  ).toBe(false);
});
