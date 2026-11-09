import { describe, expect, it, vi } from 'vitest';
import { TravelWorkflowService } from './travel-workflow.service';
import { initialTravelWorkflow } from './travel-workflow';
import { TicketPublicService } from '../ticket-catalog/ticket-public.service';

function setup(remaining = 10) {
  let state = {
    workflow: initialTravelWorkflow(),
    allocations: [
      {
        id: 'out',
        contractId: 'contract',
        offerId: 'out',
        direction: 'OUTBOUND',
        quantity: 3,
        status: 'ACTIVE',
        releasedAt: null as Date | null,
      },
      {
        id: 'back',
        contractId: 'contract',
        offerId: 'back',
        direction: 'RETURN',
        quantity: 2,
        status: 'ACTIVE',
        releasedAt: null as Date | null,
      },
      {
        id: 'other',
        contractId: 'other',
        offerId: 'out',
        direction: 'OUTBOUND',
        quantity: 1,
        status: 'ACTIVE',
        releasedAt: null as Date | null,
      },
    ],
  };
  const tx = {
    $queryRaw: vi.fn(),
    reservationIntake: { findFirst: vi.fn(async () => ({ id: 'intake' })) },
    reservationWorkflowRevision: {
      findFirst: vi.fn(async () => ({ state: state.workflow })),
      create: vi.fn(
        async ({
          data,
        }: {
          data: { state: ReturnType<typeof initialTravelWorkflow> };
        }) => {
          state.workflow = data.state;
        },
      ),
    },
    ticketOfferCapacityAllocation: {
      findMany: vi.fn(async () =>
        state.allocations.filter((a) => a.contractId === 'contract'),
      ),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { contractId: string; status: string; id?: { in: string[] } };
          data: { status: string; releasedAt: Date | null };
        }) => {
          for (const a of state.allocations)
            if (
              a.contractId === where.contractId &&
              a.status === where.status &&
              (!where.id || where.id.in.includes(a.id))
            )
              Object.assign(a, data);
        },
      ),
    },
    ticketPublishedOffer: {
      findMany: vi.fn(async () =>
        ['out', 'back'].map((id) => ({
          id,
          branchId: 'branch',
          status: 'ACTIVE',
          totalCapacity: remaining,
          capacityAllocations: state.allocations.filter(
            (a) => a.offerId === id && a.status === 'ACTIVE',
          ),
          capacityHolds: [] as { quantity: number }[],
        })),
      ),
    },
  };
  const db = {
    client: {
      $transaction: vi.fn(
        async (fn: (client: typeof tx) => Promise<unknown>) => {
          const before = structuredClone(state);
          try {
            return await fn(tx);
          } catch (e) {
            state = before;
            throw e;
          }
        },
      ),
    },
  };
  const snapshot = {
    passengerIds: [],
    selectedTicketOfferIds: [] as string[],
    serviceSelections: [],
    ticketSelections: [
      { offerId: 'out', direction: 'OUTBOUND' },
      { offerId: 'back', direction: 'RETURN' },
    ],
  };
  const amendments = {
    assertActive: vi.fn(),
    currentExecution: vi.fn(async () => snapshot),
  };
  const catalog = new TicketPublicService(db as never, {} as never);
  const service = new TravelWorkflowService(
    db as never,
    {} as never,
    {} as never,
    {} as never,
    amendments as never,
    catalog,
  );
  vi.spyOn(service, 'detail').mockImplementation(
    async () =>
      ({
        id: 'intake',
        contractId: 'contract',
        branchId: 'branch',
        snapshot,
        workflow: state.workflow,
      }) as never,
  );
  const actor = {
    userId: 'actor',
    branchIds: ['branch'],
    permissions: ['reservations.documents.manage'],
  };
  const update = (
    action: 'CANCEL' | 'REOPEN',
    version = state.workflow.version,
  ) =>
    service.update(
      'intake',
      { action, expectedVersion: version, note: '' },
      actor as never,
    );
  return {
    state: () => state,
    update,
    tx,
    amendments,
    snapshot,
    service,
    actor,
  };
}

