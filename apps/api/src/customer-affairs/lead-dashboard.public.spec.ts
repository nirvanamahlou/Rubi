import { describe, expect, it, vi } from 'vitest';
import { LeadDashboardSource } from './lead-dashboard.public';
import type { DashboardSourceQuery } from '../common/dashboard-source';
const query: DashboardSourceQuery = {
  actor: {
    userId: 'reader',
    branchIds: ['branch-a'],
    permissions: ['customer_affairs.lead.read'],
  },
  from: new Date('2026-10-01'),
  to: new Date('2026-11-01'),
  filters: {},
  dateBasis: 'effective',
};
const row = (customerId: string | null, handoff?: string) => ({
  createdAt: new Date('2026-10-15'),
  customerId,
  handoffs: handoff ? [{ salesContractId: handoff }] : [],
});
describe('unconverted new-lead Dashboard source', () => {
  it('excludes successful canonical customer and accepted-handoff purchases, preserving unmatched leads', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([
        row('paid'),
        row('not-paid'),
        row(null, 'paid-contract'),
        row(null, 'draft-contract'),
        row(null),
      ]);
    const convertedLeadReferencesV1 = vi.fn().mockResolvedValue({
      state: 'ready',
      customerIds: ['paid'],
      contractIds: ['paid-contract'],
    });
    const source = new LeadDashboardSource(
      { client: { customerAffairsLead: { findMany } } } as never,
      { convertedLeadReferencesV1 } as never,
    );
    const result = await source.read(query);
    expect(result.metrics['new-leads']?.observations).toHaveLength(3);
    expect(convertedLeadReferencesV1).toHaveBeenCalledWith(query, {
      customerIds: ['paid', 'not-paid'],
      contractIds: ['paid-contract', 'draft-contract'],
    });
    expect(findMany.mock.calls[0]![0].where).toEqual({
      branchId: { in: ['branch-a'] },
      createdAt: { gte: query.from, lt: query.to },
    });
    expect(findMany.mock.calls[0]![0].select.handoffs.where).toEqual({
      status: 'ACCEPTED',
      salesContractId: { not: null },
    });
    expect(JSON.stringify(result)).not.toContain('paid-contract');
  });
  it('does not count possibly converted leads when Sales conversion access or source is unavailable', async () => {
    const findMany = vi.fn().mockResolvedValue([row('buyer')]);
    for (const state of ['forbidden', 'unavailable'] as const) {
      const source = new LeadDashboardSource(
        { client: { customerAffairsLead: { findMany } } } as never,
        {
          convertedLeadReferencesV1: vi
            .fn()
            .mockResolvedValue({ state, customerIds: [], contractIds: [] }),
        } as never,
      );
      expect(await source.read(query)).toMatchObject({ state, metrics: {} });
    }
  });
  it('returns a genuine zero for no authorized leads without consulting purchases, and bounds handoffs', async () => {
    const convertedLeadReferencesV1 = vi.fn();
    const findMany = vi.fn().mockResolvedValue([]);
    const source = new LeadDashboardSource(
      { client: { customerAffairsLead: { findMany } } } as never,
      { convertedLeadReferencesV1 } as never,
    );
    expect(
      (await source.read(query)).metrics['new-leads']?.observations,
    ).toEqual([]);
    findMany.mockResolvedValue([
      {
        ...row(null),
        handoffs: Array.from({ length: 101 }, () => ({
          salesContractId: 'contract',
        })),
      },
    ]);
    expect(await source.read(query)).toMatchObject({
      state: 'unavailable',
      reason: 'SOURCE_ROW_LIMIT',
      metrics: {},
    });
    expect(convertedLeadReferencesV1).not.toHaveBeenCalled();
  });
  it('enforces Lead permission before any lookup and refuses cohort-changing filters', async () => {
    const findMany = vi.fn();
    const source = new LeadDashboardSource(
      { client: { customerAffairsLead: { findMany } } } as never,
      {} as never,
    );
    expect(
      (
        await source.read({
          ...query,
          actor: { ...query.actor, permissions: [] },
        })
      ).state,
    ).toBe('forbidden');
    expect(
      (await source.read({ ...query, filters: { currencyCode: 'USD' } })).state,
    ).toBe('unsupported');
    expect(findMany).not.toHaveBeenCalled();
  });
});
