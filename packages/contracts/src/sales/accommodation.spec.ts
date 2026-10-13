import { describe, expect, it } from 'vitest';
import { salesAccommodationValid } from './index';
describe('Sales hotel accommodation', () => {
  it('permits only age-compatible explicit choices', () => {
    expect(salesAccommodationValid('DBL', 'ADT')).toBe(true);
    expect(salesAccommodationValid('SINGLE', 'ADT')).toBe(true);
    expect(salesAccommodationValid('INFANT', 'INF')).toBe(true);
    expect(salesAccommodationValid('CHILD_WITH_BED', 'CHD')).toBe(true);
    expect(salesAccommodationValid('CHILD_WITHOUT_BED', 'CHD')).toBe(true);
    expect(salesAccommodationValid('DBL', 'CHD')).toBe(false);
    expect(salesAccommodationValid('INFANT', 'ADT')).toBe(false);
    expect(salesAccommodationValid('UNKNOWN', 'ADT')).toBe(false);
    expect(salesAccommodationValid(null, 'ADT')).toBe(false);
  });
});
