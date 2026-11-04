import { describe, it, expect, vi } from 'vitest';
import {
  TicketPublicService,
  validateTicketOffer,
} from './ticket-public.service';
const id = (n: number) =>
  '10000000-0000-4000-8000-' + String(n).padStart(12, '0');
const definition = {
  originId: id(1),
  destinationId: id(2),
  departureAt: '2099-01-01T08:00:00Z',
  arrivalAt: '2099-01-01T10:00:00Z',
  carrierName: 'Synthetic',
  serviceNumber: 'QA',
  cabinClassCode: 'ECONOMY' as const,
  totalCapacity: 2,
};
const routes = [{ originId: id(1), destinationId: id(3) }];
describe('shared offer route boundaries', () => {
  it('rejects malformed, duplicate, canonical duplicate and excessive aliases', () => {
    expect(
      validateTicketOffer({ ...definition, saleRoutes: routes }).saleRoutes,
    ).toEqual(routes);
    for (const saleRoutes of [
      [...routes, ...routes],
      [{ originId: id(1), destinationId: id(1) }],
      [{ originId: id(1), destinationId: id(2) }],
      Array.from({ length: 21 }, (_, i) => ({
        originId: id(1),
        destinationId: id(20 + i),
      })),
    ])
      expect(() =>
        validateTicketOffer({ ...definition, saleRoutes }),
      ).toThrow();
  });
  it('finds the same offer ID/inventory under the selected commercial route', async () => {
    const row = {
      ...definition,
      id: id(4),
      branchId: id(5),
      version: 1,
      status: 'ACTIVE',
      saleRoutes: routes,
      departureAt: new Date(definition.departureAt),
      arrivalAt: new Date(definition.arrivalAt),
      capacityAllocations: [{ quantity: 1 }],
      capacityHolds: [],
      standaloneSalePrices: [],
      outboundRoundTripSalePrices: [],
    };
    const findMany = vi.fn().mockResolvedValue([row]);
    const service = new TicketPublicService(
      { client: { ticketPublishedOffer: { findMany } } } as never,
      {} as never,
    );
    const result = await service.search(
      { originId: id(1), destinationId: id(3), departureFrom: '2099-01-01' },
      { branchIds: [id(5)], permissions: ['ticket_catalog.read'] } as never,
    );
    expect(result.data[0]).toMatchObject({
      id: id(4),
      originId: id(1),
      destinationId: id(3),
      remainingCapacity: 1,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: { in: [id(5)] },
          OR: [
            { originId: id(1), destinationId: id(3) },
            { saleRoutes: { some: { originId: id(1), destinationId: id(3) } } },
          ],
        }),
      }),
    );
  });
  it('revalidates an explicit alternate snapshot and rejects another destination', async () => {
    const row = {
      ...definition,
      id: id(4),
      saleRoutes: routes,
      departureAt: new Date(definition.departureAt),
      arrivalAt: new Date(definition.arrivalAt),
    };
    const service = new TicketPublicService(
      {
        client: {
          ticketPublishedOffer: { findMany: vi.fn().mockResolvedValue([row]) },
        },
      } as never,
      {} as never,
    );
    const selection = {
      ...definition,
      destinationId: id(3),
      offerId: id(4),
      direction: 'OUTBOUND' as const,
      serviceClientKey: 'f',
      carrierNameSnapshot: 'Synthetic',
      serviceNumberSnapshot: 'QA',
    };
    expect(
      (await service.revalidate([id(4)], id(5), [selection])).available,
    ).toBe(true);
    expect(
      (
        await service.revalidate([id(4)], id(5), [
          { ...selection, destinationId: id(9) },
        ])
      ).available,
    ).toBe(false);
  });
});
