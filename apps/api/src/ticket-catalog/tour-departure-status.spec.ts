import { describe, it, expect, vi } from 'vitest';
import { TourPublicService } from './tour-public.service';
import { TicketPublicService } from './ticket-public.service';
import type { AuthenticatedActor } from '@nora/contracts';
const branch = '10000000-0000-4000-8000-000000000001';
const id = '10000000-0000-4000-8000-000000000002';
const actor = {
  userId: id,
  branchIds: [branch],
  permissions: ['ticket_catalog.tours.manage'],
} as unknown as AuthenticatedActor;
describe('departure sales status', () => {
  it.each([true, false])(
    'changes only sales state under branch/version CAS: %s',
    async (isActive) => {
      const updateMany = vi.fn().mockResolvedValue({ count: 1 });
      const service = Object.assign(
        Object.create(TourPublicService.prototype),
        { database: { client: { tourDeparture: { updateMany } } } },
      ) as TourPublicService;
      await service.setDepartureStatus(
        id,
        { isActive, expectedVersion: 3 },
        actor,
        branch,
      );
      expect(updateMany).toHaveBeenCalledWith({
        where: { id, branchId: branch, salesVersion: 3 },
        data: { isActive, salesVersion: { increment: 1 } },
      });
    },
  );
  it('rejects wrong-branch users and stale switches', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const service = Object.assign(Object.create(TourPublicService.prototype), {
      database: { client: { tourDeparture: { updateMany } } },
    }) as TourPublicService;
    await expect(
      service.setDepartureStatus(
        id,
        { isActive: false, expectedVersion: 1 },
        { ...actor, branchIds: [] },
        branch,
      ),
    ).rejects.toThrow();
    expect(updateMany).not.toHaveBeenCalled();
    await expect(
      service.setDepartureStatus(
        id,
        { isActive: false, expectedVersion: 1 },
        actor,
        branch,
      ),
    ).rejects.toThrow();
  });
  it('locks and rejects paused departures before touching capacity, including saved contracts', async () => {
    const tx = {
      $queryRaw: vi.fn(),
      tourDeparture: { findFirst: vi.fn().mockResolvedValue(null) },
      ticketPublishedOffer: { findMany: vi.fn() },
      ticketOfferCapacityAllocation: { upsert: vi.fn() },
    };
    const service = Object.assign(
      Object.create(TicketPublicService.prototype),
      {
        database: {
          client: {
            $transaction: async (cb: (tx: unknown) => Promise<unknown>) =>
              cb(tx),
          },
        },
      },
    ) as TicketPublicService;
    await expect(
      service.reserve(
        [
          {
            offerId: id,
            direction: 'OUTBOUND',
            serviceClientKey: 'flight',
            originId: branch,
            destinationId: id,
            departureAt: '2099-01-01T10:00:00Z',
            arrivalAt: '2099-01-01T12:00:00Z',
            carrierNameSnapshot: 'Synthetic',
            serviceNumberSnapshot: 'TEST',
            cabinClassCode: 'ECONOMY',
          },
        ],
        branch,
        id,
        2,
        undefined,
        undefined,
        id,
      ),
    ).rejects.toThrow('فروش این نوبت');
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.tourDeparture.findFirst).toHaveBeenCalledWith({
      where: { id, branchId: branch, isActive: true },
    });
    expect(tx.ticketPublishedOffer.findMany).not.toHaveBeenCalled();
    expect(tx.ticketOfferCapacityAllocation.upsert).not.toHaveBeenCalled();
  });
});
