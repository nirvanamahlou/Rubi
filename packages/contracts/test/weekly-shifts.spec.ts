import { expect, it } from 'vitest';
import { hrShiftMatchesDate, hrShiftWeekdays } from '../src/hr/weekly-shifts';

it('matches all selected weekdays and preserves single-day and legacy shifts', () => {
  const values = [
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '2026-11-01',
    '2026-11-07',
    'یکشنبه، دوشنبه',
  ];
  expect(hrShiftMatchesDate(values, '2026-11-01')).toBe(true);
  expect(hrShiftMatchesDate(values, '2026-11-02')).toBe(true);
  expect(hrShiftMatchesDate(values, '2026-11-03')).toBe(false);
  expect(hrShiftMatchesDate(values, '2026-11-08')).toBe(false);
  values[9] = 'دوشنبه';
  expect(hrShiftMatchesDate(values, '2026-11-01')).toBe(false);
  expect(hrShiftMatchesDate(values, '2026-11-02')).toBe(true);
  values[9] = '';
  expect(hrShiftMatchesDate(values, '2026-11-03')).toBe(true);
  expect(hrShiftWeekdays('شنبه، دوشنبه')).toEqual(['شنبه', 'دوشنبه']);
});
