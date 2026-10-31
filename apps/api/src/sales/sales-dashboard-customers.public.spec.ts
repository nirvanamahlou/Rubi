import { describe, expect, it, vi } from 'vitest';
import { SalesDashboardCustomers } from './sales-dashboard-customers.public';
const from = new Date('2026-10-01'),
  to = new Date('2026-11-01');
const actor = {
  userId: 'owner',
  branchIds: ['a'],
  permissions: [
    'customers.read',
    'sales.payments.read',
    'sales.contracts.read.own',
  ],
};
const purchase = (customerId: string, when: string) => ({
  customerId,
  confirmedAt: new Date(when),
  payments: [{ financeConfirmedAt: new Date(when) }],
});
describe('Sales paid customer cohorts', () => {
  it('uses the later confirmation/receipt event and does not classify repeat purchases as first purchases', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'late-finance',
        customerId: 'new',
        confirmedAt: new Date('2026-09-20'),
        payments: [{ financeConfirmedAt: new Date('2026-10-11') }],
      },
      { id: 'repeat-old', ...purchase('returning', '2026-09-01') },
      { id: 'repeat-new', ...purchase('returning', '2026-10-15') },
    ]);
    const source = new SalesDashboardCustomers({
      client: { salesContract: { findMany } },
    } as never);
    const result = await source.read({
      actor,
      from,
      to,
      filters: {},
      dateBasis: 'effective',
    });
    expect(result.metrics['new-customers']?.observations).toEqual([
      { at: new Date('2026-10-11'), value: '1' },
    ]);
    expect(result.metrics['returning-customers']?.observations).toHaveLength(1);
    const conditions = findMany.mock.calls[0]![0].where.AND;
    expect(conditions.at(-1)).toMatchObject({
      confirmedAt: { not: null, lt: to },
      payments: { some: { financeConfirmedAt: { not: null, lt: to } } },
    });
  });
  it('matches only canonical lead references within own Sales scope and historical paid-confirmed eligibility', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([
        { id: 'paid-contract', ...purchase('buyer', '2026-10-15') },
      ]);
    const source = new SalesDashboardCustomers({
      client: { salesContract: { findMany } },
    } as never);
    const q = { actor, from, to, filters: {}, dateBasis: 'effective' };
    expect(
      await source.convertedLeadReferencesV1(q, {
        customerIds: ['buyer'],
        contractIds: ['accepted'],
      }),
    ).toEqual({
      state: 'ready',
      customerIds: ['buyer'],
      contractIds: ['paid-contract'],
    });
    const conditions = findMany.mock.calls[0]![0].where.AND;
    expect(conditions[0]).toEqual({
      branchId: { in: ['a'] },
      ownerUserId: 'owner',
    });
    expect(conditions[1]).toEqual({
      OR: [{ customerId: { in: ['buyer'] } }, { id: { in: ['accepted'] } }],
    });
    expect(conditions[2]).toMatchObject({
      status: { in: expect.arrayContaining(['CANCELLED']) },
      confirmedAt: { not: null, lt: to },
      payments: {
        some: {
          status: 'FINANCE_CONFIRMED',
          financeConfirmedAt: { not: null, lt: to },
        },
      },
    });
    findMany.mockClear();
    expect(
      (
        await source.convertedLeadReferencesV1(
          { ...q, actor: { ...actor, permissions: ['customers.read'] } },
          { customerIds: ['buyer'], contractIds: [] },
        )
      ).state,
    ).toBe('forbidden');
    expect(findMany).not.toHaveBeenCalled();
  });
  it('fails closed on purchase-history overflow and does not query unreferenced identities', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue(
        Array.from({ length: 10001 }, () => purchase('buyer', '2026-10-15')),
      );
    const source = new SalesDashboardCustomers({
      client: { salesContract: { findMany } },
    } as never);
    const q = { actor, from, to, filters: {}, dateBasis: 'effective' };
    expect((await source.read(q)).state).toBe('unavailable');
    findMany.mockClear();
    expect(
      await source.convertedLeadReferencesV1(q, {
        customerIds: [],
        contractIds: [],
      }),
    ).toEqual({ state: 'ready', customerIds: [], contractIds: [] });
    expect(findMany).not.toHaveBeenCalled();
  });
  it('separates first purchase from repeat purchase, distinct across multiple contracts', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([
        purchase('repeat', '2026-09-01'),
        purchase('repeat', '2026-10-15'),
        purchase('new', '2026-10-11'),
        purchase('new', '2026-10-16'),
        purchase('old', '2026-08-01'),
      ]);
    const source = new SalesDashboardCustomers({
      client: { salesContract: { findMany } },
    } as never);
    const result = await source.read({
      actor,
      from,
      to,
      filters: {},
      dateBasis: 'effective',
    });
    expect(result.metrics['new-customers']?.observations).toEqual([
      { at: new Date('2026-10-11'), value: '1' },
    ]);
    expect(result.metrics['returning-customers']?.observations).toHaveLength(1);
    expect(findMany.mock.calls[0]?.[0].where.AND[0]).toEqual({
      branchId: { in: ['a'] },
      ownerUserId: 'owner',
    });
    expect(JSON.stringify(result)).not.toContain('repeat');
  });
  it('fails closed for missing payment access and cohort-altering filters', async () => {
    const findMany = vi.fn();
    const source = new SalesDashboardCustomers({
      client: { salesContract: { findMany } },
    } as never);
    expect(
      (
        await source.read({
          actor: { ...actor, permissions: ['customers.read'] },
          from,
          to,
          filters: {},
          dateBasis: 'effective',
        })
      ).state,
    ).toBe('forbidden');
    expect(
      (
        await source.read({
          actor,
          from,
          to,
          filters: { currencyCode: 'USD' },
          dateBasis: 'effective',
        })
      ).state,
    ).toBe('unsupported');
    expect(findMany).not.toHaveBeenCalled();
  });
});
