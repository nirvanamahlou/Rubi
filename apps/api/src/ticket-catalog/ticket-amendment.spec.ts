import { describe, it, expect, vi } from 'vitest';
import { TicketPublicService } from './ticket-public.service';
const out = {
  serviceClientKey: 'flight',
  direction: 'OUTBOUND' as const,
  offerId: 'new',
  originId: 'A',
  destinationId: 'B',
  departureAt: '2099-01-01T10:00:00.000Z',
  arrivalAt: '2099-01-01T12:00:00.000Z',
  carrierNameSnapshot: 'Synthetic',
  serviceNumberSnapshot: '1',
  cabinClassCode: 'ECONOMY',
};
function setup(capacity = 4) {
  const existing = [
    {
      offerId: 'old',
      direction: 'OUTBOUND',
      quantity: 2,
      status: 'ACTIVE',
      contractId: 'contract',
    },
  ];
  const tx = {
    $queryRaw: vi.fn(),
    ticketOfferCapacityAllocation: {
      findMany: vi.fn(async () => existing),
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
    ticketPublishedOffer: {
      findMany: vi.fn(async () => [
        {
          id: 'new',
          branchId: 'branch',
          status: 'ACTIVE',
          originId: 'A',
          destinationId: 'B',
          departureAt: new Date(out.departureAt),
          arrivalAt: new Date(out.arrivalAt),
          carrierName: 'Synthetic',
          serviceNumber: '1',
          cabinClassCode: 'ECONOMY',
          totalCapacity: capacity,
          capacityAllocations: [{ contractId: 'someone', quantity: 1 }],
          capacityHolds: [{ quantity: 1 }],
        },
      ]),
    },
  };
  const service = Object.create(
    TicketPublicService.prototype,
  ) as TicketPublicService;
  return { tx, service };
}
describe('atomic ticket capacity amendments', () => {
  it('locks offers then replaces the allocation on the caller transaction', async () => {
    const { tx, service } = setup();
    await service.amend(tx as never, [out], 'branch', 'contract', 2);
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.ticketOfferCapacityAllocation.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {
          offerId: 'new',
          quantity: 2,
          status: 'ACTIVE',
          releasedAt: null,
        },
      }),
    );
  });
  it('counts other allocations and unexpired holds before any write', async () => {
    const { tx, service } = setup(3);
    await expect(
      service.amend(tx as never, [out], 'branch', 'contract', 2),
    ).rejects.toThrow('ظرفیت');
    expect(tx.ticketOfferCapacityAllocation.updateMany).not.toHaveBeenCalled();
    expect(tx.ticketOfferCapacityAllocation.upsert).not.toHaveBeenCalled();
  });
  it('rejects tampered route snapshots', async () => {
    const { tx, service } = setup();
    await expect(
      service.amend(
        tx as never,
        [{ ...out, destinationId: 'C' }],
        'branch',
        'contract',
        2,
      ),
    ).rejects.toThrow();
    expect(tx.ticketOfferCapacityAllocation.updateMany).not.toHaveBeenCalled();
  });
  it('rejects duplicate offers across directions', async () => {
    const { tx, service } = setup();
    await expect(
      service.amend(
        tx as never,
        [out, { ...out, direction: 'RETURN' }],
        'branch',
        'contract',
        2,
      ),
    ).rejects.toThrow();
    expect(tx.ticketOfferCapacityAllocation.upsert).not.toHaveBeenCalled();
  });
  it('releases existing allocations when changing to contract-only flights', async () => {
    const { tx, service } = setup();
    await service.amend(tx as never, [], 'branch', 'contract', 2);
    expect(tx.ticketOfferCapacityAllocation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RELEASED' }),
      }),
    );
    expect(tx.ticketOfferCapacityAllocation.upsert).not.toHaveBeenCalled();
  });
  it('does not require a seat for a contract without catalog flights', async () => {
    const { tx, service } = setup();
    await expect(
      service.amend(tx as never, [], 'branch', 'contract', 0),
    ).resolves.toBeUndefined();
  });
});
