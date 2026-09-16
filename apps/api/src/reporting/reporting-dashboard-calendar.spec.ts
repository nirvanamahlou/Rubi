import { describe, expect, it } from 'vitest';

import {
  dashboardCalendarRangeStart,
  dashboardPersianDateParts,
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
});
