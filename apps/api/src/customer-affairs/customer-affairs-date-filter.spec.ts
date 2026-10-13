import { describe, expect, it, vi } from 'vitest';
import { createdDateFilter } from './customer-affairs-date-filter';
import { CustomerAffairsService } from './customer-affairs.service';

describe('created date filtering', () => {
  it('retains unfiltered and one-sided ranges', () => {
    expect(createdDateFilter({})).toEqual({});
    expect(createdDateFilter({ createdFrom: '2026-09-12T00:00:00Z' })).toEqual({
      createdAt: { gte: new Date('2026-09-12T00:00:00Z') },
    });
  });
  it('uses inclusive start and exclusive end', () => {
    expect(
      createdDateFilter({
        createdFrom: '2026-09-12T00:00:00+03:30',
        createdBefore: '2026-09-13T00:00:00+03:30',
      }),
    ).toEqual({
      createdAt: {
        gte: new Date('2026-09-11T20:30:00Z'),
        lt: new Date('2026-09-12T20:30:00Z'),
      },
    });
  });
  it('rejects timezone-less and inverted ranges', () => {
    expect(() => createdDateFilter({ createdFrom: '2026-09-12' })).toThrow();
    expect(() =>
      createdDateFilter({
        createdFrom: '2026-09-13T00:00:00Z',
        createdBefore: '2026-09-12T00:00:00Z',
      }),
    ).toThrow();
  });
  it.each(['listLeads', 'listTickets'] as const)(
    'passes the range and branch to %s before pagination',
    async (method) => {
      const list = vi.fn().mockResolvedValue({ data: [], total: 0 });
      const service = { repository: { [method]: list } };
      await (
        CustomerAffairsService.prototype[method] as (
          this: unknown,
          query: unknown,
          actor: unknown,
        ) => Promise<unknown>
      ).call(
        service as never,
        { createdFrom: '2026-09-12T00:00:00Z', page: 2, pageSize: 12 },
        { branchIds: ['branch'] } as never,
      );
      expect(list).toHaveBeenCalledWith(
        expect.objectContaining({
          branchId: { in: ['branch'] },
          createdAt: { gte: new Date('2026-09-12T00:00:00Z') },
        }),
        2,
        12,
      );
    },
  );
});
