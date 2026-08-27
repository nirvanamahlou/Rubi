import { describe, expect, it } from 'vitest';

import { validateMasterDataDraft } from './validation';

describe('master data validation', () => {
  it('accepts a country draft without an internal code', () => {
    const result = validateMasterDataDraft('countries', {
      iso2Code: 'IR',
      name: 'ایران',
      englishName: 'Iran',
    });
    expect(result.success).toBe(true);
  });
  it('normalizes airport codes and validates IANA timezone and coordinates', () => {
    const valid = validateMasterDataDraft('airports', {
      name: 'مهرآباد',
      englishName: 'Mehrabad',
      countryId: '11111111-1111-4111-8111-111111111111',
      cityId: '22222222-2222-4222-8222-222222222222',
      iataCode: 'thr',
      icaoCode: 'oiii',
      ianaTimezone: 'Asia/Tehran',
      latitude: '35.6892',
      longitude: '51.3134',
    });
    expect(valid.success).toBe(true);
    expect(valid.values.iataCode).toBe('THR');
    expect(valid.values.icaoCode).toBe('OIII');

    const invalid = validateMasterDataDraft('airports', {
      name: 'آزمون',
      englishName: 'Test',
      countryId: 'country',
      cityId: 'city',
      iataCode: '12',
      icaoCode: 'abc',
      ianaTimezone: 'Invalid Zone',
      latitude: '91',
      longitude: '-181',
    });
    expect(invalid.success).toBe(false);
    expect(invalid.errors).toMatchObject({
      iataCode: expect.any(String),
      icaoCode: expect.any(String),
      ianaTimezone: expect.any(String),
      latitude: expect.any(String),
      longitude: expect.any(String),
    });
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
