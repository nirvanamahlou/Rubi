import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { masterDataCatalog } from './catalog';
import { validateCurrencyForm, validateCurrencyQuote } from './currency-form';
import { getMasterDataFormFields } from './form-fields';
import { getReferenceFieldConfig } from './reference-fields';
import { validateMasterDataDraft } from './validation';

const currency = {
  code: 'USD',
  name: 'ارز آزمایشی',
  englishName: 'Test currency',
  symbol: '$',
  decimalDigits: '2',
};
const quote = {
  toCurrencyCode: 'IRR',
  buyRate: '1.25',
  source: 'Test source',
  observedAt: '2026-08-31T00:00:00Z',
};

describe('cleared Master Data selections', () => {
  it('keeps every required catalog selection invalid after clearing it', () => {
    let checked = 0;
    for (const definition of masterDataCatalog) {
      for (const field of getMasterDataFormFields(definition)) {
        if (!field.required) continue;
        if (
          field.type !== 'select' &&
          field.type !== 'datetime-local' &&
          field.key !== 'roleCodes' &&
          !getReferenceFieldConfig(definition.key, field.key)
        )
          continue;
        const result = validateMasterDataDraft(definition.key, {
          [field.key]: '',
        });
        expect(result.success).toBe(false);
        expect(
          result.errors[field.key],
          `${definition.key}.${field.key}`,
        ).toBeTruthy();
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(30);
  });

  it('requires a city to remain connected to its province', () => {
    const result = validateMasterDataDraft('cities', {
      name: 'شهر آزمایشی',
      englishName: 'Test city',
      countryId: '00000000-0000-4000-8000-000000000001',
      regionId: '',
    });
    expect(result.success).toBe(false);
    expect(result.errors.regionId).toBeTruthy();
    expect(result.values.countryId).toBe(
      '00000000-0000-4000-8000-000000000001',
    );
  });

  it('keeps multi-select clearing explicit, without changing other fields', () => {
    const result = validateMasterDataDraft('hotels', {
      name: 'هتل آزمایشی',
      englishName: 'Test hotel',
      cityId: '00000000-0000-4000-8000-000000000001',
      facilityIds: '',
      roomTypeIds: '',
      mealServiceIds: '',
    });
    expect(result.values).toMatchObject({
      facilityIds: '',
      roomTypeIds: '',
      mealServiceIds: '',
      name: 'هتل آزمایشی',
    });
  });

  it('requires reselecting a cleared currency status without adding it to metadata', () => {
    expect(validateCurrencyForm(currency, '').errors.status).toBeTruthy();
    expect(validateCurrencyForm(currency, '').success).toBe(false);
    for (const status of ['active', 'inactive']) {
      const result = validateCurrencyForm(currency, status);
      expect(result.success).toBe(true);
      expect(result.values).not.toHaveProperty('status');
    }
  });

  it('requires the quote currency without submitting removed date fields', () => {
    expect(
      validateCurrencyQuote('USD', { ...quote, toCurrencyCode: '' }).errors
        .toCurrencyCode,
    ).toBeTruthy();
    const result = validateCurrencyQuote('USD', {
      ...quote,
      observedAt: '',
      validFrom: '',
      validTo: '',
    });
    expect(result.success).toBe(true);
    expect(result.input).not.toHaveProperty('validFrom');
    expect(result.input).not.toHaveProperty('validTo');
    expect(result.input).not.toHaveProperty('observedAt');
  });

  it('wires the shared control into every form entry point and required references', () => {
    const read = (file: string) =>
      readFileSync(
        resolve(process.cwd(), 'src/modules/master-data/components', file),
        'utf8',
      );
    for (const file of [
      'master-data-live-form.tsx',
      'master-data-form.tsx',
      'master-data-currency-form.tsx',
      'hotel-import-panel.tsx',
    ]) {
      expect(read(file), file).toContain('<MasterDataClearableField');
    }
    const selector = read('master-data-reference-selector.tsx');
    expect(selector).not.toContain('config.optional || config.multiple');
    expect(selector.match(/<MasterDataClearSelection/g)).toHaveLength(2);
    expect(selector).toContain('label="نقش‌های انتخاب‌شده"');
  });
});
