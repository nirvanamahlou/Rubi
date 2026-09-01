import type { MasterDataRecord } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';

import {
  currencyFormValues,
  persistCurrencyForm,
  validateCurrencyForm,
  validateCurrencyQuote,
} from './currency-form';

const values = {
  code: 'usd',
  name: 'ارز آزمایشی',
  englishName: 'Test currency',
  symbol: '$',
  decimalDigits: '2',
};
const record: MasterDataRecord = {
  id: 'currency-test',
  resource: 'currencies',
  code: 'USD',
  name: 'ارز آزمایشی',
  status: 'active',
  version: 1,
  attributes: {
    englishName: 'Test currency',
    symbol: '$',
    decimalDigits: 2,
    displayPolicy: 'SYMBOL_BEFORE',
  },
  createdAt: '2026-08-31T00:00:00Z',
  updatedAt: '2026-08-31T00:00:00Z',
};
const quote = {
  toCurrencyCode: 'irr',
  buyRate: '1.1234567890',
  sellRate: '2.1234567890',
  source: 'Test source',
  observedAt: '2026-08-31T10:00:00+03:30',
};

describe('currency form', () => {
  it('contains currency metadata without display policy or financial rate fields', () => {
    expect(currencyFormValues(record)).toEqual({ ...values, code: 'USD' });
    expect(currencyFormValues().decimalDigits).toBe('2');
    const result = validateCurrencyForm({
      ...values,
      displayPolicy: 'CODE_AFTER',
      buyRate: '100',
      isBase: 'true',
    });
    expect(result.success).toBe(true);
    expect(result.values).toEqual({ ...values, code: 'USD' });
  });
  it.each(['', '-1', '1.5', '7'])(
    'rejects invalid precision %s',
    (decimalDigits) => {
      expect(
        validateCurrencyForm({ ...values, decimalDigits }).errors.decimalDigits,
      ).toBeDefined();
    },
  );
  it('accepts zero decimal places and rejects overlong names and symbols', () => {
    expect(
      validateCurrencyForm({ ...values, decimalDigits: '0' }).success,
    ).toBe(true);
    expect(
      validateCurrencyForm({
        ...values,
        name: 'x'.repeat(161),
        symbol: 'x'.repeat(17),
      }).errors,
    ).toMatchObject({ name: expect.any(String), symbol: expect.any(String) });
  });
  it('preserves both decimal strings, converts UTC and never submits maker/status/base fields', () => {
    const result = validateCurrencyQuote('USD', {
      ...quote,
      createdByUserId: 'other',
      status: 'APPROVED',
      isAuthoritative: 'true',
      isBase: 'true',
    });
    expect(result.success).toBe(true);
    expect(result.input).toEqual({
      fromCurrencyCode: 'USD',
      toCurrencyCode: 'IRR',
      buyRate: quote.buyRate,
      sellRate: quote.sellRate,
      source: quote.source,
      observedAt: '2026-08-31T06:30:00.000Z',
    });
  });
  it.each(['0', '-1', '1e3', '1.12345678901', '100000000000000'])(
    'rejects invalid rate %s',
    (buyRate) => {
      expect(
        validateCurrencyQuote('USD', { ...quote, buyRate }).errors.buyRate,
      ).toBeDefined();
    },
  );
  it('requires at least one side, different currencies, source and a valid time window', () => {
    expect(
      validateCurrencyQuote('USD', { ...quote, buyRate: '', sellRate: '' })
        .success,
    ).toBe(false);
    expect(
      validateCurrencyQuote('USD', { ...quote, buyRate: '' }).success,
    ).toBe(true);
    expect(
      validateCurrencyQuote('USD', {
        ...quote,
        toCurrencyCode: 'USD',
        source: '',
        observedAt: 'invalid',
      }).errors,
    ).toMatchObject({
      toCurrencyCode: expect.any(String),
      source: expect.any(String),
      observedAt: expect.any(String),
    });
    expect(
      validateCurrencyQuote('USD', {
        ...quote,
        validTo: '2026-08-30T00:00:00Z',
      }).errors.validTo,
    ).toBeDefined();
  });
  it('retains a created record and its version when the separate status permission fails', async () => {
    const api = {
      create: vi.fn().mockResolvedValue({ data: record }),
      update: vi.fn(),
      setStatus: vi.fn().mockRejectedValue(new Error('Forbidden')),
    };
    const onSaved = vi.fn();
    await expect(
      persistCurrencyForm(api, { values, status: 'inactive', onSaved }),
    ).rejects.toThrow('مشخصات ارز ذخیره شد');
    expect(onSaved).toHaveBeenCalledWith(record);
    expect(api.setStatus).toHaveBeenCalledWith(
      'currencies',
      record.id,
      'inactive',
      1,
    );
    api.update.mockResolvedValue({ data: { ...record, version: 2 } });
    api.setStatus.mockResolvedValue({
      data: { ...record, status: 'inactive', version: 3 },
    });
    await persistCurrencyForm(api, {
      record,
      values,
      status: 'inactive',
      onSaved,
    });
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.setStatus).toHaveBeenLastCalledWith(
      'currencies',
      record.id,
      'inactive',
      2,
    );
  });
});
