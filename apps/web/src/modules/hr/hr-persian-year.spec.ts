import { expect, it } from 'vitest';
import { currentPersianYear } from './hr-radan-tools';

it('extracts the numeric Persian year without the calendar era suffix', () => {
  expect(currentPersianYear(new Date('2026-10-25T10:00:00Z'))).toBe(1405);
});

it('changes the leave year at midnight in Tehran', () => {
  expect(currentPersianYear(new Date('2026-03-20T20:29:59Z'))).toBe(1404);
  expect(currentPersianYear(new Date('2026-03-20T20:30:00Z'))).toBe(1405);
});
