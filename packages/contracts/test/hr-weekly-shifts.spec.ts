import { describe, expect, it } from 'vitest';
import { hrShiftMatchesDate } from '../src/hr/weekly-shifts';

describe('weekly shift dates', () => {
  const values = [
    'Sunday',
    '09:00',
    '17:00',
    '0',
    '0',
    '',
    'Employee',
    '2026-11-01',
    '2026-11-15',
    'یکشنبه',
  ];
  it('includes both boundaries and repeats only on the selected weekday', () => {
    expect(hrShiftMatchesDate(values, '2026-11-01')).toBe(true);
    expect(hrShiftMatchesDate(values, '2026-11-08')).toBe(true);
    expect(hrShiftMatchesDate(values, '2026-11-15')).toBe(true);
    for (const date of ['2026-10-25', '2026-11-02', '2026-11-22'])
      expect(hrShiftMatchesDate(values, date)).toBe(false);
  });
  it('preserves legacy daily assignments without a weekday', () => {
    expect(hrShiftMatchesDate(values.slice(0, 9), '2026-11-02')).toBe(true);
  });
});
