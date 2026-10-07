import { describe, expect, it } from 'vitest';
import * as v from './accounting.validation';
describe('accounting decimal and business dates', () => {
  it('preserves 18 fractional FX digits', () =>
    expect(v.decimal('1.123456789012345678')).toBe('1.123456789012345678'));
  it('accepts only decimals exactly representable at a requested scale', () => {
    expect(v.decimalAtScale('1.12345678', 8)).toBe('1.12345678');
    expect(v.decimalAtScale('0.00000001', 8)).toBe('0.00000001');
    expect(v.decimalAtScale('1.123456780000', 8)).toBe('1.12345678');
    expect(() => v.decimalAtScale('1.123456789', 8)).toThrow();
    expect(() => v.decimalAtScale('0.000000001', 8)).toThrow();
  });
  it('rejects overflow, negative, exponent and numeric money', () => {
    for (const value of ['100000000000000000000', '-1', '1e8', 123])
      expect(() => v.decimal(value)).toThrow();
  });
  it('sums money exactly beyond safe integers', () =>
    expect(
      v.totals([
        { debit: '9007199254740993.1', credit: '0' },
        { debit: '0.2', credit: '9007199254740993.3' },
      ]).balanced,
    ).toBe(true));
  it('rejects zero journals', () =>
    expect(v.totals([{ debit: '0', credit: '0' }]).balanced).toBe(false));
  it('rejects calendar rollover', () => {
    expect(() => v.date('2026-02-30')).toThrow();
    expect(v.date('2028-02-29')).toBe('2028-02-29');
  });
  it('allows genuinely incomplete drafts', () =>
    expect(
      v.lines([{ description: '', debit: '0', credit: '0' }])[0]?.accountId,
    ).toBeNull());
  it('accepts only the bounded journal presentation attributes', () => {
    expect(
      v.journalAttributes({
        auxiliaryNumber: ' 12 ',
        descriptionEn: ' English description ',
      }),
    ).toEqual({
      auxiliaryNumber: '12',
      descriptionEn: 'English description',
    });
    expect(() => v.journalAttributes({ dailyNumber: '44' })).toThrow(
      'ویژگی ناشناخته سند حسابداری مجاز نیست.',
    );
  });
  it('validates tracking and second-language line attributes', () => {
    expect(
      v.journalLineAttributes({
        descriptionEn: 'Line',
        trackingNumber: 'TRACE-1',
        trackingDate: '2026-10-07',
      }),
    ).toEqual({
      descriptionEn: 'Line',
      trackingNumber: 'TRACE-1',
      trackingDate: '2026-10-07',
    });
    expect(() =>
      v.journalLineAttributes({ trackingDate: '2026-02-30' }),
    ).toThrow();
    expect(() => v.journalLineAttributes({ taxAmount: '1' })).toThrow(
      'ویژگی ناشناخته ردیف سند حسابداری مجاز نیست.',
    );
  });
});
