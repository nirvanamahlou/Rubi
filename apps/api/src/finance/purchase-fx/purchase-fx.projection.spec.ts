import { expect, it, vi } from 'vitest';
import { Prisma } from '@nora/database';
import { PurchaseFxService } from './purchase-fx.service';
import type { FinanceInboxItemV1 } from '@nora/contracts';
it('uses only branch-scoped payments through the displayed Finance revision, excluding a concurrent newer payment', async () => {
  const findSnapshots = vi.fn().mockResolvedValue([
    {
      reservationPurchaseId: 'purchase',
      ticketCostId: null,
      invoiceRevision: null,
      rateToIrr: new Prisma.Decimal('100'),
      source: 'MANUAL',
      baselineAt: new Date('2026-10-17T00:00:00Z'),
    },
  ]);
  const db = {
    client: {
      financePurchaseFxSnapshot: { findMany: findSnapshots },
      financeSupplierPaymentRevision: {
        findMany: vi.fn().mockResolvedValue([
          {
            purchaseId: 'purchase',
            version: 1,
            paidAmount: new Prisma.Decimal('100'),
            rialEquivalent: new Prisma.Decimal('12000'),
          },
          {
            purchaseId: 'purchase',
            version: 2,
            paidAmount: new Prisma.Decimal('200'),
            rialEquivalent: new Prisma.Decimal('26000'),
          },
        ]),
      },
      financeTicketPurchasePaymentRevision: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      financeProcurementInvoiceRevision: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  };
  const service = new PurchaseFxService(db as never, {} as never);
  const item = {
    id: 'reservations:purchase',
    kind: 'PAYMENT_REQUEST',
    sourceVersion: 1,
    createdAt: '2026-10-17T00:00:00Z',
    reservationPurchase: {
      lines: [
        {
          purchaseId: 'purchase',
          amount: '1000',
          currencyCode: 'EUR',
          financeVersion: 1,
        },
      ],
    },
  } as unknown as FinanceInboxItemV1;
  await service.enrich([item], { branchIds: ['branch'] } as never);
  expect(item.purchaseFx?.[0]).toMatchObject({
    actualPaidEquivalent: '12000',
    paidForeignAmount: '100',
    realizedGainLoss: '-2000',
  });
  expect(findSnapshots).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ branchId: { in: ['branch'] } }),
    }),
  );
  expect(
    db.client.financeSupplierPaymentRevision.findMany,
  ).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        purchase: { intake: { branchId: { in: ['branch'] } } },
      }),
    }),
  );
});

it('limits invoice evidence to displayed source and payment versions and skips unused readers', async () => {
  const findSnapshots = vi.fn().mockResolvedValue([]);
  const findInvoices = vi.fn().mockResolvedValue([]);
  const findReservations = vi.fn();
  const findTickets = vi.fn();
  const service = new PurchaseFxService(
    {
      client: {
        financePurchaseFxSnapshot: { findMany: findSnapshots },
        financeSupplierPaymentRevision: { findMany: findReservations },
        financeTicketPurchasePaymentRevision: { findMany: findTickets },
        financeProcurementInvoiceRevision: { findMany: findInvoices },
      },
    } as never,
    {} as never,
  );
  const item = {
    id: 'purchases:invoice:invoice:3',
    kind: 'PAYMENT_REQUEST',
    sourceReference: 'invoice',
    sourceVersion: 3,
    financeVersion: 7,
    createdAt: '2026-10-17T00:00:00Z',
    amount: { amount: '100', currencyCode: 'EUR' },
  } as FinanceInboxItemV1;
  const local = {
    ...item,
    id: 'purchases:invoice:local:1',
    sourceReference: 'local',
    amount: { amount: '100', currencyCode: 'IRR' },
  };
  await service.enrich([item, local], { branchIds: ['branch'] } as never);
  expect(findInvoices).toHaveBeenCalledExactlyOnceWith({
    where: {
      branchId: { in: ['branch'] },
      status: { in: ['PAID', 'PARTIALLY_PAID'] },
      paidAmount: { not: null },
      OR: [{ sourceId: 'invoice', sourceVersion: 3, version: { lte: 7 } }],
    },
    select: {
      sourceId: true,
      sourceVersion: true,
      version: true,
      paidAmount: true,
      rialEquivalent: true,
    },
  });
  expect(findSnapshots).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      where: {
        branchId: { in: ['branch'] },
        OR: [{ invoiceRevision: { sourceId: 'invoice', sourceVersion: 3 } }],
      },
    }),
  );
  expect(findReservations).not.toHaveBeenCalled();
  expect(findTickets).not.toHaveBeenCalled();
  expect(item.purchaseFx?.[0]?.referenceId).toBe('invoice');
  expect(local.purchaseFx).toBeUndefined();
});
