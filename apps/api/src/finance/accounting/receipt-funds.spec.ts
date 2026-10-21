import { describe, expect, it } from 'vitest';
import { Prisma } from '@nora/database';
import {
  allocationCarryingAmount,
  reservedReceiptRefunds,
  type PostedReceiptBasis,
} from './receipt-funds.public';
import { receiptAllocationLines } from './receipt-allocation-journal';

const basis = {
  event: {
    id: 'basis',
    amount: new Prisma.Decimal('3'),
    currency: 'USD',
    requestId: 'source',
    trackingDate: '2026-10-18',
  },
  journal: { book: { baseCurrency: 'IRR' } },
  credit: {
    accountId: 'clearing',
    credit: new Prisma.Decimal('10'),
    currency: 'USD',
    rate: new Prisma.Decimal('3.3333'),
    fxSnapshotId: 'historical-rate',
    attributes: { trackingNumber: 'source', trackingDate: '2026-10-18' },
  },
} as unknown as PostedReceiptBasis;
describe('receipt carrying amount conservation', () => {
  it('keeps original basis and assigns the rounding remainder to the final distribution', async () => {
    const events: object[] = [];
    const tx = {
      financeAccountingEvent: { findMany: async () => events },
    } as unknown as Prisma.TransactionClient;
    const amounts: string[] = [];
    for (let i = 0; i < 3; i++) {
      const carrying = await allocationCarryingAmount(
        tx,
        basis,
        new Prisma.Decimal(1),
      );
      amounts.push(carrying.toString());
      events.push({
        amount: new Prisma.Decimal(1),
        carryingAmount: carrying,
        kind: 'RECEIPT_ALLOCATION',
      });
    }
    expect(amounts).toEqual(['3', '3', '4']);
    await expect(
      allocationCarryingAmount(tx, basis, new Prisma.Decimal(1)),
    ).rejects.toThrow();
  });
  it('reverses the exact historical carrying amount rather than recalculating a new rate', async () => {
    const tx = {
      financeAccountingEvent: {
        findFirst: async () => ({
          carryingAmount: new Prisma.Decimal(4),
          carryingCurrency: 'IRR',
        }),
      },
    } as unknown as Prisma.TransactionClient;
    expect(
      (
        await allocationCarryingAmount(
          tx,
          basis,
          new Prisma.Decimal(1),
          'original',
        )
      ).toString(),
    ).toBe('4');
    const event = {
      basisEventId: 'basis',
      carryingAmount: new Prisma.Decimal(4),
      carryingCurrency: 'IRR',
      currency: 'USD',
      amount: new Prisma.Decimal(1),
      trackingNumber: 'target',
      trackingDate: '2026-10-19',
      kind: 'RECEIPT_ALLOCATION_REVERSAL',
    } as unknown as Prisma.FinanceAccountingEventGetPayload<object>;
    const lines = receiptAllocationLines(event, basis);
    expect(lines.map((line) => line.attributes.trackingNumber)).toEqual([
      'target',
      'source',
    ]);
    expect(lines.map((line) => line.fxSnapshotId)).toEqual([
      'historical-rate',
      'historical-rate',
    ]);
    expect(lines.map((line) => line.accountId)).toEqual([
      'clearing',
      'clearing',
    ]);
  });
  it('reserves only unpaid refund balances and never reserves a completed payment twice', async () => {
    const tx = {
      financeOperationalRequest: {
        findMany: async () => [
          {
            amount: new Prisma.Decimal(100),
            revisions: [{ cumulativePaid: new Prisma.Decimal(40) }],
          },
          {
            amount: new Prisma.Decimal(50),
            revisions: [{ cumulativePaid: new Prisma.Decimal(50) }],
          },
        ],
      },
    } as unknown as Prisma.TransactionClient;
    expect((await reservedReceiptRefunds(tx, 'receipt')).toString()).toBe('60');
  });
});
