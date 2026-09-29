import { describe, it, expect } from 'vitest';
import { validatePassengerPackagePrices } from './pricing';
import type { SalesPassengerInput, SalesPriceComponentInput } from './index';
const person = (amount: string): SalesPassengerInput => ({
  customerId: 'test',
  displayNameSnapshot: 'Test',
  birthDate: '1990-01-01',
  serviceClientKeys: ['flight'],
  agreedPrices: [{ amount, currencyCode: 'IRR' }],
});
const total: SalesPriceComponentInput[] = [
  {
    type: 'BASE',
    title: 'All services',
    currencyCode: 'IRR',
    amount: '9007199254740993.1234',
  },
];
describe('Individual agreed package totals', () => {
  it('reconciles exact decimals above the JS integer limit', () =>
    expect(() =>
      validatePassengerPackagePrices(
        [person('9007199254740990'), person('3.1234')],
        total,
        true,
      ),
    ).not.toThrow());
  it('rejects differences and missing rows', () => {
    expect(() =>
      validatePassengerPackagePrices([person('3')], total, true),
    ).toThrow();
    expect(() =>
      validatePassengerPackagePrices(
        [{ ...person('3'), agreedPrices: [] }],
        total,
        true,
      ),
    ).toThrow();
  });
  it('permits explicit zero for a free passenger, never infers a price', () =>
    expect(() =>
      validatePassengerPackagePrices(
        [person(total[0]!.amount), person('0')],
        total,
        true,
      ),
    ).not.toThrow());
  it('rejects negative, duplicate or unrelated currencies', () => {
    expect(() =>
      validatePassengerPackagePrices([person('-1')], total, true),
    ).toThrow();
    const p = person(total[0]!.amount);
    expect(() =>
      validatePassengerPackagePrices(
        [{ ...p, agreedPrices: [...p.agreedPrices!, ...p.agreedPrices!] }],
        total,
        true,
      ),
    ).toThrow();
    expect(() =>
      validatePassengerPackagePrices(
        [
          {
            ...p,
            agreedPrices: [
              { amount: p.agreedPrices![0]!.amount, currencyCode: 'USD' },
            ],
          },
        ],
        total,
        true,
      ),
    ).toThrow();
  });
  it('keeps legacy absent pricing readable but requires new form prices', () => {
    const legacy = person('1');
    delete legacy.agreedPrices;
    expect(() => validatePassengerPackagePrices([legacy], total)).not.toThrow();
    expect(() =>
      validatePassengerPackagePrices([legacy], total, true),
    ).toThrow();
  });
  it('nets discounts before reconciliation', () =>
    expect(() =>
      validatePassengerPackagePrices(
        [person('80')],
        [
          { ...total[0]!, amount: '100' },
          { ...total[0]!, type: 'DISCOUNT', amount: '20' },
        ],
        true,
      ),
    ).not.toThrow());
});
