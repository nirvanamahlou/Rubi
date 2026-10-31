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
