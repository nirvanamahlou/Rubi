import { describe, expect, it, vi } from 'vitest';
import type { SalesContractListQuery } from '@nora/contracts';
import { SalesRepository } from './sales.repository';
import type { DatabaseService } from '../database/database.service';

describe('cancelled contracts in the Sales list', () => {
  it.each([
    {},
    { settlementStatus: 'UNPAID' },
    { search: '120161' },
    { createdFrom: '2026-10-01', createdTo: '2026-10-31' },
  ] satisfies SalesContractListQuery[])(
    'excludes cancellations before both pagination and total counting (%j)',
    async (query) => {
      const findMany = vi.fn().mockResolvedValue([]);
      const count = vi.fn().mockResolvedValue(0);
      const repository = new SalesRepository({
        client: { salesContract: { findMany, count } },
      } as unknown as DatabaseService);
      const scope = { branchId: { in: ['branch'] }, ownerUserId: 'owner' };
      await repository.list({ ...query, page: 2, pageSize: 10 }, scope);
      const args = findMany.mock.calls[0]![0];
      expect(args.where.AND[0]).toEqual(scope);
      expect(args.where.AND).toContainEqual({ status: { not: 'CANCELLED' } });
      expect(count).toHaveBeenCalledWith({ where: args.where });
      expect(args.skip).toBe(10);
      expect(args.take).toBe(10);
      await repository.list(query, scope, false, 2000);
      const exported = findMany.mock.calls[1]![0];
      expect(exported.where).toEqual(args.where);
      expect(exported.take).toBe(2001);
      expect(exported.skip).toBeUndefined();
    },
  );

  it('retains an explicit cancelled-history query with the same authorization scope', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const repository = new SalesRepository({
      client: { salesContract: { findMany, count } },
    } as unknown as DatabaseService);
    const scope = { branchId: { in: ['branch'] }, ownerUserId: 'owner' };
    await repository.list({ status: 'CANCELLED' }, scope);
    const args = findMany.mock.calls[0]![0];
    expect(args.where.AND[0]).toEqual(scope);
    expect(args.where.AND).toContainEqual({ status: 'CANCELLED' });
    expect(args.where.AND).not.toContainEqual({ status: { not: 'CANCELLED' } });
    expect(count).toHaveBeenCalledWith({ where: args.where });
  });
});
