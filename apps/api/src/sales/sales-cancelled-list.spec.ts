import { describe, expect, it, vi } from 'vitest';
import type { SalesContractListQuery } from '@nora/contracts';
import { SalesRepository } from './sales.repository';
import type { DatabaseService } from '../database/database.service';

describe('cancelled contracts in the Sales list', () => {
  it.each([undefined, 2000])(
    'excludes latest Reservations cancellations before rows, count and export (limit=%s)',
    async (limit) => {
      const candidates = ['cancelled', 'reopened', 'active'].map((id) => ({
        id,
      }));
      const active = candidates.slice(1);
      const findMany = vi
        .fn()
        .mockResolvedValueOnce(candidates)
        .mockResolvedValueOnce(active);
      const count = vi.fn().mockResolvedValue(2);
      const intakes = vi.fn().mockResolvedValue([
        {
          contractId: 'cancelled',
          workflowRevisions: [
            { state: { supplierStatus: 'CANCELLED' }, createdAt: new Date() },
          ],
        },
        {
          contractId: 'reopened',
          workflowRevisions: [
            { state: { supplierStatus: 'NEW' }, createdAt: new Date() },
          ],
        },
        { contractId: 'active', workflowRevisions: [] },
      ]);
      const repository = new SalesRepository({
        client: {
          salesContract: { findMany, count },
          reservationIntake: { findMany: intakes },
        },
      } as unknown as DatabaseService);
      const scope = { branchId: { in: ['branch'] }, ownerUserId: 'owner' };
      const result = await repository.list(
        { search: '120', pageSize: 10 },
        scope,
        false,
        limit,
      );
      expect(findMany.mock.calls[0]![0]).toMatchObject({
        select: { id: true },
        where: { AND: expect.arrayContaining([scope]) },
      });
      expect(intakes).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { contractId: { in: candidates.map((row) => row.id) } },
          distinct: ['contractId'],
          orderBy: [{ contractId: 'asc' }, { contractVersion: 'desc' }],
        }),
      );
      const output = findMany.mock.calls[1]![0];
      expect(output.where.AND).toContainEqual({ id: { notIn: ['cancelled'] } });
      expect(output.where.AND[0]).toEqual(scope);
      expect(result.data).toEqual(active);
      expect(result.total).toBe(2);
      if (!limit) expect(count).toHaveBeenCalledWith({ where: output.where });
      else expect(output.take).toBe(limit + 1);
    },
  );
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
      const args = findMany.mock.calls[1]![0];
      expect(args.where.AND[0]).toEqual(scope);
      expect(args.where.AND).toContainEqual({ status: { not: 'CANCELLED' } });
      expect(count).toHaveBeenCalledWith({ where: args.where });
      expect(args.skip).toBe(10);
      expect(args.take).toBe(10);
      await repository.list(query, scope, false, 2000);
      const exported = findMany.mock.calls[3]![0];
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
