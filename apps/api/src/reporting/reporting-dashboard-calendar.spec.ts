import { describe, expect, it } from 'vitest';

import {
  dashboardCalendarRangeStart,
  dashboardPersianDateParts,
  dashboardTrendBucketStarts,
} from './reporting-dashboard-calendar';

describe('dashboard calendar ranges', () => {
  const now = new Date('2026-09-16T08:30:00.000Z');

  it('uses Tehran civil-day, Persian-week and Persian-month boundaries', () => {
    const today = dashboardCalendarRangeStart(now, 'today');
    const week = dashboardCalendarRangeStart(now, 'week');
    const month = dashboardCalendarRangeStart(now, 'month');

    expect(today.toISOString()).toBe('2026-09-15T20:30:00.000Z');
    expect(week.toISOString()).toBe('2026-09-11T20:30:00.000Z');
    expect(dashboardPersianDateParts(month).day).toBe(1);
    expect(month.getTime()).toBeLessThanOrEqual(today.getTime());
  });

  it('finds the first Persian month of the current quarter and year', () => {
    const quarter = dashboardCalendarRangeStart(now, 'quarter');
    const year = dashboardCalendarRangeStart(now, 'year');

    expect(dashboardPersianDateParts(quarter)).toMatchObject({ day: 1 });
    expect((dashboardPersianDateParts(quarter).month - 1) % 3).toBe(0);
    expect(dashboardPersianDateParts(year)).toMatchObject({ month: 1, day: 1 });
  });

  it('uses the requested calendar grain without inventing future buckets', () => {
    const today = dashboardCalendarRangeStart(now, 'today');
    const week = dashboardCalendarRangeStart(now, 'week');
    const month = dashboardCalendarRangeStart(now, 'month');
    const quarter = dashboardCalendarRangeStart(now, 'quarter');
    const year = dashboardCalendarRangeStart(now, 'year');

    expect(
      dashboardTrendBucketStarts({ from: today, range: 'today', to: now }),
    ).toHaveLength(12);
    expect(
      dashboardTrendBucketStarts({ from: week, range: 'week', to: now }),
    ).toHaveLength(5);
    expect(
      dashboardTrendBucketStarts({ from: month, range: 'month', to: now }),
    ).toHaveLength(dashboardPersianDateParts(now).day);
    expect(
      dashboardTrendBucketStarts({ from: quarter, range: 'quarter', to: now }),
    ).toHaveLength(
      Math.ceil(
        Math.ceil((now.getTime() - quarter.getTime()) / 86_400_000) / 7,
      ),
    );
    const yearBuckets = dashboardTrendBucketStarts({
      from: year,
      range: 'year',
      to: now,
    });
    expect(yearBuckets).toHaveLength(6);
    expect(
      yearBuckets.every((bucket) => bucket.getTime() < now.getTime()),
    ).toBe(true);
    expect(yearBuckets.map(dashboardPersianDateParts)).toEqual(
      expect.arrayContaining([expect.objectContaining({ day: 1 })]),
    );
  });

  it('keeps the requested hourly, daily, weekly and monthly bucket spacing', () => {
    const today = dashboardCalendarRangeStart(now, 'today');
    const week = dashboardCalendarRangeStart(now, 'week');
    const month = dashboardCalendarRangeStart(now, 'month');
    const quarter = dashboardCalendarRangeStart(now, 'quarter');

    const intervals = (buckets: readonly Date[]) =>
      buckets
        .slice(1)
        .map((bucket, index) => bucket.getTime() - buckets[index]!.getTime());

    expect(
      intervals(
        dashboardTrendBucketStarts({ from: today, range: 'today', to: now }),
      ),
    ).toEqual(expect.arrayContaining([60 * 60 * 1000]));
    expect(
      intervals(
        dashboardTrendBucketStarts({ from: week, range: 'week', to: now }),
      ),
    ).toEqual(expect.arrayContaining([24 * 60 * 60 * 1000]));
    expect(
      intervals(
        dashboardTrendBucketStarts({ from: month, range: 'month', to: now }),
      ),
    ).toEqual(expect.arrayContaining([24 * 60 * 60 * 1000]));
    expect(
      intervals(
        dashboardTrendBucketStarts({
          from: quarter,
          range: 'quarter',
          to: now,
        }),
      ),
    ).toEqual(expect.arrayContaining([7 * 24 * 60 * 60 * 1000]));
  });
});
