import { describe, expect, it } from 'vitest';

import { validateMasterDataDraft } from './validation';

describe('master data validation', () => {
  it('accepts a country draft without an internal code', () => {
    const result = validateMasterDataDraft('countries', {
      name: 'ایران',
      englishName: 'Iran',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid exchange-rate semantics', () => {
    const result = validateMasterDataDraft('exchange-rates', {
      fromCurrencyCode: 'USD',
      toCurrencyCode: 'USD',
      rate: '0',
      source: 'sample',
      observedAt: '2026-08-22T08:00',
    });
    expect(result.success).toBe(false);
    expect(result.errors.toCurrencyCode).toBeDefined();
    expect(result.errors.rate).toBeDefined();
  });

  it('accepts a bank draft without an internal code', () => {
    const result = validateMasterDataDraft('banks', {
      name: 'بانک',
      countryId: 'country_ir',
    });
    expect(result.success).toBe(true);
    expect(result.values.code).toBeUndefined();
  });
});
