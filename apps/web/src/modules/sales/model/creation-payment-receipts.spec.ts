import { describe, it, expect } from 'vitest';
import type { SalesContractDetail, SalesPaymentInput } from '@nora/contracts';
import { createdPaymentIds } from './creation-payment-receipts';
const payment: SalesPaymentInput = {
  amount: '100',
  currencyCode: 'IRR',
  dueAt: '2026-10-01T00:00:00.000Z',
  method: 'CASH',
};
const saved = (id: string, p = payment) =>
  ({ ...p, id }) as SalesContractDetail['payments'][number];
describe('creation receipt payment identity', () => {
  it('matches reordered saved payments with decimal-normalized amounts', () => {
    const second = { ...payment, amount: '200', paymentReference: 'two' };
    expect(
      createdPaymentIds(
        [payment, second],
        [
          saved('two', second),
          saved('one', { ...payment, amount: '100.0000' }),
        ],
      ),
    ).toEqual(['one', 'two']);
  });
  it('consumes identical rows once each and refuses an unmatched source', () => {
    expect(
      createdPaymentIds([payment, payment], [saved('a'), saved('b')]),
    ).toEqual(['a', 'b']);
    expect(() => createdPaymentIds([payment, payment], [saved('a')])).toThrow();
    expect(() =>
      createdPaymentIds(
        [payment],
        [saved('other', { ...payment, currencyCode: 'USD' })],
      ),
    ).toThrow();
  });
});
