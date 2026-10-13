import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { MasterTravelDirectory } from '../master-data/master-travel-directory';
import { HotelRatePacksService } from './hotel-rate-packs.service';

const actor = {
  userId: 'user',
  branchIds: ['branch'],
  permissions: ['reservations.read', 'reservations.hotel_purchase.write'],
} as unknown as AuthenticatedActor;
function fixture(archivedAt: Date | null = null) {
  const pack = {
    id: 'pack',
    branchId: 'branch',
    currentVersion: 3,
    archivedAt,
  };
  const tx = {
    reservationHotelRatePack: {
      findFirst: vi.fn().mockResolvedValue(pack),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    auditEvent: { create: vi.fn() },
  };
  const transaction = vi.fn(async (run) =>
    typeof run === 'function' ? run(tx) : Promise.all(run),
  );
  const service = new HotelRatePacksService(
    {
      client: { ...tx, $transaction: transaction },
    } as unknown as DatabaseService,
    {} as MasterTravelDirectory,
  );
  return { service, tx, transaction };
}
describe('hotel rate pack archive', () => {
  it('archives only the stable pack and audits the actor without rewriting historical rates', async () => {
    const { service, tx } = fixture();
    const result = await service.archive('pack', 3, actor);
    expect(tx.reservationHotelRatePack.findFirst).toHaveBeenCalledWith({
      where: { id: 'pack', branchId: { in: ['branch'] } },
    });
    expect(tx.reservationHotelRatePack.updateMany).toHaveBeenCalledWith({
      where: { id: 'pack', currentVersion: 3, archivedAt: null },
      data: { archivedAt: new Date(result.archivedAt) },
    });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'user',
        action: 'reservations.hotel_rate_pack.archive',
        entityId: 'pack',
        metadata: { branchId: 'branch', version: 3 },
      }),
    });
  });
  it('retries an already archived pack without modifying its timestamp or auditing twice', async () => {
    const date = new Date('2026-10-13T10:00:00Z');
    const { service, tx } = fixture(date);
    expect(await service.archive('pack', 3, actor)).toEqual({
      id: 'pack',
      archivedAt: date.toISOString(),
    });
    expect(tx.reservationHotelRatePack.updateMany).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });
  it('rejects a stale editor version and does not write an audit', async () => {
    const { service, tx } = fixture();
    tx.reservationHotelRatePack.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.archive('pack', 2, actor)).rejects.toThrow(
      'نسخهٔ بسته تغییر کرده',
    );
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });
  it('requires write permission and a numeric positive version before querying', async () => {
    const { service, transaction } = fixture();
    await expect(
      service.archive('pack', 3, {
        ...actor,
        permissions: ['reservations.read'],
      }),
    ).rejects.toThrow();
    for (const version of [undefined, '3', 0, -1, 1.5])
      await expect(service.archive('pack', version, actor)).rejects.toThrow();
    expect(transaction).not.toHaveBeenCalled();
  });
  it('does not mutate a pack outside the accessible branches', async () => {
    const { service, tx } = fixture();
    tx.reservationHotelRatePack.findFirst.mockResolvedValue(null);
    await expect(service.archive('other-pack', 3, actor)).rejects.toThrow();
    expect(tx.reservationHotelRatePack.updateMany).not.toHaveBeenCalled();
  });
  it('excludes archived packs by default but retains a branch-scoped history directory', async () => {
    const { service, tx } = fixture();
    await service.list(actor, 'branch');
    expect(tx.reservationHotelRatePack.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { branchId: { in: ['branch'] }, archivedAt: null },
      }),
    );
    await service.list(actor, 'branch', 1, true);
    expect(tx.reservationHotelRatePack.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { branchId: { in: ['branch'] } } }),
    );
    await expect(service.list(actor, 'other', 1, true)).rejects.toThrow();
  });
});
