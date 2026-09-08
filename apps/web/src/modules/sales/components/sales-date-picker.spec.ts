import { describe, expect, it } from 'vitest';
import {
  calendarMonthName,
  calendarMonthLabel,
  formatCalendarValue,
  parseIsoDate,
  toIsoDate,
} from '@/components/ui/date-picker.utils';

describe('Sales English Gregorian calendar opt-in', () => {
  it('shows English months and Latin digits when enabled', () => {
    const date = parseIsoDate('2026-09-05')!;
    expect(calendarMonthName(date, 'gregorian', true)).toBe('September');
    expect(calendarMonthLabel(date, 'gregorian', true)).toBe('September 2026');
    expect(
      formatCalendarValue('2026-09-05T09:30', 'gregorian', true, true),
    ).toBe('5 September 2026, 09:30');
  });
  it('preserves default calendar language outside Sales and Persian mode inside Sales', () => {
    const date = parseIsoDate('2026-09-05')!;
    expect(calendarMonthName(date, 'gregorian')).toBe('سپتامبر');
    expect(calendarMonthName(date, 'persian', true)).toBe(
      calendarMonthName(date, 'persian'),
    );
    expect(formatCalendarValue('2026-09-05', 'persian', false, true)).toBe(
      formatCalendarValue('2026-09-05', 'persian'),
    );
  });
  it('never changes the stored ISO date while formatting in either language', () => {
    const value = '2026-09-05';
    formatCalendarValue(value, 'gregorian', false, true);
    formatCalendarValue(value, 'persian', false, true);
    expect(toIsoDate(parseIsoDate(value)!)).toBe(value);
  });
});
