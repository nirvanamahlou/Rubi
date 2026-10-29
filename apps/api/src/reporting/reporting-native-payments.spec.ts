import { describe, expect, it, vi } from 'vitest';
import { Prisma, type DatabaseClient } from '@nora/database';
import { nativePaymentReport } from './reporting-native-payments';
import { readSalesPaymentReportingProjection } from '../sales/sales-payment-reporting.public';

const actor = {
  userId: 'user',
  branchIds: ['branch'],
  permissions: ['sales.contracts.read.own', 'sales.payments.read'],
};
const query = {
  filters: { fromUtc: '2026-10-01T00:00:00Z', toUtc: '2026-11-01T00:00:00Z' },
  page: 1,
  pageSize: 1,
  timezone: 'Asia/Tehran' as const,
};
function fixture() {
  const receipts = vi.fn().mockResolvedValue([
    {
      id: 'receipt',
      currencyCode: 'IRR',
      amount: new Prisma.Decimal(900),
      method: 'CASH',
      financeConfirmedAt: new Date('2026-10-05T00:00:00Z'),
      updatedAt: new Date('2026-10-05T00:00:00Z'),
    },
  ]);
  const refunds = vi.fn().mockResolvedValue([
    {
      id: 'refund',
      amount: new Prisma.Decimal(100),
      createdAt: new Date('2026-10-06T00:00:00Z'),
      payment: { currencyCode: 'IRR', method: 'CASH' },
    },
  ]);
  return {
    receipts,
    refunds,
    client: {
      salesContractPaymentEntry: { findMany: receipts },
      salesPaymentRefund: { findMany: refunds },
    } as unknown as DatabaseClient,
  };
}
describe('confirmed receipt/refund native projection', () => {
  it('applies exact confirmation/refund dates and own scope without expanding generic report permissions', async () => {
    const { client, receipts, refunds } = fixture();
    await readSalesPaymentReportingProjection(client, actor, query);
    expect(receipts.mock.calls[0]?.[0].where).toMatchObject({
      status: 'FINANCE_CONFIRMED',
      financeConfirmedAt: {
        not: null,
        gte: new Date(query.filters.fromUtc),
        lt: new Date(query.filters.toUtc),
      },
    });
    expect(
      refunds.mock.calls[0]?.[0].where.payment.contract.AND,
    ).toContainEqual({ branchId: { in: ['branch'] }, ownerUserId: 'user' });
    await expect(
      readSalesPaymentReportingProjection(
        client,
        { ...actor, permissions: ['reporting.read', 'reporting.finance.read'] },
        query,
      ),
    ).rejects.toThrow();
  });
  it('reconciles both event types before pagination and exports only real financial measures', async () => {
    const { client } = fixture();
    const preview = await nativePaymentReport(client, query, actor);
    const exported = await nativePaymentReport(client, query, actor, true);
    expect(preview.rows).toHaveLength(1);
    expect(exported.rows).toHaveLength(2);
    expect(preview.totalsByCurrency[0]).toMatchObject({
      salesAmount: '900',
      refundAmount: '100',
    });
    expect(exported.totalsByCurrency).toEqual(preview.totalsByCurrency);
    expect(exported.columns.map((column) => column.label)).toContain(
      'دریافت تأییدشده',
    );
    expect(exported.columns.map((column) => column.key)).not.toContain(
      'grossProfit',
    );
    expect(exported.filterSnapshot.grain).toBe('PAYMENT');
  });
  it('returns a truthful empty dataset when there are no confirmed receipts/refunds', async () => {
    const { client, receipts, refunds } = fixture();
    receipts.mockResolvedValue([]);
    refunds.mockResolvedValue([]);
    const result = await nativePaymentReport(client, query, actor);
    expect(result.total).toBe(0);
    expect(result.rows).toEqual([]);
    expect(result.totalsByCurrency).toEqual([]);
  });
});
