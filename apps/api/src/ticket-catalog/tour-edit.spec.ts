import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { MasterTravelDirectory } from '../master-data/master-travel-directory';
import { TourPublicService } from './tour-public.service';
const id = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const actor: AuthenticatedActor = {
  userId: id,
  sessionId: id,
  branchIds: [id],
  permissions: ['ticket_catalog.manage'],
};
const input = {
  name: 'Original tour',
  originId: id,
  destinationId: other,
  hotelIds: [],
  transferOutbound: false,
  transferReturn: false,
  visa: false,
};
function setup({
  departures = 0,
  version = 1,
  changed = 1,
  found = true,
} = {}) {
  const original = {
    id,
    branchId: id,
    version,
    definition: input,
    createdAt: new Date('2026-01-01'),
  };
  const update = vi.fn(async ({ data }: { data: object }) => ({
    ...original,
    ...data,
    version: version + 1,
  }));
  const count = vi.fn(async () => departures);
  const updateMany = vi.fn(async () => ({ count: changed }));
  const tx = { tourPackage: { updateMany, update }, tourDeparture: { count } };
  const transaction = vi.fn(
    async (run: (client: typeof tx) => Promise<unknown>) => run(tx),
  );
  const references = { assertTourReferences: vi.fn(async () => {}) };
  const database = {
    client: {
      tourPackage: { findFirst: vi.fn(async () => (found ? original : null)) },
      $transaction: transaction,
    },
  };
  return {
    service: new TourPublicService(
      database as unknown as DatabaseService,
      references as unknown as MasterTravelDirectory,
    ),
    update,
    updateMany,
    count,
    transaction,
    references,
  };
}
describe('tour package editing', () => {
  it('allows the Sales-only tour permission to edit definitions', async () => {
    const { service } = setup();
    const salesActor: AuthenticatedActor = {
      ...actor,
      permissions: ['ticket_catalog.tours.manage'],
    };
    const result = await service.updatePackage(
      id,
      { ...input, name: 'Sales update', expectedVersion: 1 },
      salesActor,
      id,
    );
    expect(result.data.name).toBe('Sales update');
  });
  it('persists descriptive changes with an atomic version check even when departures exist', async () => {
    const { service, updateMany } = setup({ departures: 2 });
    const result = await service.updatePackage(
      id,
      { ...input, name: 'Updated tour', expectedVersion: 1 },
      actor,
      id,
    );
    expect(result.data.name).toBe('Updated tour');
    expect(result.data.version).toBe(2);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id, branchId: id, version: 1 },
      data: { version: { increment: 1 } },
    });
  });
  it('allows route/service changes before any departure exists', async () => {
    const { service } = setup();
    const result = await service.updatePackage(
      id,
      { ...input, visa: true, expectedVersion: 1 },
      actor,
      id,
    );
    expect(result.data.visa).toBe(true);
  });
  it('rejects core changes for an existing departure before writing its definition', async () => {
    const { service, update } = setup({ departures: 1 });
    await expect(
      service.updatePackage(
        id,
        { ...input, visa: true, expectedVersion: 1 },
        actor,
        id,
      ),
    ).rejects.toThrow('نوبت');
    expect(update).not.toHaveBeenCalled();
  });
  it('rejects a stale editor before resolving references', async () => {
    const { service, references } = setup({ version: 2 });
    await expect(
      service.updatePackage(id, { ...input, expectedVersion: 1 }, actor, id),
    ).rejects.toThrow('نسخه');
    expect(references.assertTourReferences).not.toHaveBeenCalled();
  });
  it('rejects a concurrent writer that wins after the initial read', async () => {
    const { service, update } = setup({ changed: 0 });
    await expect(
      service.updatePackage(id, { ...input, expectedVersion: 1 }, actor, id),
    ).rejects.toThrow('کاربر دیگری');
    expect(update).not.toHaveBeenCalled();
  });
  it('rejects foreign branches and read-only actors', async () => {
    const { service, transaction } = setup();
    await expect(
      service.updatePackage(id, { ...input, expectedVersion: 1 }, actor, other),
    ).rejects.toThrow('مجوز');
    await expect(
      service.updatePackage(
        id,
        { ...input, expectedVersion: 1 },
        { ...actor, permissions: ['ticket_catalog.read'] },
        id,
      ),
    ).rejects.toThrow('مجوز');
    expect(transaction).not.toHaveBeenCalled();
  });
  it('rejects packages outside the selected branch', async () => {
    const { service, references } = setup({ found: false });
    await expect(
      service.updatePackage(id, { ...input, expectedVersion: 1 }, actor, id),
    ).rejects.toThrow('یافت نشد');
    expect(references.assertTourReferences).not.toHaveBeenCalled();
  });
  it.each([undefined, 0, -1, '1', 1.5])(
    'rejects invalid expected version %s',
    async (expectedVersion) => {
      const { service, transaction } = setup();
      await expect(
        service.updatePackage(id, { ...input, expectedVersion }, actor, id),
      ).rejects.toThrow('نسخه');
      expect(transaction).not.toHaveBeenCalled();
    },
  );
});
