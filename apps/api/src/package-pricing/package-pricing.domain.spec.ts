import { describe, expect, it } from 'vitest';

import {
  calculatePackagePrice,
  calculatePassengerPrice,
  PackagePricingDomainError,
} from './package-pricing.domain';

describe('package pricing rule engine', () => {
  it('applies fixed, percent, fee, tax and profit rules in sequence', () => {
    const result = calculatePackagePrice('1000', 'USD', [
      {
        sequence: 2,
        title: 'کاهش',
        operation: 'SUBTRACT_PERCENT',
        value: '10',
      },
      { sequence: 1, title: 'افزایش', operation: 'ADD_FIXED', value: '100' },
      { sequence: 3, title: 'کارمزد', operation: 'FEE', value: '5' },
      { sequence: 4, title: 'مالیات', operation: 'TAX', value: '10' },
      { sequence: 5, title: 'سود', operation: 'PROFIT', value: '20' },
    ]);
    expect(result.finalAmount).toBe('1372.1400');
    expect(result.lines.map((line) => line.sequence)).toEqual([1, 2, 3, 4, 5]);
    expect(result.fee).toBe('49.5000');
    expect(result.tax).toBe('103.9500');
    expect(result.profit).toBe('228.6900');
  });

  it('supports multiply, divide and deterministic rounding', () => {
    const result = calculatePackagePrice('100', 'IRR', [
      { sequence: 1, title: 'ضریب', operation: 'MULTIPLY', value: '1.5' },
      { sequence: 2, title: 'تقسیم', operation: 'DIVIDE', value: '2' },
      { sequence: 3, title: 'گردکردن', operation: 'ROUND', value: '10' },
    ]);
    expect(result.finalAmount).toBe('80.0000');
  });

  it('rejects zero, negative results and zero divisor', () => {
    expect(() =>
      calculatePackagePrice('100', 'USD', [
        { sequence: 1, title: 'تقسیم', operation: 'DIVIDE', value: '0' },
      ]),
    ).toThrow(PackagePricingDomainError);
    expect(() =>
      calculatePackagePrice('100', 'USD', [
        {
          sequence: 1,
          title: 'کاهش',
          operation: 'SUBTRACT_FIXED',
          value: '100',
        },
      ]),
    ).toThrow('صفر یا منفی');
  });

  it('enforces minimum profit and minimum sale price', () => {
    expect(() =>
      calculatePackagePrice('100', 'USD', [
        {
          sequence: 1,
          title: 'حداقل سود',
          operation: 'MINIMUM_PROFIT',
          value: '20',
        },
        { sequence: 2, title: 'سود', operation: 'PROFIT', value: '10' },
      ]),
    ).toThrow('حداقل سود');
  });

  it('calculates passenger categories with Decimal multiplication', () => {
    expect(calculatePassengerPrice('123.4500', '0.5')).toBe('61.7250');
  });
});
