import type { Prisma } from '@nora/database';
import { describe, expect, it, vi } from 'vitest';
import {
  customerPurchaseSettlement,
  assertCustomerPurchaseCoverage,
  type CustomerPurchaseSettlement,
} from './customer-purchase-settlement.public';

const facts: CustomerPurchaseSettlement = {
  contractId: 'contract',
  version: 7,
  branchId: 'branch',
  cancelled: false,
  hasPriceBasis: true,
  receipts: [],
  balances: [{ currencyCode: 'USD', outstanding: '0' }],
};
describe('customer ticket purchase coverage', () => {
  it('checks each currency independently and deducts only the outstanding refund hold', () => {
    expect(() =>
      assertCustomerPurchaseCoverage(facts, new Map()),
    ).not.toThrow();
    expect(() =>
      assertCustomerPurchaseCoverage(facts, new Map([['USD', '0.0001']])),
    ).toThrow();
    const overpaid = {
      ...facts,
      balances: [{ currencyCode: 'USD', outstanding: '-20' }],
    };
    expect(() =>
      assertCustomerPurchaseCoverage(overpaid, new Map([['USD', '20']])),
    ).not.toThrow();
    expect(() =>
      assertCustomerPurchaseCoverage(overpaid, new Map([['USD', '20.0001']])),
    ).toThrow();
    expect(() =>
      assertCustomerPurchaseCoverage(
        {
          ...overpaid,
          balances: [
            ...overpaid.balances,
            { currencyCode: 'IRR', outstanding: '1' },
          ],
        },
        new Map(),
      ),
    ).toThrow();
  });
  it('does not lose a small shortage after a large overpayment or treat absent pricing as settled', () => {
    expect(() =>
      assertCustomerPurchaseCoverage(
        {
          ...facts,
          balances: [
            { currencyCode: 'USD', outstanding: '-9999999999999999.0001' },
          ],
        },
        new Map([['USD', '9999999999999999.0002']]),
      ),
    ).toThrow();
    expect(() =>
      assertCustomerPurchaseCoverage({ ...facts, cancelled: true }, new Map()),
    ).toThrow();
    expect(() =>
      assertCustomerPurchaseCoverage({ ...facts, balances: [] }, new Map()),
    ).toThrow();
    expect(() =>
      assertCustomerPurchaseCoverage(
        { ...facts, hasPriceBasis: false },
        new Map(),
      ),
    ).toThrow();
  });
  it('locks the authorized Sales row and projects live refunds and allocations without identity fields', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: 'contract',
      version: 7,
      branchId: 'branch',
      status: 'SENT_TO_RESERVATIONS',
      privateCustomerName: 'hidden-identity',
      priceComponents: [
        { type: 'BASE', title: 'Ticket', amount: '100', currencyCode: 'USD' },
      ],
      payments: [
        {
          id: 'confirmed',
          amount: '100',
          currencyCode: 'USD',
          status: 'FINANCE_CONFIRMED',
          refunds: [{ amount: '10' }],
          allocations: [{ amount: '40', reversalOfId: null }],
        },
        {
          id: 'scheduled',
          amount: '500',
          currencyCode: 'USD',
          status: 'SCHEDULED',
          refunds: [],
          allocations: [],
        },
      ],
      receiptAllocations: [
        { amount: '30', currencyCode: 'USD', reversalOfId: null },
        { amount: '5', currencyCode: 'USD', reversalOfId: 'original' },
      ],
    });
    const lock = vi.fn().mockResolvedValue([{ id: 'contract' }]);
    const tx = {
      $queryRaw: lock,
      salesContract: { findFirst },
    } as unknown as Prisma.TransactionClient;
    const result = await customerPurchaseSettlement(tx, 'contract', ['branch']);
    expect(result.balances).toEqual([
      { currencyCode: 'USD', outstanding: '25' },
    ]);
    expect(result.receipts).toEqual([{ id: 'confirmed', currencyCode: 'USD' }]);
    expect(lock.mock.invocationCallOrder[0]).toBeLessThan(
      findFirst.mock.invocationCallOrder[0]!,
    );
    expect(JSON.stringify(result)).not.toContain('hidden-identity');
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'contract', branchId: { in: ['branch'] } },
      }),
    );
    lock.mockResolvedValueOnce([]);
    await expect(
      customerPurchaseSettlement(tx, 'contract', ['other-branch']),
    ).rejects.toThrow();
    expect(findFirst).toHaveBeenCalledTimes(1);
  });
});
