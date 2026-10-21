import { describe, expect, it } from 'vitest';
import {
  incomingAllocationPayments,
  netReceiptAllocations,
  netReceiptAmount,
} from './sales-financial-settlement';

describe('receipt allocation exact settlement sums', () => {
  it('preserves four decimal places after many large historical reversals in either row order', () => {
    const allocated = Array.from({ length: 100 }, () => ({
      amount: '9999999999999999.0001',
      reversalOfId: null,
      currencyCode: 'USD',
    }));
    const reversed = Array.from({ length: 99 }, () => ({
      amount: '9999999999999999.0001',
      reversalOfId: 'original',
      currencyCode: 'USD',
    }));
    for (const rows of [
      [...allocated, ...reversed],
      [...reversed, ...allocated],
    ]) {
      expect(netReceiptAllocations(rows).toString()).toBe(
        '9999999999999999.0001',
      );
      expect(incomingAllocationPayments(rows)).toEqual([
        {
          currencyCode: 'USD',
          amount: '9999999999999999.0001',
          status: 'FINANCE_CONFIRMED',
        },
      ]);
      expect(
        netReceiptAmount({
          amount: '9999999999999999.0002',
          allocations: rows,
        }).toString(),
      ).toBe('0.0001');
    }
  });
});
