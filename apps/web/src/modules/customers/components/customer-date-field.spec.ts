import { describe, expect, it } from 'vitest';

import {
  calendarMonthDays,
  formatCustomerDate,
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
    expect(formatCustomerDate(iso, 'gregorian')).toContain('۲۰۲۶');
  });

  it('builds a selectable Persian calendar grid instead of manual date inputs', () => {
    const days = calendarMonthDays('persian', 1405, 1).filter(Boolean);
    expect(days).toHaveLength(31);
    expect(days[0]).toEqual({ day: 1, iso: '2026-03-21' });
  });

  it('builds a Gregorian calendar grid with real month length', () => {
    const days = calendarMonthDays('gregorian', 2026, 2).filter(Boolean);
    expect(days).toHaveLength(28);
  });
});
