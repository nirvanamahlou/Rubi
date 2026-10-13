import { describe, expect, it } from 'vitest';

import {
  DecimalValue,
  FinanceDomainError,
  Money,
  proposedCurrencyPolicies,
} from './finance.money';

describe('finance Money and rounding', () => {
  it('keeps exact decimal arithmetic without floating number math', () => {
    const total = Money.from({
      amount: '9007199254740993.10',
      currencyCode: 'USD',
    }).add(Money.from({ amount: '0.20', currencyCode: 'USD' }));
    expect(total.toContract()).toEqual({
      amount: '9007199254740993.3',
      currencyCode: 'USD',
    });
  });

  it('rejects exponent notation and cross-currency arithmetic', () => {
    expect(() =>
      Money.from({ amount: '1e6', currencyCode: 'IRR' }),
    ).toThrowError(FinanceDomainError);
    expect(() =>
      Money.from({ amount: '1', currencyCode: 'USD' }).add(
        Money.from({ amount: '1', currencyCode: 'EUR' }),
      ),
    ).toThrowError(/same currency/);
  });

  it('supports HALF_UP, HALF_EVEN and DOWN deterministically', () => {
    expect(DecimalValue.parse('1.005').round(2, 'HALF_UP').toString()).toBe(
      '1.01',
    );
    expect(DecimalValue.parse('1.005').round(2, 'HALF_EVEN').toString()).toBe(
      '1',
    );
    expect(DecimalValue.parse('1.019').round(2, 'DOWN').toString()).toBe(
      '1.01',
    );
    expect(DecimalValue.parse('-1.005').round(2, 'HALF_UP').toString()).toBe(
      '-1.01',
    );
  });

  it('uses proposed per-currency policy while keeping toman presentation-only', () => {
    expect(
      Money.from({ amount: '10.5', currencyCode: 'IRR' }).round().toContract(),
    ).toEqual({ amount: '11', currencyCode: 'IRR' });
    expect(proposedCurrencyPolicies.IRR!.displayUnit).toBe(
      'TOMAN_PRESENTATION',
    );
    expect(proposedCurrencyPolicies.IRR!.currencyCode).toBe('IRR');
  });

  it('converts with a decimal rate snapshot and quote-currency policy', () => {
    const converted = Money.from({
      amount: '100000',
      currencyCode: 'IRR',
    }).convert({ quoteCurrencyCode: 'USD', rate: '0.00002' });
    expect(converted.toContract()).toEqual({
      amount: '2',
      currencyCode: 'USD',
    });
  });
});
