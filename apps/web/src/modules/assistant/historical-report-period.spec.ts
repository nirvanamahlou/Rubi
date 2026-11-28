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

it.each([
  'از ۱ آذر ۱۴۰۵ تا ۶ آذر ۱۴۰۵',
  'از ۱ آذر تا ۶ آذر ۱۴۰۵',
  'از ۱ تا ۶ آذر ۱۴۰۵',
])('keeps both Tehran endpoints in %s', (question) => {
  expect(historicalReportPeriod(question)).toMatchObject({
    from: '2026-11-21T20:30:00.000Z',
    to: '2026-11-27T20:30:00.000Z',
  });
});

it('resolves a whole named month and a range spanning two months', () => {
  expect(historicalReportPeriod('در آبان ۱۴۰۵')).toMatchObject({
    from: '2026-10-22T20:30:00.000Z',
    to: '2026-11-21T20:30:00.000Z',
  });
  expect(historicalReportPeriod('۳۰ آبان ۱۴۰۵ تا ۶ آذر ۱۴۰۵')).toMatchObject({
    from: '2026-11-20T20:30:00.000Z',
    to: '2026-11-27T20:30:00.000Z',
  });
});

it.each([
  'از ۱ آذر ۱۴۰۵ تا ۶ آذر ۱۴۰۵ چند درخواست در میزکار ثبت کردم؟',
  'در آبان ۱۴۰۵ چند تا درخواست در میزکار ثبت کردم؟',
])('accepts natural first-person workbench counts: %s', (question) => {
  expect(asksHistoricalOwnRequestCount(question)).toBe(true);
});

it.each([
  'از ۱ تا ۶ آذر ۱۴۰۵ چند درخواست در میزکار ثبت شد؟',
  'چند درخواست دریافتی در کارتابل خودم ثبت شده؟',
  'چجوری از میزکار درخواست ثبت کنم؟',
])('leaves other workbench questions to their own route: %s', (question) => {
  expect(asksHistoricalOwnRequestCount(question)).toBe(false);
});

it('uses the historical drilldown only for a supported call count', () => {
  expect(
    callCenterIntent(
      'از ۱ آذر ۱۴۰۵ تا ۶ آذر ۱۴۰۵ چند تماس بدون نتیجه در کال سنتر ثبت شده؟',
      false,
    ),
  ).toBe('historicalWithoutOutcome');
  expect(
    callCenterIntent(
      'از ۱ تا ۶ آذر ۱۴۰۵ چند تماس ورودی بدون نتیجه در کال سنتر ثبت شده؟',
      false,
    ),
  ).toBe('report');
});