describe('Reservations cancellation seat continuity', () => {
  it('releases both exact leg quantities and reopens without changing total seats or another contract', async () => {
    const f = setup();
    await f.update('CANCEL');
    expect(f.state().allocations.map((a) => [a.quantity, a.status])).toEqual([
      [3, 'RELEASED'],
      [2, 'RELEASED'],
      [1, 'ACTIVE'],
    ]);
    expect(f.state().workflow.supplierStatus).toBe('CANCELLED');
    await f.update('REOPEN');
    expect(f.state().allocations.map((a) => [a.quantity, a.status])).toEqual([
      [3, 'ACTIVE'],
      [2, 'ACTIVE'],
      [1, 'ACTIVE'],
    ]);
    expect(f.state().workflow.supplierStatus).toBe('NEW');
  });
  it('keeps cancellation and both released legs intact when one leg no longer has capacity', async () => {
    const f = setup(3);
    await f.update('CANCEL');
    await expect(f.update('REOPEN')).rejects.toThrow();
    expect(f.state().workflow.supplierStatus).toBe('CANCELLED');
    expect(
      f
        .state()
        .allocations.slice(0, 2)
        .every((a) => a.status === 'RELEASED'),
    ).toBe(true);
  });
  it('reopens at the exact remaining capacity and leaves the other contract untouched', async () => {
    const f = setup(4);
    await f.update('CANCEL');
    await f.update('REOPEN');
    expect(f.state().allocations[0]).toMatchObject({
      quantity: 3,
      status: 'ACTIVE',
    });
    expect(f.state().allocations[2]).toMatchObject({
      contractId: 'other',
      quantity: 1,
      status: 'ACTIVE',
    });
  });
  it('counts active temporary holds before reopening either leg', async () => {
    const f = setup(10);
    await f.update('CANCEL');
    const offers = await f.tx.ticketPublishedOffer.findMany();
    f.tx.ticketPublishedOffer.findMany.mockResolvedValueOnce(
      offers.map((offer) => ({ ...offer, capacityHolds: [{ quantity: 7 }] })),
    );
    await expect(f.update('REOPEN')).rejects.toThrow('ظرفیت');
    expect(f.state().workflow.supplierStatus).toBe('CANCELLED');
    expect(
      f
        .state()
        .allocations.slice(0, 2)
        .every((a) => a.status === 'RELEASED'),
    ).toBe(true);
  });
  it.each([0, -1, 1.5, Number.NaN])(
    'rejects an invalid original seat quantity %s',
    async (quantity) => {
      const f = setup();
      await f.update('CANCEL');
      f.state().allocations[0]!.quantity = quantity;
      await expect(f.update('REOPEN')).rejects.toThrow('بلیط');
      expect(f.state().workflow.supplierStatus).toBe('CANCELLED');
    },
  );
  it('rejects duplicate charter identities instead of restoring the same allocation twice', async () => {
    const f = setup();
    await f.update('CANCEL');
    f.snapshot.ticketSelections = [
      f.snapshot.ticketSelections[0]!,
      f.snapshot.ticketSelections[0]!,
    ];
    await expect(f.update('REOPEN')).rejects.toThrow('بلیط');
    expect(f.state().workflow.supplierStatus).toBe('CANCELLED');
  });
  it('rolls back released seats if immutable workflow persistence fails', async () => {
    const f = setup();
    f.tx.reservationWorkflowRevision.create.mockRejectedValueOnce(
      new Error('storage failure'),
    );
    await expect(f.update('CANCEL')).rejects.toThrow('storage failure');
    expect(f.state().allocations.every((a) => a.status === 'ACTIVE')).toBe(
      true,
    );
  });
  it('rejects stale workflow and historical intake commands before capacity changes', async () => {
    const f = setup();
    await expect(f.update('CANCEL', 4)).rejects.toThrow();
    f.tx.reservationIntake.findFirst.mockResolvedValueOnce({
      id: 'new-intake',
    });
    await expect(f.update('CANCEL')).rejects.toThrow();
    expect(
      f.tx.ticketOfferCapacityAllocation.updateMany,
    ).not.toHaveBeenCalled();
  });
  it('cannot reopen a cancelled Sales contract', async () => {
    const f = setup();
    await f.update('CANCEL');
    f.amendments.assertActive.mockRejectedValueOnce(
      new Error('Sales cancelled'),
    );
    await expect(f.update('REOPEN')).rejects.toThrow('Sales cancelled');
    expect(f.state().workflow.supplierStatus).toBe('CANCELLED');
  });
  it('does not reopen a charter request when its current ticket identities are missing', async () => {
    const f = setup();
    await f.update('CANCEL');
    f.snapshot.ticketSelections = [];
    f.snapshot.selectedTicketOfferIds = ['out'];
    await expect(f.update('REOPEN')).rejects.toThrow('بلیط');
    expect(f.state().workflow.supplierStatus).toBe('CANCELLED');
    expect(f.state().allocations[0]!.status).toBe('RELEASED');
  });
  it('rejects missing allocations and unavailable branch offers without inventing seats', async () => {
    const f = setup();
    await f.update('CANCEL');
    f.tx.ticketOfferCapacityAllocation.findMany.mockResolvedValueOnce([]);
    await expect(f.update('REOPEN')).rejects.toThrow();
    f.tx.ticketPublishedOffer.findMany.mockResolvedValueOnce([]);
    await expect(f.update('REOPEN')).rejects.toThrow();
    expect(f.state().allocations[0]?.status).toBe('RELEASED');
    expect(f.tx.ticketPublishedOffer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['back', 'out'] }, branchId: 'branch' },
      }),
    );
  });
  it('keeps workflow cancelled if reopening persistence fails after capacity restoration', async () => {
    const f = setup();
    await f.update('CANCEL');
    f.tx.reservationWorkflowRevision.create.mockRejectedValueOnce(
      new Error('storage failure'),
    );
    await expect(f.update('REOPEN')).rejects.toThrow('storage failure');
    expect(f.state().workflow.supplierStatus).toBe('CANCELLED');
    expect(f.state().allocations[0]?.status).toBe('RELEASED');
  });
  it('reopens floating or hotel-only requests without manufacturing inventory allocations', async () => {
    const f = setup();
    f.snapshot.ticketSelections = [];
    f.state().allocations = [f.state().allocations[2]!];
    await f.update('CANCEL');
    await f.update('REOPEN');
    expect(f.tx.ticketPublishedOffer.findMany).not.toHaveBeenCalled();
    expect(f.state().allocations).toHaveLength(1);
    expect(f.state().allocations[0]?.contractId).toBe('other');
  });
  it('rejects unauthorized cancellation before touching capacity', async () => {
    const f = setup();
    await expect(
      f.service.update(
        'intake',
        { action: 'CANCEL', expectedVersion: 0, note: '' },
        { ...f.actor, permissions: [] } as never,
      ),
    ).rejects.toThrow();
    expect(
      f.tx.ticketOfferCapacityAllocation.updateMany,
    ).not.toHaveBeenCalled();
  });
});
