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
      client: {
        salesContract: {
          findMany,
          groupBy: vi.fn().mockResolvedValue([{ customerId: 'returning' }]),
        },
      },
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
    const groupBy = vi.fn().mockResolvedValue([]);
    const source = new SalesDashboardCustomers({
      client: { salesContract: { findMany, groupBy } },
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
    expect(groupBy).not.toHaveBeenCalled();
  });
  it('fails closed on purchase-history overflow and does not query unreferenced identities', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue(
        Array.from({ length: 10001 }, () => purchase('buyer', '2026-10-15')),
      );
    const groupBy = vi.fn().mockResolvedValue([]);
    const source = new SalesDashboardCustomers({
      client: { salesContract: { findMany, groupBy } },
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
    expect(groupBy).not.toHaveBeenCalled();
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
      client: {
        salesContract: {
          findMany,
          groupBy: vi.fn().mockResolvedValue([{ customerId: 'repeat' }]),
        },
      },
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
    const groupBy = vi.fn();
    const source = new SalesDashboardCustomers({
      client: { salesContract: { findMany, groupBy } },
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
    expect(groupBy).not.toHaveBeenCalled();
  });

  it('recognizes earlier company purchases outside the selected branch or agent without returning their records', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([
        purchase('earlier-other-branch', '2026-10-08'),
        purchase('earlier-other-agent', '2026-10-09'),
        purchase('first-ever-buyer', '2026-10-10'),
        purchase('historical-only-buyer', '2026-09-01'),
      ]);
    const groupBy = vi
      .fn()
      .mockResolvedValue([
        { customerId: 'earlier-other-branch' },
        { customerId: 'earlier-other-agent' },
      ]);
    const source = new SalesDashboardCustomers({
      client: { salesContract: { findMany, groupBy } },
    } as never);
    const result = await source.read({
      actor,
      from,
      to,
      branchId: 'a',
      filters: { branch: 'a' },
      dateBasis: 'effective',
    });

    expect(result.metrics['new-customers']?.observations).toEqual([
      { at: new Date('2026-10-10'), value: '1' },
    ]);
    expect(result.metrics['returning-customers']?.observations).toEqual([
      { at: new Date('2026-10-08'), value: '1' },
      { at: new Date('2026-10-09'), value: '1' },
    ]);
    // Current activity remains scoped; only the existence of prior company
    // purchases for these already authorized buyers crosses the scope.
    expect(findMany.mock.calls[0]![0].where.AND).toEqual(
      expect.arrayContaining([
        { branchId: { in: ['a'] }, ownerUserId: 'owner' },
        { branchId: 'a' },
      ]),
    );
    const prior = groupBy.mock.calls[0]![0];
    expect(prior.by).toEqual(['customerId']);
    expect(prior.where.customerId.in).toEqual([
      'earlier-other-branch',
      'earlier-other-agent',
      'first-ever-buyer',
    ]);
    expect(JSON.stringify(prior)).not.toMatch(/branchId|ownerUserId/);
    expect(JSON.stringify(result)).not.toMatch(
      /earlier-other-branch|earlier-other-agent|first-ever-buyer|historical-only-buyer/,
    );
  });

  it('requires both earlier confirmation and approved payment for prior-purchase classification, retaining cancelled history', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        customerId: 'delayed-payment',
        confirmedAt: new Date('2026-09-10'),
        payments: [{ financeConfirmedAt: new Date('2026-10-12') }],
      },
      purchase('cancelled-prior-purchase', '2026-10-13'),
    ]);
    const groupBy = vi
      .fn()
      .mockResolvedValue([{ customerId: 'cancelled-prior-purchase' }]);
    const source = new SalesDashboardCustomers({
      client: { salesContract: { findMany, groupBy } },
    } as never);
    const result = await source.read({
      actor,
      from,
      to,
      filters: {},
      dateBasis: 'effective',
    });

    expect(result.metrics['new-customers']?.observations).toEqual([
      { at: new Date('2026-10-12'), value: '1' },
    ]);
    expect(result.metrics['returning-customers']?.observations).toEqual([
      { at: new Date('2026-10-13'), value: '1' },
    ]);
    const prior = groupBy.mock.calls[0]![0].where;
    expect(prior).toMatchObject({
      confirmedAt: { not: null, lt: from },
      payments: {
        some: {
          status: 'FINANCE_CONFIRMED',
          financeConfirmedAt: { not: null, lt: from },
        },
      },
    });
    expect(prior.status.in).toContain('CANCELLED');
    expect(prior.status.in).not.toContain('DRAFT');
  });

  it('counts one contracting buyer across multiple contracts and receipts at the first effective eligible event', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        ...purchase('one-buyer', '2026-10-14'),
        payerCustomerId: 'different-payer',
        passengers: [{ customerId: 'passenger-one' }],
        payments: [
          { financeConfirmedAt: new Date('2026-10-19') },
          { financeConfirmedAt: new Date('2026-10-12') },
        ],
      },
      purchase('one-buyer', '2026-10-20'),
    ]);
    const groupBy = vi.fn().mockResolvedValue([]);
    const source = new SalesDashboardCustomers({
      client: { salesContract: { findMany, groupBy } },
    } as never);
    const result = await source.read({
      actor,
      from,
      to,
      filters: {},
      dateBasis: 'effective',
    });
    expect(result.metrics['new-customers']?.observations).toEqual([
      { at: new Date('2026-10-14'), value: '1' },
    ]);
    expect(result.metrics['returning-customers']?.observations).toEqual([]);
    expect(groupBy.mock.calls[0]![0].where.customerId.in).toEqual([
      'one-buyer',
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /one-buyer|different-payer|passenger-one/,
    );
  });

  it('includes the exact start and excludes the exact end of the supplied Tehran range', async () => {
    const tehranFrom = new Date('2026-09-30T20:30:00.000Z');
    const tehranTo = new Date('2026-10-31T20:30:00.000Z');
    const findMany = vi
      .fn()
      .mockResolvedValue([
        purchase('before-start', '2026-09-30T20:29:59.999Z'),
        purchase('at-start', tehranFrom.toISOString()),
        purchase('at-end', tehranTo.toISOString()),
        purchase('after-end', '2026-10-31T20:30:00.001Z'),
      ]);
    const groupBy = vi.fn().mockResolvedValue([]);
    const source = new SalesDashboardCustomers({
      client: { salesContract: { findMany, groupBy } },
    } as never);
    const result = await source.read({
      actor,
      from: tehranFrom,
      to: tehranTo,
      filters: {},
      dateBasis: 'effective',
    });
    expect(result.metrics['new-customers']?.observations).toEqual([
      { at: tehranFrom, value: '1' },
    ]);
    expect(groupBy.mock.calls[0]![0].where.customerId.in).toEqual(['at-start']);
    expect(groupBy.mock.calls[0]![0].where.confirmedAt.lt).toEqual(tehranFrom);
  });

  it.each([
    { label: 'empty history', rows: [] },
    {
      label: 'historical activity only',
      rows: [purchase('only-historical', '2026-09-01')],
    },
  ])(
    'does not inspect company-wide histories when no scoped current buyer exists: $label',
    async ({ rows }) => {
      const findMany = vi.fn().mockResolvedValue(rows);
      const groupBy = vi.fn();
      const source = new SalesDashboardCustomers({
        client: { salesContract: { findMany, groupBy } },
      } as never);
      const result = await source.read({
        actor,
        from,
        to,
        filters: {},
        dateBasis: 'effective',
      });
      expect(result.state).toBe('ready');
      expect(result.metrics['new-customers']?.observations).toEqual([]);
      expect(result.metrics['returning-customers']?.observations).toEqual([]);
      expect(groupBy).not.toHaveBeenCalled();
    },
  );

  it.each([
    'customers.read',
    'sales.payments.read',
    'sales.contracts.read.own',
  ])(
    'does not look up prior company purchases without %s',
    async (missingPermission) => {
      const findMany = vi.fn();
      const groupBy = vi.fn();
      const source = new SalesDashboardCustomers({
        client: { salesContract: { findMany, groupBy } },
      } as never);
      const result = await source.read({
        actor: {
          ...actor,
          permissions: actor.permissions.filter(
            (permission) => permission !== missingPermission,
          ),
        },
        from,
        to,
        filters: {},
        dateBasis: 'effective',
      });
      expect(result.state).toBe('forbidden');
      expect(result.metrics).toEqual({});
      expect(findMany).not.toHaveBeenCalled();
      expect(groupBy).not.toHaveBeenCalled();
    },
  );
});
