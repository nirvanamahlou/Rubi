import { describe, expect, it } from 'vitest';

import {
  compareMarketingDecimals,
  createMarketingMoney,
  normalizeMarketingDecimal,
  subtractMarketingMoney,
} from './marketing.decimal';

describe('marketing decimal values', () => {
  it('normalizes approved decimal strings without using floating point', () => {
    expect(normalizeMarketingDecimal('1250000.5000')).toBe('1250000.5');
    expect(compareMarketingDecimals('10.1000', '10.1')).toBe(0);
    expect(createMarketingMoney('0.2500', 'IRR')).toEqual({
      amount: '0.25',
      currencyCode: 'IRR',
    });
  });

  it.each(['-1', '1e6', '01', '1.12345', '999999999999999.1', 'NaN'])(
    'rejects invalid budget decimal %s',
    (value) => {
      expect(() => normalizeMarketingDecimal(value)).toThrow(
        'non-negative decimal',
      );
    },
  );

  it('calculates budget remaining only inside the same currency', () => {
    expect(
      subtractMarketingMoney(
        createMarketingMoney('100.25', 'IRR'),
        createMarketingMoney('25.1', 'IRR'),
      ),
    ).toEqual({ amount: '75.15', currencyCode: 'IRR' });
    expect(() =>
      subtractMarketingMoney(
        createMarketingMoney('10', 'USD'),
        createMarketingMoney('1', 'EUR'),
      ),
    ).toThrow('different currencies');
  });
});
