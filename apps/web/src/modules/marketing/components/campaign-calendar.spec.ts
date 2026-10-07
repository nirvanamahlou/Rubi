import { calendarParts } from '@/components/ui/date-picker.utils';
import { describe, expect, it } from 'vitest';
import { campaignCalendarMonthRange } from './campaign-calendar';

describe('Marketing Persian campaign calendar range', () => {
  it('uses the visible Persian month instead of Gregorian month boundaries', () => {
    const anchor = new Date('2026-10-06T12:00:00.000Z');
    const range = campaignCalendarMonthRange(anchor);
    expect(range).not.toEqual({ startsAt: '2026-10-01', endsAt: '2026-10-31' });
    expect(
      calendarParts(new Date(`${range.startsAt}T12:00:00`), 'persian').day,
    ).toBe(1);
    expect(
      calendarParts(new Date(`${range.startsAt}T12:00:00`), 'persian').month,
    ).toBe(calendarParts(anchor, 'persian').month);
    expect(range.startsAt < range.endsAt).toBe(true);
  });
});
