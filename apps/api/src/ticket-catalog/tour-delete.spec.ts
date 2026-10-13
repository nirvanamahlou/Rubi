import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { MasterTravelDirectory } from '../master-data/master-travel-directory';
import { TourPublicService } from './tour-public.service';

const id = '00000000-0000-4000-8000-000000000001';
const branch = id;
const otherBranch = '00000000-0000-4000-8000-000000000002';
const salesActor: AuthenticatedActor = {
  userId: id,
  sessionId: id,
  branchIds: [branch],
  permissions: ['ticket_catalog.tours.manage'],
};
function setup({
  lockCount = 1,
  departures = 0,
  exists = true,
}: { lockCount?: number; departures?: number; exists?: boolean } = {}) {
  const updateMany = vi.fn(async () => ({ count: lockCount }));
  const findFirst = vi.fn(async () => (exists ? { id } : null));
  const deleteMany = vi.fn(async () => ({ count: 1 }));
  const count = vi.fn(async () => departures);
  const tx = {
    tourPackage: { updateMany, findFirst, deleteMany },
    tourDeparture: { count },
  };
  const transaction = vi.fn(
    async (run: (client: typeof tx) => Promise<unknown>) => run(tx),
  );
  const database = { client: { $transaction: transaction } };
  const references = { assertTourReferences: vi.fn(async () => {}) };
  return {
    service: new TourPublicService(
      database as unknown as DatabaseService,
      references as unknown as MasterTravelDirectory,
    ),
    updateMany,
    findFirst,
    deleteMany,
    count,
    transaction,
  };
}

describe('tour definition deletion', () => {
  it('lets the Sales-specific permission delete an unreferenced tour with optimistic versioning', async () => {
    const { service, updateMany, deleteMany, count } = setup();
    await expect(
      service.deletePackage(id, { expectedVersion: 3 }, salesActor, branch),
    ).resolves.toEqual({ data: { id, deleted: true } });
    expect(updateMany).toHaveBeenCalledWith({
      where: { id, branchId: branch, version: 3 },
      data: { version: { increment: 0 } },
    });
    expect(count).toHaveBeenCalledWith({
      where: { packageId: id, branchId: branch },
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { id, branchId: branch, version: 3 },
    });
  });

  it('protects tours that already have departures and retains the package row', async () => {
    const { service, deleteMany } = setup({ departures: 1 });
    await expect(
      service.deletePackage(id, { expectedVersion: 1 }, salesActor, branch),
    ).rejects.toThrow('برای حفظ سوابق قابل حذف نیست');
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('rejects a stale editor before counting or deleting departures', async () => {
    const { service, findFirst, count, deleteMany } = setup({ lockCount: 0 });
    await expect(
      service.deletePackage(id, { expectedVersion: 1 }, salesActor, branch),
    ).rejects.toThrow('نسخه تور تغییر کرده است');
    expect(findFirst).toHaveBeenCalled();
    expect(count).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('reports a missing tour without attempting a delete', async () => {
    const { service, deleteMany } = setup({ lockCount: 0, exists: false });
    await expect(
      service.deletePackage(id, { expectedVersion: 1 }, salesActor, branch),
    ).rejects.toThrow('یافت نشد');
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('enforces branch scope, permission and a valid version', async () => {
    const { service, transaction } = setup();
    await expect(
      service.deletePackage(
        id,
        { expectedVersion: 1 },
        salesActor,
        otherBranch,
      ),
    ).rejects.toThrow('مجوز');
    await expect(
      service.deletePackage(
        id,
        { expectedVersion: 1 },
        { ...salesActor, permissions: ['ticket_catalog.read'] },
        branch,
      ),
    ).rejects.toThrow('مجوز');
    await expect(
      service.deletePackage(id, { expectedVersion: 0 }, salesActor, branch),
    ).rejects.toThrow('نسخه تور لازم است');
    expect(transaction).not.toHaveBeenCalled();
  });
});
