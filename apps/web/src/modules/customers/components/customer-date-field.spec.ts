import { describe, expect, it } from 'vitest';

import {
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
});
