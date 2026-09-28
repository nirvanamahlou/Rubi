import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import type { ProcurementPublicService } from '../procurement/procurement-public.service';
import { TicketPublicService } from './ticket-public.service';

const id = '10000000-0000-4000-8000-000000000001';
const offer = {
  originId: id,
  destinationId: '10000000-0000-4000-8000-000000000002',
  departureAt: '2026-09-22T04:00:00.000Z',
  arrivalAt: '2026-09-22T07:00:00.000Z',
  carrierName: 'Carrier',
  serviceNumber: 'B9-1',
  cabinClassCode: 'ECONOMY' as const,
  totalCapacity: 40,
};
const actor = {
  userId: 'user',
  branchIds: ['branch'],
  permissions: ['ticket_catalog.manage'],
} as never;
function setup(patch = {}) {
  const row = {
    id,
    version: 1,
    branchId: 'branch',
    originId: offer.originId,
    destinationId: offer.destinationId,
    carrierName: offer.carrierName,
    serviceNumber: offer.serviceNumber,
    cabinClassCode: offer.cabinClassCode,
    totalCapacity: offer.totalCapacity,
    capacityAllocations: [],
    capacityHolds: [],
    tourOutboundDepartures: [],
    tourReturnDepartures: [],
    ...patch,
  };
  const tx = {
    $queryRaw: vi.fn(),
    ticketPublishedOffer: {
      findFirst: vi.fn().mockResolvedValue(row),
      update: vi.fn().mockResolvedValue({ ...row, version: 2 }),
    },
    ticketOfferAudit: { create: vi.fn() },
  };
  const service = new TicketPublicService(
    {
      client: {
        $transaction: async (fn: (value: typeof tx) => unknown) => fn(tx),
      },
    } as unknown as DatabaseService,
    {} as ProcurementPublicService,
  );
  return { tx, service };
}
describe('published ticket revision', () => {
  it('keeps an existing contract allocation valid after only the offer time changes', async () => {
    const branchId = '10000000-0000-4000-8000-000000000003';
    const contractId = '10000000-0000-4000-8000-000000000004';
    const allocation = {
      offerId: id,
      contractId,
      direction: 'OUTBOUND',
      quantity: 1,
      status: 'ACTIVE',
    };
    const tx = {
      $queryRaw: vi.fn(),
      ticketPublishedOffer: {
        findMany: vi.fn().mockResolvedValue([
          {
            id,
            ...offer,
            departureAt: new Date('2099-09-22T05:00:00Z'),
            arrivalAt: new Date('2099-09-22T08:00:00Z'),
            capacityAllocations: [allocation],
            capacityHolds: [],
          },
        ]),
      },
      ticketOfferCapacityAllocation: {
        findMany: vi.fn().mockResolvedValue([allocation]),
        create: vi.fn(),
      },
    };
    const service = new TicketPublicService(
      {
        client: {
          $transaction: async (fn: (value: typeof tx) => unknown) => fn(tx),
        },
      } as unknown as DatabaseService,
      {} as ProcurementPublicService,
    );
    await expect(
      service.reserve(
        [
          {
            serviceClientKey: 'flight',
            direction: 'OUTBOUND',
            offerId: id,
            originId: offer.originId,
            destinationId: offer.destinationId,
            departureAt: offer.departureAt,
            arrivalAt: offer.arrivalAt,
            carrierNameSnapshot: offer.carrierName,
            serviceNumberSnapshot: offer.serviceNumber,
            cabinClassCode: offer.cabinClassCode,
          },
        ],
        branchId,
        contractId,
        1,
      ),
    ).resolves.toEqual({
      available: true,
      unavailableOfferIds: [],
      createdAllocationIds: [],
    });
    expect(tx.ticketOfferCapacityAllocation.create).not.toHaveBeenCalled();
  });
  it('archives an expired offer without deleting its contract or finance records', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const create = vi.fn();
    const deleteStandalonePrices = vi.fn().mockResolvedValue({ count: 2 });
    const deleteRoundTripPrices = vi.fn().mockResolvedValue({ count: 3 });
    const tx = {
      ticketPublishedOffer: { updateMany },
      ticketOfferStandaloneSalePrice: { deleteMany: deleteStandalonePrices },
      ticketOfferRoundTripSalePrice: { deleteMany: deleteRoundTripPrices },
      ticketOfferAudit: { create },
    };
    const service = new TicketPublicService(
      {
        client: {
          $transaction: async (fn: (value: typeof tx) => unknown) => fn(tx),
        },
      } as unknown as DatabaseService,
      {} as ProcurementPublicService,
    );
    await expect(service.archiveExpired(id, 1, actor)).resolves.toEqual({
      data: { id, removedPriceRevisions: 5 },
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id,
        branchId: { in: ['branch'] },
        version: 1,
        audit: { none: { action: 'ticket.offer.archived' } },
        departureAt: { lte: expect.any(Date) },
      },
      data: { status: 'PAUSED', version: { increment: 1 } },
    });
    expect(deleteStandalonePrices).toHaveBeenCalledWith({
      where: { offerId: id },
    });
    expect(deleteRoundTripPrices).toHaveBeenCalledWith({
      where: {
        OR: [{ outboundOfferId: id }, { returnOfferId: id }],
      },
    });
    expect(create).toHaveBeenCalledOnce();
    updateMany.mockResolvedValue({ count: 0 });
    await expect(service.archiveExpired(id, 1, actor)).rejects.toThrow(
      'فقط بلیط تاریخ‌گذشته',
    );
    expect(create).toHaveBeenCalledTimes(1);
    expect(deleteStandalonePrices).toHaveBeenCalledTimes(1);
    expect(deleteRoundTripPrices).toHaveBeenCalledTimes(1);
  });
  it('reactivates an automatically expired flight moved into the future', async () => {
    const { tx, service } = setup({
      status: 'PAUSED',
      audit: [{ action: 'ticket.offer.expired' }],
    });
    await service.revise(
      id,
      {
        expectedVersion: 1,
        offer: {
          ...offer,
          departureAt: '2099-09-22T04:00:00Z',
          arrivalAt: '2099-09-22T07:00:00Z',
        },
      },
      actor,
    );
    expect(tx.ticketPublishedOffer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE' }),
      }),
    );
  });
  it('does not reactivate a manually paused flight', async () => {
    const { tx, service } = setup({
      status: 'PAUSED',
      audit: [{ action: 'ticket.offer.paused' }],
    });
    await service.revise(id, { expectedVersion: 1, offer }, actor);
    expect(
      tx.ticketPublishedOffer.update.mock.calls[0]![0].data,
    ).not.toHaveProperty('status');
  });
  it('moves the same offer to 31 Shahrivar and records its new version', async () => {
    const { tx, service } = setup();
    await expect(
      service.revise(id, { expectedVersion: 1, offer }, actor),
    ).resolves.toEqual({ data: { id, version: 2 } });
    expect(tx.ticketPublishedOffer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id },
        data: expect.objectContaining({
          departureAt: new Date('2026-09-22T04:00:00Z'),
        }),
      }),
    );
    expect(tx.ticketOfferAudit.create).toHaveBeenCalledOnce();
    expect(tx.ticketPublishedOffer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id, branchId: { in: ['branch'] } } }),
    );
  });
  it('rejects stale edits before changing data', async () => {
    const { tx, service } = setup({ version: 2 });
    await expect(
      service.revise(id, { expectedVersion: 1, offer }, actor),
    ).rejects.toThrow('بلیط تغییر کرده');
    expect(tx.ticketPublishedOffer.update).not.toHaveBeenCalled();
  });
  it('allows a schedule-only revision after a contract reserved seats', async () => {
    const { tx, service } = setup({ capacityAllocations: [{ id: 'linked' }] });
    await expect(
      service.revise(
        id,
        {
          expectedVersion: 1,
          offer: {
            ...offer,
            departureAt: '2099-09-22T04:00:00Z',
            arrivalAt: '2099-09-22T07:00:00Z',
          },
        },
        actor,
      ),
    ).resolves.toEqual({ data: { id, version: 2 } });
    expect(tx.ticketPublishedOffer.update).toHaveBeenCalledOnce();
  });
  it('still rejects changing the route or capacity of a sold offer', async () => {
    const { tx, service } = setup({ capacityAllocations: [{ id: 'linked' }] });
    await expect(
      service.revise(
        id,
        { expectedVersion: 1, offer: { ...offer, totalCapacity: 41 } },
        actor,
      ),
    ).rejects.toThrow('فقط ساعت حرکت و رسیدن');
    expect(tx.ticketPublishedOffer.update).not.toHaveBeenCalled();
  });
  it.each(['capacityHolds', 'tourOutboundDepartures', 'tourReturnDepartures'])(
    'protects existing %s',
    async (key) => {
      const { tx, service } = setup({ [key]: [{ id: 'linked' }] });
      await expect(
        service.revise(id, { expectedVersion: 1, offer }, actor),
      ).rejects.toThrow('تعیین تکلیف');
      expect(tx.ticketPublishedOffer.update).not.toHaveBeenCalled();
    },
  );
});
