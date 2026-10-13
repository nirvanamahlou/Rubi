import { describe, expect, it } from 'vitest';

import {
  calendarMonthDays,
  calendarMonthName,
  formatCustomerDate,
  persianParts,
  persianDateToIso,
} from '../model/customer-calendar';

describe('Customer date field', () => {
  it('converts a Persian calendar date to the stable ISO value sent to API', () => {
    expect(persianDateToIso({ year: 1405, month: 1, day: 1 })).toBe(
      '2026-03-21',
    );
  });

  it('formats the same stored UTC date in the selected calendar', () => {
    const iso = '2026-03-21T00:00:00.000Z';
    expect(formatCustomerDate(iso, 'persian')).toContain('۱۴۰۵');
    expect(formatCustomerDate(iso, 'gregorian')).toContain('2026');
  });

  it('builds a selectable Persian calendar grid instead of manual date inputs', () => {
    const days = calendarMonthDays('persian', 1405, 1).filter(Boolean);
    expect(days).toHaveLength(31);
    expect(days[0]).toEqual({ day: 1, iso: '2026-03-21' });
  });

  it('keeps Persian leap-year boundaries and weekdays exact', () => {
    const leapEsfand = calendarMonthDays('persian', 1403, 12).filter(Boolean);
    const regularEsfand = calendarMonthDays('persian', 1404, 12).filter(
      Boolean,
    );
    expect(leapEsfand).toHaveLength(30);
    expect(leapEsfand.at(-1)).toEqual({ day: 30, iso: '2025-03-20' });
    expect(regularEsfand).toHaveLength(29);
    expect(persianParts(new Date('2026-08-29T00:00:00.000Z'))).toEqual({
      year: 1405,
      month: 6,
      day: 7,
    });
  });

  it('builds a Gregorian calendar grid with real month length', () => {
    const days = calendarMonthDays('gregorian', 2026, 2).filter(Boolean);
    expect(days).toHaveLength(28);
  });

  it('places Gregorian days in a conventional Sunday-first grid', () => {
    const august2023 = calendarMonthDays('gregorian', 2023, 8);
    expect(august2023.slice(0, 2)).toEqual([null, null]);
    const august18Index = august2023.findIndex(
      (day) => day?.iso === '2023-08-18',
    );
    expect(august18Index % 7).toBe(5);
    expect(formatCustomerDate('2023-08-18', 'gregorian')).toContain('Aug');
  });

  it('uses English labels for Gregorian month tiles', () => {
    expect(calendarMonthName('gregorian', 1)).toBe('January');
    expect(calendarMonthName('gregorian', 12)).toBe('December');
    expect(calendarMonthName('persian', 1)).toBe('فروردین');
  });
});
