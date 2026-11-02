import { describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@nora/database';
import { SalesRepository } from './sales.repository';
import { SalesService } from './sales.service';
import { SalesTicketsPublicAdapter } from './sales.adapters';
import { TicketPublicService } from '../ticket-catalog/ticket-public.service';

vi.mock('../finance/accounting/accounting-workflows.public', () => ({
  assertRevenueEditable: vi.fn(),
}));
vi.mock('./sales-financial-settlement', () => ({
  recalculateSalesSettlement: vi.fn(),
}));

function fixture(failRelease = false, staleVersion = false) {
  let state = {
    status: 'CONFIRMED',
    version: 1,
    capacity: 10,
    allocations: [
      {
        contractId: 'contract',
        direction: 'OUTBOUND',
        quantity: 3,
        status: 'ACTIVE',
      },
      {
        contractId: 'contract',
        direction: 'RETURN',
        quantity: 2,
        status: 'ACTIVE',
      },
      {
        contractId: 'another',
        direction: 'OUTBOUND',
        quantity: 4,
        status: 'ACTIVE',
      },
    ],
  };
  const outside = vi.fn(() => {
    throw new Error('Release escaped transaction');
  });
  const release = vi.fn(async () => {
    if (failRelease) throw new Error('Release failed');
    for (const a of state.allocations)
      if (a.contractId === 'contract' && a.status === 'ACTIVE')
        a.status = 'RELEASED';
    return { count: 2 };
  });
  const tx = {
    salesContract: {
      updateMany: vi.fn(async () => {
        if (staleVersion) return { count: 0 };
        state.status = 'CANCELLED';
        state.version++;
        return { count: 1 };
      }),
    },
    ticketOfferCapacityAllocation: { updateMany: release },
    salesContractStatusHistory: { create: vi.fn() },
    salesContractAuditEvent: { create: vi.fn() },
  };
  const database = {
    client: {
      ticketOfferCapacityAllocation: { updateMany: outside },
      ticketPublishedOffer: {
        findMany: vi.fn(async () =>
          ['OUTBOUND', 'RETURN'].map((direction) => ({
            id: direction,
            totalCapacity: state.capacity,
            capacityHolds: [],
            capacityAllocations: state.allocations
              .filter((a) => a.direction === direction && a.status === 'ACTIVE')
              .map((a) => ({ quantity: a.quantity })),
          })),
        ),
      },
      $transaction: vi.fn(
        async (fn: (client: Prisma.TransactionClient) => Promise<unknown>) => {
          const before = structuredClone(state);
          try {
            return await fn(tx as never);
          } catch (error) {
            state = before;
            throw error;
          }
        },
      ),
    },
  };
  const repository = new SalesRepository(database as never);
  vi.spyOn(repository, 'findById').mockResolvedValue({
    id: 'contract',
    branchId: 'branch',
    ownerUserId: 'owner',
    status: 'CONFIRMED',
  } as never);
  const catalog = new TicketPublicService(database as never, {} as never);
  const service = new SalesService(
    repository,
    {} as never,
    new SalesTicketsPublicAdapter(catalog),
  );
  vi.spyOn(service, 'detail').mockResolvedValue({
    data: { id: 'contract' },
  } as never);
  const cancel = () =>
    service.cancel('contract', 1, 'Synthetic cancellation', {
      userId: 'owner',
      branchIds: ['branch'],
      permissions: ['sales.contracts.read.own', 'sales.contracts.cancel'],
    } as never);
  return {
    state: () => state,
    cancel,
    release,
    outside,
    inventory: () =>
      catalog.manifestInventory(['OUTBOUND', 'RETURN'], ['branch']),
  };
}
describe('cancelled contract load capacity', () => {
  it('atomically returns the exact allocated seats for both directions without changing total load or another contract', async () => {
    const f = fixture();
    expect(await f.inventory()).toMatchObject([
      { totalCapacity: 10, remainingCapacity: 3, allocatedCapacity: 7 },
      { totalCapacity: 10, remainingCapacity: 8, allocatedCapacity: 2 },
    ]);
    await f.cancel();
    expect(await f.inventory()).toMatchObject([
      { totalCapacity: 10, remainingCapacity: 6, allocatedCapacity: 4 },
      { totalCapacity: 10, remainingCapacity: 10, allocatedCapacity: 0 },
    ]);
    expect(f.state()).toMatchObject({
      status: 'CANCELLED',
      capacity: 10,
      version: 2,
    });
    expect(f.release).toHaveBeenCalledWith({
      where: { contractId: 'contract', status: 'ACTIVE' },
      data: { status: 'RELEASED', releasedAt: expect.any(Date) },
    });
    expect(
      f.state().allocations.map((a) => [a.direction, a.quantity, a.status]),
    ).toEqual([
      ['OUTBOUND', 3, 'RELEASED'],
      ['RETURN', 2, 'RELEASED'],
      ['OUTBOUND', 4, 'ACTIVE'],
    ]);
    expect(f.outside).not.toHaveBeenCalled();
  });
  it('cannot commit cancellation while seats remain allocated after a release failure', async () => {
    const f = fixture(true);
    await expect(f.cancel()).rejects.toThrow('Release failed');
    expect(f.state().status).toBe('CONFIRMED');
    expect(f.state().allocations.every((a) => a.status === 'ACTIVE')).toBe(
      true,
    );
    expect(f.state().capacity).toBe(10);
  });
  it('does not release seats after a conflicting contract version', async () => {
    const f = fixture(false, true);
    await expect(f.cancel()).rejects.toThrow();
    expect(f.release).not.toHaveBeenCalled();
    expect(f.state().status).toBe('CONFIRMED');
  });
});
