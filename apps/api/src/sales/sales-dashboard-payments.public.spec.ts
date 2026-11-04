import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@nora/database';
import { SalesDashboardPayments } from './sales-dashboard-payments.public';
import type { DashboardSourceQuery } from '../common/dashboard-source';

const query: DashboardSourceQuery = {
  actor: {
    userId: 'synthetic-owner',
    branchIds: ['synthetic-branch'],
    permissions: ['sales.payments.read', 'sales.contracts.read.own'],
  },
  from: new Date('2026-10-01'),
  to: new Date('2026-11-01'),
  filters: {},
  dateBasis: 'effective',
};
function setup() {
  const receipts = vi.fn().mockResolvedValue([]);
  const refunds = vi.fn().mockResolvedValue([]);
  const source = new SalesDashboardPayments({
    client: {
      salesContractPaymentEntry: { findMany: receipts },
      salesPaymentRefund: { findMany: refunds },
    },
  } as never);
  return { source, receipts, refunds };
}
describe('confirmed dashboard receipts and refunds', () => {
  it('requires payment permission in addition to scoped Sales access', async () => {
    const { source, receipts } = setup();
    for (const permissions of [
      ['reporting.read'],
      ['sales.contracts.read.all'],
      ['sales.payments.read'],
    ])
      expect(
        (
          await source.read({
            ...query,
            actor: { ...query.actor, permissions },
          })
        ).state,
      ).toBe('forbidden');
    expect(receipts).not.toHaveBeenCalled();
  });
  it('uses Finance confirmation dates, exact decimals and separate currency without multiplying refund rows', async () => {
    const { source, receipts, refunds } = setup();
    receipts.mockResolvedValue([
      {
        amount: new Prisma.Decimal('123.4567'),
        currencyCode: 'USD',
        financeConfirmedAt: query.from,
      },
    ]);
    refunds.mockResolvedValue([
      {
        amount: new Prisma.Decimal('23.4567'),
        payment: { currencyCode: 'USD' },
        createdAt: query.from,
      },
    ]);
    const r = await source.read(query);
    expect(r.metrics.collected?.observations).toEqual([
      { at: query.from, value: '123.4567', currencyCode: 'USD' },
    ]);
    expect(r.metrics.refunded?.observations).toEqual([
      { at: query.from, value: '23.4567', currencyCode: 'USD' },
    ]);
    expect(receipts.mock.calls[0]?.[0].where).toMatchObject({
      status: 'FINANCE_CONFIRMED',
      financeConfirmedAt: { gte: query.from, lt: query.to, not: null },
      contract: {
        AND: [
          {
            ownerUserId: 'synthetic-owner',
            branchId: { in: ['synthetic-branch'] },
          },
        ],
      },
    });
    expect(refunds.mock.calls[0]?.[0].where.createdAt).toEqual({
      gte: query.from,
      lt: query.to,
    });
  });
  it('retains branch restriction and intersects an explicitly selected branch', async () => {
    const { source, receipts } = setup();
    await source.read({
      ...query,
      branchId: 'other-branch',
      filters: { currencyCode: 'EUR' },
    });
    expect(receipts.mock.calls[0]?.[0].where).toMatchObject({
      currencyCode: 'EUR',
      contract: {
        AND: [
          {
            branchId: { in: ['synthetic-branch'] },
            ownerUserId: 'synthetic-owner',
          },
          { branchId: 'other-branch' },
        ],
      },
    });
  });
  it('rejects unsupported filters rather than returning an unfiltered total', async () => {
    const { source, receipts } = setup();
    expect(
      (await source.read({ ...query, filters: { service: 'HOTEL' } })).state,
    ).toBe('unsupported');
    expect(receipts).not.toHaveBeenCalled();
  });
  it('distinguishes a genuinely empty source from a truncated source', async () => {
    const { source, receipts } = setup();
    expect((await source.read(query)).metrics.collected?.observations).toEqual(
      [],
    );
    receipts.mockResolvedValue(Array.from({ length: 10001 }, () => ({})));
    expect(await source.read(query)).toMatchObject({
      state: 'unavailable',
      reason: 'SOURCE_ROW_LIMIT',
      metrics: {},
    });
  });
});
