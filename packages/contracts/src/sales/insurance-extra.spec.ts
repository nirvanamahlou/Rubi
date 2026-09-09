import { describe, expect, it } from 'vitest';
import {
  passengerOverSixty,
  insuranceExtraRials,
  addInsuranceExtra,
} from './insurance-extra';
describe('insurance age surcharge', () => {
  it('warns only above sixty at travel start', () => {
    expect(passengerOverSixty('1966-09-09', '2026-09-09')).toBe(false);
    expect(passengerOverSixty('1966-09-09', '2026-09-10')).toBe(true);
    expect(passengerOverSixty('1966-02-30', '2026-09-10')).toBe(false);
    expect(passengerOverSixty('', '2026-09-10')).toBe(false);
  });
  it('converts toman exactly and rejects invalid amounts', () => {
    expect(insuranceExtraRials('125000')).toBe('1250000');
    expect(insuranceExtraRials('999999999999999')).toBe('9999999999999990');
    for (const amount of ['-1', '1.5', 'NaN', '1e5'])
      expect(() => insuranceExtraRials(amount)).toThrow();
  });
  it('adds once to one passenger without changing other currencies or source', () => {
    const prices = [
      { currencyCode: 'IRR', amount: '1000' },
      { currencyCode: 'USD', amount: '2.25' },
    ];
    expect(addInsuranceExtra(prices, '10')).toEqual([
      { currencyCode: 'USD', amount: '2.25' },
      { currencyCode: 'IRR', amount: '1100' },
    ]);
    expect(addInsuranceExtra(prices, '10')).toEqual(
      addInsuranceExtra(prices, '10'),
    );
    expect(prices[0]?.amount).toBe('1000');
  });
});
