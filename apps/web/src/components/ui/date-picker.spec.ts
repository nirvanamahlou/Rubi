import { describe, expect, it } from 'vitest';

import {
  calendarMonthDays,
  calendarParts,
  formatCalendarValue,
  joinDateAndTime,
  moveCalendarMonth,
  parseIsoDate,
  toIsoDate,
} from './date-picker.utils';

describe('shared blue date picker calendar utilities', () => {
  it('maps the same stored Gregorian day to Persian calendar parts', () => {
    const date = new Date(2026, 2, 21, 12);
    expect(calendarParts(date, 'persian')).toEqual({
      year: 1405,
      month: 1,
      day: 1,
    });
    expect(calendarParts(date, 'gregorian')).toEqual({
      year: 2026,
      month: 3,
      day: 21,
    });
  });

  it('keeps storage values Gregorian while switching presentation', () => {
    const value = '2026-03-21T09:30';
    expect(toIsoDate(parseIsoDate(value)!)).toBe('2026-03-21');
    expect(formatCalendarValue(value, 'persian', true)).toContain('۱۴۰۵');
    expect(formatCalendarValue(value, 'gregorian', true)).toContain('۲۰۲۶');
    expect(joinDateAndTime('2026-03-22', value, true)).toBe('2026-03-22T09:30');
  });

  it('creates complete six-week grids and navigates both calendars', () => {
    const anchor = new Date(2026, 2, 21, 12);
    for (const system of ['persian', 'gregorian'] as const) {
      const grid = calendarMonthDays(anchor, system);
      expect(grid).toHaveLength(42);
      expect(grid.some((day) => day.isCurrentMonth)).toBe(true);
      const next = moveCalendarMonth(anchor, 1, system);
      expect(calendarParts(next, system).month).not.toBe(
        calendarParts(anchor, system).month,
      );
    }
  });
});
