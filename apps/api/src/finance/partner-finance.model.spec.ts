import { describe, expect, it } from 'vitest';
import type {
  PartnerPaymentV1,
  PartnerPurchaseSourceV1,
} from '@nora/contracts';
import { partnerFinanceTotals } from './partner-finance.model';
const purchase = (
  id: string,
  amount: string,
  currencyCode = 'USD',
  current = true,
): PartnerPurchaseSourceV1 => ({
  id,
  amount,
  currencyCode,
  current,
  source: 'RESERVATIONS',
  sourceVersion: 1,
  title: 'Synthetic purchase',
  reference: id,
  createdAt: '2026-10-17T00:00:00.000Z',
  dueAt: null,
});
const payment = (
  id: string,
  purchaseId: string,
  amount: string,
  currencyCode = 'USD',
): PartnerPaymentV1 => ({
  id,
  purchaseId,
  amount,
  currencyCode,
  occurredAt: '2026-10-17T00:00:00.000Z',
  reference: null,
  method: null,
});
describe('partner operational payable totals', () => {
  it('subtracts our actual payments from counterpart debt without combining currencies', () => {
    expect(
      partnerFinanceTotals(
        [
          purchase('a', '0.1'),
          purchase('b', '0.2'),
          purchase('c', '500', 'IRR'),
        ],
        [payment('p', 'b', '0.05')],
      ),
    ).toEqual([
      { currencyCode: 'IRR', purchases: '500', paid: '0', balance: '500' },
      { currencyCode: 'USD', purchases: '0.3', paid: '0.05', balance: '0.25' },
    ]);
  });
  it('retains historical payments but does not double count a superseded obligation', () => {
    expect(
      partnerFinanceTotals(
        [purchase('old', '100', 'USD', false), purchase('new', '150')],
        [payment('p', 'old', '20')],
      )[0],
    ).toMatchObject({ purchases: '150', paid: '20', balance: '130' });
  });
  it('preserves prepaid negative balances instead of silently clamping to zero', () => {
    expect(
      partnerFinanceTotals(
        [purchase('old', '100', 'USD', false)],
        [payment('p', 'old', '20')],
      )[0]?.balance,
    ).toBe('-20');
  });
  it('handles large exact decimal values without floating point', () => {
    expect(
      partnerFinanceTotals(
        [purchase('a', '99999999999999999999.1234')],
        [payment('p', 'a', '0.0001')],
      )[0]?.balance,
    ).toBe('99999999999999999999.1233');
  });
  it('rejects missing purchase, mixed currencies and duplicate evidence', () => {
    expect(() =>
      partnerFinanceTotals([], [payment('p', 'missing', '1')]),
    ).toThrow();
    expect(() =>
      partnerFinanceTotals(
        [purchase('a', '1')],
        [payment('p', 'a', '1', 'IRR')],
      ),
    ).toThrow();
    expect(() =>
      partnerFinanceTotals(
        [purchase('a', '1')],
        [payment('p', 'a', '1'), payment('p', 'a', '1')],
      ),
    ).toThrow();
    expect(() =>
      partnerFinanceTotals([purchase('a', '1'), purchase('a', '1')], []),
    ).toThrow();
  });
  it.each(['NaN', 'Infinity', '-1'])(
    'rejects invalid principal %s',
    (value) => {
      expect(() => partnerFinanceTotals([purchase('a', value)], [])).toThrow();
    },
  );
});
