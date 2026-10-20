import { Prisma } from '@nora/database';
import { describe, expect, it, vi } from 'vitest';
import { reservedCustomerRefunds } from './receipt-refund-reservations.public';

describe('customer refund reservation projection', () => {
  it('uses unpaid balances once and keeps currency totals separate', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        refundReceiptId: 'a',
        currencyCode: 'USD',
        amount: new Prisma.Decimal(100),
        revisions: [{ cumulativePaid: new Prisma.Decimal(40) }],
      },
      {
        refundReceiptId: 'a',
        currencyCode: 'USD',
        amount: new Prisma.Decimal(20),
        revisions: [{ cumulativePaid: new Prisma.Decimal(20) }],
      },
      {
        refundReceiptId: 'b',
        currencyCode: 'IRR',
        amount: new Prisma.Decimal('0.0001'),
        revisions: [],
      },
    ]);
    const result = await reservedCustomerRefunds(
      {
        financeOperationalRequest: { findMany },
      } as unknown as Prisma.TransactionClient,
      [
        { id: 'a', currencyCode: 'USD' },
        { id: 'b', currencyCode: 'IRR' },
      ],
      'branch',
    );
    expect([...result]).toEqual([
      ['USD', '60'],
      ['IRR', '0.0001'],
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          branchId: 'branch',
          refundReceiptId: { in: ['a', 'b'] },
          status: { notIn: ['REJECTED', 'CANCELLED'] },
        },
      }),
    );
    expect(JSON.stringify(findMany.mock.calls[0])).not.toMatch(
      /party|description|documentId/,
    );
  });
  it('requires reconciliation for a mismatched currency and avoids querying an empty receipt set', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        refundReceiptId: 'a',
        currencyCode: 'IRR',
        amount: new Prisma.Decimal(1),
        revisions: [],
      },
    ]);
    const tx = {
      financeOperationalRequest: { findMany },
    } as unknown as Prisma.TransactionClient;
    expect([...(await reservedCustomerRefunds(tx, [], 'branch'))]).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
    await expect(
      reservedCustomerRefunds(tx, [{ id: 'a', currencyCode: 'USD' }], 'branch'),
    ).rejects.toThrow();
  });
});
