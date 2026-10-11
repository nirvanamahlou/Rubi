import { describe, expect, it } from 'vitest';
import { accountingTaxForms } from '@nora/contracts';
import {
  accountingTaxRoute,
  changeTaxValue,
  emptyTaxValues,
  thresholdProduct,
} from './accounting-tax-model';

describe('observed tax forms', () => {
  it('calculates thresholds without floating point rounding', () => {
    expect(thresholdProduct('9007199254740993', '5')).toBe(
      '450359962737049.65',
    );
    expect(thresholdProduct('۱۰۰', '۵')).toBe('5');
    expect(thresholdProduct('100', 'no')).toBe('');
  });
  it('clears stale disabled aggregation children', () => {
    const form = accountingTaxForms.find((item) => item.key === 'aggregation')!;
    const key = 'Buy_TaxPrayer_RealTaxPayerMergePattern';
    const values = {
      ...emptyTaxValues(form),
      [key]: true,
      [`${key}_setting_ByCounterPartMerge`]: true,
    };
    expect(
      changeTaxValue(form, values, key, false)[
        `${key}_setting_ByCounterPartMerge`
      ],
    ).toBe(false);
  });
  it('routes each list to its form without presenting financial returns as writable configuration', () => {
    expect(
      accountingTaxRoute('tax-accounting/vat/lists/taxpayer-identities')?.form
        .key,
    ).toBe('identity');
    expect(
      accountingTaxRoute('tax-accounting/vat/general-return')?.form.writable,
    ).toBe(false);
    expect(accountingTaxRoute('unknown')).toBeUndefined();
  });
  it('retains observed readonly totals and default report columns', () => {
    const general = accountingTaxForms.find((form) => form.key === 'general')!;
    expect(general.tables).toHaveLength(4);
    expect(
      general.fields
        .filter((field) => field.key.includes('decInput'))
        .every((field) => field.readOnly),
    ).toBe(true);
    const report = accountingTaxForms.find(
      (form) => form.key === 'return-lines',
    )!;
    expect(
      report.fields.find((field) => field.key === 'cboItemsDetail_Input')
        ?.options,
    ).toHaveLength(16);
  });
});
