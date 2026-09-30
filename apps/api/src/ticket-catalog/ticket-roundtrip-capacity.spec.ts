import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import type { ProcurementPublicService } from '../procurement/procurement-public.service';
import { TicketPublicService } from './ticket-public.service';

const id = (n: number) =>
  '10000000-0000-4000-8000-' + String(n).padStart(12, '0');

describe('atomic round-trip sale capacity', () => {
  it.each(['OUTBOUND', 'RETURN'] as const)(
    'rejects overselling the smaller %s leg without reserving either leg',
    async (limitedDirection) => {
      const offers = (['OUTBOUND', 'RETURN'] as const).map(
        (direction, index) => ({
          id: id(index + 1),
          branchId: id(3),
          originId: id(direction === 'OUTBOUND' ? 4 : 5),
          destinationId: id(direction === 'OUTBOUND' ? 5 : 4),
          departureAt: new Date(
            index ? '2099-10-08T08:00:00Z' : '2099-10-01T08:00:00Z',
          ),
          arrivalAt: new Date(
            index ? '2099-10-08T10:00:00Z' : '2099-10-01T10:00:00Z',
          ),
          cabinClassCode: 'ECONOMY' as const,
          carrierName: 'Synthetic',
          serviceNumber: String(index),
          totalCapacity: direction === limitedDirection ? 10 : 50,
          capacityAllocations:
            direction === limitedDirection ? [{ quantity: 5 }] : [],
          capacityHolds:
            direction === limitedDirection ? [{ quantity: 3 }] : [],
        }),
      );
      const create = vi
        .fn()
        .mockResolvedValueOnce({ id: 'allocation-out' })
        .mockResolvedValueOnce({ id: 'allocation-return' });
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        ticketPublishedOffer: { findMany: vi.fn().mockResolvedValue(offers) },
        ticketOfferCapacityAllocation: {
          findMany: vi.fn().mockResolvedValue([]),
          create,
        },
      };
      const service = new TicketPublicService(
        {
          client: {
            $transaction: (fn: (value: typeof tx) => unknown) => fn(tx),
          },
        } as unknown as DatabaseService,
        {} as ProcurementPublicService,
      );
      const selections = offers.map((offer, index) => ({
        serviceClientKey: index ? 'flight-return' : 'flight-outbound',
        direction: index ? ('RETURN' as const) : ('OUTBOUND' as const),
        offerId: offer.id,
        originId: offer.originId,
        destinationId: offer.destinationId,
        departureAt: offer.departureAt.toISOString(),
        arrivalAt: offer.arrivalAt.toISOString(),
        cabinClassCode: offer.cabinClassCode,
        carrierNameSnapshot: offer.carrierName,
        serviceNumberSnapshot: offer.serviceNumber,
      }));
      await expect(
        service.reserve(selections, id(3), id(6), 3),
      ).resolves.toEqual({
        available: false,
        unavailableOfferIds: [
          offers[limitedDirection === 'OUTBOUND' ? 0 : 1]!.id,
        ],
        createdAllocationIds: [],
      });
      expect(create).not.toHaveBeenCalled();
      await expect(
        service.reserve(selections, id(3), id(6), 2),
      ).resolves.toEqual({
        available: true,
        unavailableOfferIds: [],
        createdAllocationIds: ['allocation-out', 'allocation-return'],
      });
      expect(create).toHaveBeenCalledTimes(2);
      for (const call of create.mock.calls)
        expect(call[0].data.quantity).toBe(2);
    },
  );
});
