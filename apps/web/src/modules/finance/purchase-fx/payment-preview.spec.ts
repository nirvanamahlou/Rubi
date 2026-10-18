import { groupPurchaseFx } from './summary';
import { describe, expect, it } from 'vitest';
import { purchaseFxPaymentPreview } from './payment-preview';
describe('purchase FX payment preview', () => {
  it('compares only the entered partial foreign payment', () =>
    expect(purchaseFxPaymentPreview('100', '100', '120')).toEqual({
      baseline: '10000',
      actual: '12000',
      gainLoss: '-2000',
    }));
  it('keeps eight decimal rate precision', () =>
    expect(
      purchaseFxPaymentPreview('915', '300000.12345678', '300000.12345678')
        ?.gainLoss,
    ).toBe('0'));
  it('does not imply a zero result for missing or invalid rates', () => {
    expect(purchaseFxPaymentPreview('100', null, '120')).toBeNull();
    expect(purchaseFxPaymentPreview('100', '100', '')).toBeNull();
  });
});

it('groups same-currency service baselines without mixing dollars and euros or losing negative differences', () => {
  const base = {
    referenceId: 'a',
    currencyCode: 'EUR',
    foreignAmount: '100',
    rateToIrr: '100',
    source: 'MANUAL',
    baselineAt: '2026-10-17T00:00:00Z',
    baselineEquivalent: '10000',
    paidForeignAmount: '100',
    paidBaselineEquivalent: '10000',
    actualPaidEquivalent: '12000',
    realizedGainLoss: '-2000',
  };
  const grouped = groupPurchaseFx([
    base,
    { ...base, referenceId: 'b' },
    { ...base, referenceId: 'c', currencyCode: 'USD' },
  ]);
  expect(grouped).toHaveLength(2);
  expect(grouped[0]).toMatchObject({
    baselineEquivalent: '20000',
    actualPaidEquivalent: '24000',
    realizedGainLoss: '-4000',
    gainLossPerUnit: '-20.00000000',
  });
  expect(grouped[1]?.realizedGainLoss).toBe('-2000');
});
