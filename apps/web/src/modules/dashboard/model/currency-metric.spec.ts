import { describe, expect, it } from 'vitest';
import { currencyMetricParts } from './currency-metric';

describe('KPI currency presentation', () => {
  it.each([
    ['100 USD', '100', '$'],
    ['-250 EUR', '-250', '€'],
    ['1200 IRR', '1200', '﷼'],
    ['50 AED', '50', 'د.إ'],
    ['CA$ 100', '100', 'CA$'],
    ['100 XYZ', '100', 'XYZ'],
    ['0', '0', ''],
  ])('preserves amount and currency for %s', (value, amount, symbol) => {
    expect(currencyMetricParts(value)).toEqual({ amount, symbol });
  });
});
