import { describe, expect, it } from 'vitest';
import { calendarParts } from '@/components/ui/date-picker.utils';
import { moveToCalendarMonth } from './ticket-date-picker';

describe('Ticket calendar direct month/year navigation', () => {
  it('moves directly across Gregorian years and keeps a valid day', () => {
    const result = moveToCalendarMonth(
      new Date(2026, 0, 31, 12),
      2030,
      12,
      'gregorian',
    );
    expect(calendarParts(result, 'gregorian')).toEqual({
      year: 2030,
      month: 12,
      day: 28,
    });
  });
  it('moves directly across Persian years using the shared calendar rules', () => {
    const result = moveToCalendarMonth(
      new Date(2026, 2, 21, 12),
      1407,
      12,
      'persian',
    );
    expect(calendarParts(result, 'persian')).toEqual({
      year: 1407,
      month: 12,
      day: 1,
    });
  });
  it('changes only the displayed anchor and leaves its input date immutable', () => {
    const selected = '2026-09-08T12:30';
    const anchor = new Date(2026, 8, 8, 12);
    moveToCalendarMonth(anchor, 2028, 4, 'gregorian');
    expect(selected).toBe('2026-09-08T12:30');
    expect(anchor.getFullYear()).toBe(2026);
  });
  it('rejects navigation beyond the bounded direct-choice window', () => {
    expect(() =>
      moveToCalendarMonth(new Date(2026, 0, 1, 12), 2067, 1, 'gregorian'),
    ).toThrow('خارج از بازه');
  });
});
