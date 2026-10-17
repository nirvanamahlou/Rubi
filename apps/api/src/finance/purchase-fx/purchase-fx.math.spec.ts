import { describe, expect, it } from 'vitest';
import { purchaseFxComparison } from './purchase-fx.math';
describe('fixed purchase currency baseline', () => {
  it('reports ten million rial loss on a 915 euro purchase paid above its purchase-day baseline', () => {
    expect(
      purchaseFxComparison('915', '300000', [
        { paidAmount: '915', rialEquivalent: '284500000' },
      ]),
    ).toMatchObject({
      baselineEquivalent: '274500000',
      actualPaidEquivalent: '284500000',
      realizedGainLoss: '-10000000',
    });
  });
  it('compares paid portions only and accumulates partial payments with independent payment-day rates', () => {
    const first = purchaseFxComparison('1000', '100', [
      { paidAmount: '100', rialEquivalent: '12000' },
    ]);
    expect(first).toMatchObject({
      baselineEquivalent: '100000',
      paidBaselineEquivalent: '10000',
      realizedGainLoss: '-2000',
    });
    const total = purchaseFxComparison('1000', '100', [
      { paidAmount: '100', rialEquivalent: '12000' },
      { paidAmount: '200', rialEquivalent: '16000' },
    ]);
    expect(total.realizedGainLoss).toBe('2000');
  });
  it('retains unknown historical baseline and never claims zero profit on missing reference data', () => {
    expect(
      purchaseFxComparison('20', null, [
        { paidAmount: '5', rialEquivalent: '1000' },
      ]),
    ).toMatchObject({
      baselineEquivalent: null,
      paidBaselineEquivalent: null,
      realizedGainLoss: null,
      actualPaidEquivalent: '1000',
    });
  });
  it('uses exact decimal rates without binary floating point drift', () => {
    expect(
      purchaseFxComparison('0.3', '0.1', [
        { paidAmount: '0.1', rialEquivalent: '0.01' },
        { paidAmount: '0.2', rialEquivalent: '0.02' },
      ]).realizedGainLoss,
    ).toBe('0');
  });
});
