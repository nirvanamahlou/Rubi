import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor, FinanceHistoryItemV1 } from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import { SalesRepository } from '../sales/sales.repository';
import { ReservationsPublicService as ReservationsBoundary } from '../reservations/reservations-public.service';
import type { SalesService } from '../sales/sales.service';
import type { ReservationsPublicService } from '../reservations/reservations-public.service';
import {
  historyAfter,
  historyDateRange,
  historyCursor,
  historyPage,
  readFinanceHistory,
} from './finance-history';
const actor = {
  permissions: ['finance.read'],
  branchIds: ['branch-a'],
} as unknown as AuthenticatedActor;
const id = (n: number) =>
  '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const occurredAt = '2026-09-28T10:00:00.000Z';
const item = (
  n: number,
  source: FinanceHistoryItemV1['source'] = 'TICKET',
): FinanceHistoryItemV1 => ({
  id: id(n),
  requestId: id(100),
  source,
  direction: 'PAYMENT',
  title: 'خرید بلیت',
  occurredAt,
  amount: '10.25',
  currencyCode: 'IRR',
  accountId: id(500),
  accountTitle: 'حساب',
  method: 'حواله',
  reference: null,
  installment: n,
  cumulativePaid: String(n * 10),
  remainingAmount: '0',
});
function dependencies() {
  const client = {
    financeTicketPurchasePaymentRevision: {
      findMany: vi
        .fn<(query: unknown) => Promise<unknown[]>>()
        .mockResolvedValue([]),
    },
    financeProcurementInvoiceRevision: {
      findMany: vi
        .fn<(query: unknown) => Promise<unknown[]>>()
        .mockResolvedValue([]),
    },
    financeSupplierPaymentRevision: {
      findMany: vi
        .fn<(query: unknown) => Promise<unknown[]>>()
        .mockResolvedValue([]),
    },
    financeSettlementAccount: {
      findMany: vi
        .fn<(query: unknown) => Promise<unknown[]>>()
        .mockResolvedValue([]),
    },
    financeOperationalRevision: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const sales = { financeReceiptHistory: vi.fn().mockResolvedValue([]) };
  const reservations = {
    financeHistoryPurchases: vi.fn().mockResolvedValue([]),
  };
  return {
    client,
    sales,
    reservations,
    read: (query = {}) =>
      readFinanceHistory(
        { client } as unknown as DatabaseService,
        sales as unknown as SalesService,
        reservations as unknown as ReservationsPublicService,
        query,
        actor,
      ),
  };
}
describe('persisted finance transaction history', () => {
  it('uses inclusive UTC days and rejects impossible or reversed date ranges', () => {
    expect(
      historyDateRange({ from: '2026-09-28', to: '2026-09-28' }, 'transferAt'),
    ).toEqual({
      transferAt: {
        gte: new Date('2026-09-28T00:00:00Z'),
        lt: new Date('2026-09-29T00:00:00Z'),
      },
    });
    for (const query of [
      { from: '2026-02-30' },
      { from: '2026-10-01', to: '2026-09-30' },
    ])
      expect(() => historyCursor(query)).toThrow(BadRequestException);
  });
  it('Sales public history reads only confirmed receipts in authorized branches', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new SalesRepository({
      client: { salesContractPaymentEntry: { findMany } },
    } as unknown as DatabaseService);
    await repository.confirmedFinancePayments(['branch-a'], {}, 26, id(1));
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: 'FINANCE_CONFIRMED',
          financeConfirmedAt: { not: null },
          contract: { branchId: { in: ['branch-a'] } },
          id: id(1),
        },
        take: 26,
      }),
    );
  });
  it('Reservations descriptors preserve replaced purchases and enforce branch scope', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const boundary = new ReservationsBoundary({
      client: { reservationServicePurchase: { findMany } },
    } as unknown as DatabaseService);
    await boundary.financeHistoryPurchases(['branch-a'], id(100));
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { intake: { branchId: { in: ['branch-a'] } }, id: id(100) },
      }),
    );
  });
  it('keeps each installment after full settlement and scopes ticket evidence to branches', async () => {
    const d = dependencies();
    d.client.financeTicketPurchasePaymentRevision.findMany.mockResolvedValue(
      [1, 2].map((n) => ({
        id: id(n),
        version: n,
        transferAt: new Date(occurredAt),
        paidAmount: { toString: () => '50.125' },
        cumulativePaid: { toString: () => String(n * 50.125) },
        remainingAmount: { toString: () => (n === 2 ? '0' : '50.125') },
        cost: { requestId: id(100), currencyCode: 'IRR' },
        accountId: id(500),
        account: { title: 'حساب' },
        paymentMethod: { name: 'حواله' },
        paymentReference: 'REF' + n,
      })) as never,
    );
    const result = await d.read();
    expect(result.items).toHaveLength(2);
    expect(result.items.map((r) => r.amount)).toEqual(['50.125', '50.125']);
    expect(result.items[0]?.remainingAmount).toBe('0');
    expect(
      d.client.financeTicketPurchasePaymentRevision.findMany.mock.calls[0]?.[0],
    ).toMatchObject({ where: { cost: { branchId: { in: ['branch-a'] } } } });
  });
  it('paginates equal-date installments deterministically across sources without dropping records', () => {
    const rows = Array.from({ length: 30 }, (_, n) => item(n + 1));
    rows.push(item(40, 'SALES'), item(41, 'RESERVATIONS'));
    const first = historyPage([...rows]);
    expect(first.items).toHaveLength(25);
    expect(first.nextCursor).not.toBeNull();
    const cursor = historyCursor({ cursor: first.nextCursor! })!;
    const remaining = rows.filter(
      (r) =>
        r.source < cursor.source ||
        (r.source === cursor.source && r.id < cursor.id),
    );
    const second = historyPage(remaining);
    expect(second.nextCursor).toBeNull();
    expect(
      new Set([...first.items, ...second.items].map((r) => r.source + r.id))
        .size,
    ).toBe(32);
    expect(historyAfter(cursor, 'TICKET', 'transferAt')).toMatchObject({
      OR: [
        { transferAt: { lt: new Date(occurredAt) } },
        { transferAt: new Date(occurredAt), id: { lt: cursor.id } },
      ],
    });
    expect(historyAfter(cursor, 'SALES', 'financeConfirmedAt')).toMatchObject({
      OR: [
        { financeConfirmedAt: { lt: new Date(occurredAt) } },
        { financeConfirmedAt: new Date(occurredAt) },
      ],
    });
  });
  it('rejects malformed cursors and unknown filters', () => {
    for (const query of [
      { cursor: 'bad' },
      { source: 'OTHER' },
      { requestId: 'bad' },
      { direction: 'OTHER' },
      {
        cursor: Buffer.from(
          JSON.stringify({ source: 'TICKET', date: 'bad', id: id(1) }),
        ).toString('base64url'),
      },
    ])
      expect(() => historyCursor(query as never)).toThrow(BadRequestException);
  });
  it('checks permission before any database or producer read', async () => {
    const d = dependencies();
    await expect(
      readFinanceHistory(
        { client: d.client } as unknown as DatabaseService,
        d.sales as unknown as SalesService,
        d.reservations as unknown as ReservationsPublicService,
        {},
        { ...actor, permissions: [] },
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(
      d.client.financeTicketPurchasePaymentRevision.findMany,
    ).not.toHaveBeenCalled();
    expect(d.sales.financeReceiptHistory).not.toHaveBeenCalled();
  });
  it('reads confirmed receipts through Sales and avoids payment producers for receipt-only filters', async () => {
    const d = dependencies();
    d.sales.financeReceiptHistory.mockResolvedValue([
      { ...item(1, 'SALES'), direction: 'RECEIPT' },
    ] as never);
    const result = await d.read({ direction: 'RECEIPT' } as never);
    expect(result.items[0]?.direction).toBe('RECEIPT');
    expect(d.sales.financeReceiptHistory).toHaveBeenCalledWith(
      actor,
      {},
      26,
      undefined,
    );
    expect(d.reservations.financeHistoryPurchases).not.toHaveBeenCalled();
    expect(
      d.client.financeTicketPurchasePaymentRevision.findMany,
    ).not.toHaveBeenCalled();
  });
  it('retains supplier payment evidence for purchases outside the pending inbox', async () => {
    const d = dependencies();
    d.reservations.financeHistoryPurchases.mockResolvedValue([
      {
        id: id(100),
        currencyCode: 'EUR',
        serviceTitleSnapshot: 'هتل',
        supplierNameSnapshot: 'کارگزار',
      },
    ] as never);
    d.client.financeSupplierPaymentRevision.findMany.mockResolvedValue([
      {
        id: id(1),
        purchaseId: id(100),
        transferAt: new Date(occurredAt),
        paidAmount: { toString: () => '25' },
        accountId: id(500),
        account: { title: 'ارزی' },
        paymentMethod: { name: 'حواله' },
        paymentReference: null,
        cumulativePaid: { toString: () => '100' },
        remainingAmount: { toString: () => '0' },
      },
    ] as never);
    const result = await d.read({
      source: 'RESERVATIONS',
      requestId: id(100),
    } as never);
    expect(result.items[0]?.currencyCode).toBe('EUR');
    expect(d.reservations.financeHistoryPurchases).toHaveBeenCalledWith(
      ['branch-a'],
      id(100),
    );
    expect(
      d.client.financeSupplierPaymentRevision.findMany.mock.calls[0]?.[0],
    ).toMatchObject({ where: { purchaseId: { in: [id(100)] } } });
  });
  it('fails visibly when a history producer fails, instead of reporting an empty history', async () => {
    const d = dependencies();
    d.sales.financeReceiptHistory.mockRejectedValue(
      new Error('database offline'),
    );
    await expect(d.read()).rejects.toThrow('database offline');
  });
});
