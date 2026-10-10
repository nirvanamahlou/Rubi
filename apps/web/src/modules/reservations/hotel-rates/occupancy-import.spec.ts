import { describe, it, expect } from 'vitest';
import { occupancyImportRows } from './occupancy-import';
const header = ['هتل', '', '', 'اتاق', '', '', '', '', 'ترکیب اقامت'];
const row = () => [
  'HOTEL',
  'CITY',
  'BB',
  'STANDARD',
  '3 AD + 1 CHD / 2 AD + 2 CHD',
  '2',
  '2',
  '4',
  '2 AD + 2 CHD',
  '3 تا کمتر از 7 سال / 0 تا کمتر از 12 سال',
  '2026-10-01',
  '2026-10-31',
  'EUR',
  '123.4567',
];
describe('Nora occupancy import rows', () => {
  it('reads original Nora raw child ranges and all explicit composition slots', () => {
    const r = row();
    r[9] = '3-6.99 / 0-11.99';
    expect(occupancyImportRows([header, r]).rows[0]?.childAges).toEqual([
      { min: 3, maxExclusive: 7 },
      { min: 0, maxExclusive: 12 },
    ]);
    r[6] = '3';
    r[8] = '2 AD + 3 CHD (3-6.99 / 0-11.99 / 0-11.99)';
    expect(occupancyImportRows([header, r]).rows[0]?.childAges).toHaveLength(3);
    r[8] = '2 AD + 3 CHD';
    expect(occupancyImportRows([header, r]).issues).toHaveLength(1);
    r[6] = '2';
    r[9] = '00-06,99 / 00-11,99';
    expect(occupancyImportRows([header, r]).rows[0]?.childAges).toEqual([
      { min: 0, maxExclusive: 7 },
      { min: 0, maxExclusive: 12 },
    ]);
  });
  it('normalizes Excel binary noise and preserves genuine source precision', () => {
    const r = row();
    r[13] = '515.1999999999999';
    expect(occupancyImportRows([header, r]).rows[0]?.amount).toBe('515.2');
    r[13] = '123.45678';
    expect(occupancyImportRows([header, r]).rows[0]?.amount).toBe('123.45678');
    r[13] = '123.4567890123456';
    expect(occupancyImportRows([header, r]).issues).toHaveLength(1);
  });
  it('preserves row counts, exact per-room price and exclusive child/date ceilings', () => {
    const parsed = occupancyImportRows([header, row()]);
    expect(parsed.issues).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({
      adults: 2,
      childAges: [
        { min: 3, maxExclusive: 7 },
        { min: 0, maxExclusive: 12 },
      ],
      endsOnExclusive: '2026-11-01',
      amount: '123.4567',
    });
  });
  it('excludes IN DBL PP regardless of its price', () => {
    const r = row();
    r[8] = 'IN DBL PP';
    expect(occupancyImportRows([header, r])).toEqual({
      rows: [],
      issues: [],
      excluded: 1,
    });
  });
  it.each([3, 5, 9, 10, 12, 13])(
    'reports bad column %s without importing that row',
    (col) => {
      const r = row();
      r[col] = '';
      const parsed = occupancyImportRows([header, r]);
      expect(parsed.rows).toHaveLength(0);
      expect(parsed.issues).toHaveLength(1);
    },
  );
  it('rejects a third child without its own range and invalid calendar dates', () => {
    const r = row();
    r[6] = '3';
    expect(occupancyImportRows([header, r]).issues).toHaveLength(1);
    r[6] = '2';
    r[10] = '2026-02-30';
    expect(occupancyImportRows([header, r]).issues).toHaveLength(1);
  });
});
