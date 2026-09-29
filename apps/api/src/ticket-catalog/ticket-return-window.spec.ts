import { describe, expect, it, vi } from 'vitest';
import type {
  AuthenticatedActor,
  SalesTicketSelectionInput,
} from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { ProcurementPublicService } from '../procurement/procurement-public.service';
import {
  TicketPublicService,
  validateTicketOffer,
} from './ticket-public.service';

const a = '10000000-0000-4000-8000-000000000001',
  b = '10000000-0000-4000-8000-000000000002';
const branch = '10000000-0000-4000-8000-000000000003',
  contract = '10000000-0000-4000-8000-000000000004';
const outbound = {
  id: a,
  branchId: branch,
  originId: a,
  destinationId: b,
  departureAt: new Date('2099-10-03T10:00:00Z'),
  arrivalAt: new Date('2099-10-03T12:00:00Z'),
  carrierName: 'Synthetic QA',
  serviceNumber: 'QA-1',
  cabinClassCode: 'ECONOMY' as const,
  totalCapacity: 50,
  returnMinDays: 2,
  returnMaxDays: 16,
  capacityAllocations: [],
  capacityHolds: [],
};
const returning = {
  ...outbound,
  id: b,
  originId: b,
  destinationId: a,
  departureAt: new Date('2099-10-20T10:00:00Z'),
  arrivalAt: new Date('2099-10-20T12:00:00Z'),
};
const actor = {
  userId: a,
  branchIds: [branch],
  permissions: ['ticket_catalog.read', 'ticket_catalog.manage'],
} as AuthenticatedActor;
const selection = (
  offer: typeof outbound,
  direction: 'OUTBOUND' | 'RETURN',
): SalesTicketSelectionInput => ({
  serviceClientKey: direction,
  offerId: offer.id,
  direction,
  originId: offer.originId,
  destinationId: offer.destinationId,
  departureAt: offer.departureAt.toISOString(),
  arrivalAt: offer.arrivalAt.toISOString(),
  carrierNameSnapshot: offer.carrierName,
  serviceNumberSnapshot: offer.serviceNumber,
  cabinClassCode: offer.cabinClassCode,
});
function setup() {
  const tx = {
    $queryRaw: vi.fn(),
    ticketPublishedOffer: {
      findMany: vi.fn().mockResolvedValue([outbound, returning]),
      findFirst: vi.fn().mockResolvedValue(outbound),
    },
    ticketOfferCapacityAllocation: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
    },
  };
  const client = {
    ...tx,
    $transaction: vi.fn(async (operation) => operation(tx)),
  };
  const service = new TicketPublicService(
    { client } as unknown as DatabaseService,
    {} as ProcurementPublicService,
  );
  return { service, tx, client };
}
describe('server return-window enforcement', () => {
  it('rejects reversed limits at publication', () => {
    const input = {
      originId: a,
      destinationId: b,
      departureAt: outbound.departureAt.toISOString(),
      arrivalAt: outbound.arrivalAt.toISOString(),
      carrierName: 'QA',
      serviceNumber: 'QA1',
      cabinClassCode: 'ECONOMY',
      totalCapacity: 50,
      returnMinDays: 17,
      returnMaxDays: 16,
    };
    expect(() => validateTicketOffer(input)).toThrow(/حداقل/);
    expect(
      validateTicketOffer({ ...input, returnMinDays: null }).returnMaxDays,
    ).toBe(16);
  });
  it('limits reverse-route search before pagination and authorizes the outbound branch', async () => {
    const { service, client, tx } = setup();
    tx.ticketPublishedOffer.findMany.mockResolvedValue([]);
    await service.search(
      {
        originId: b,
        destinationId: a,
        departureFrom: '2099-10-01',
        outboundOfferId: a,
        page: 2,
      },
      actor,
    );
    expect(client.ticketPublishedOffer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: a, branchId: { in: [branch] } }),
      }),
    );
    expect(client.ticketPublishedOffer.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: branch,
          departureAt: {
            gte: new Date('2099-10-04T20:30:00Z'),
            lte: new Date('2099-10-19T20:29:59.999Z'),
          },
        }),
        skip: 50,
        take: 51,
      }),
    );
  });
  it('rejects missing or wrong-route outbound context', async () => {
    const { service, client, tx } = setup();
    tx.ticketPublishedOffer.findMany.mockResolvedValue([]);
    await expect(
      service.search(
        {
          originId: a,
          destinationId: b,
          departureFrom: '2099-10-01',
          outboundOfferId: a,
        },
        actor,
      ),
    ).rejects.toThrow(/معکوس/);
    client.ticketPublishedOffer.findFirst.mockResolvedValue(null as never);
    await expect(
      service.search(
        {
          originId: b,
          destinationId: a,
          departureFrom: '2099-10-01',
          outboundOfferId: a,
        },
        actor,
      ),
    ).rejects.toThrow(/شعبه/);
  });
  it('rejects tampered selections in revalidation and reserves neither leg outside Max', async () => {
    const { service, tx } = setup();
    const choices = [
      selection(outbound, 'OUTBOUND'),
      selection(returning, 'RETURN'),
    ];
    expect(await service.revalidate([a, b], branch, choices)).toEqual({
      available: false,
      unavailableOfferIds: [b],
    });
    expect(await service.reserve(choices, branch, contract, 1)).toEqual({
      available: false,
      unavailableOfferIds: [b],
      createdAllocationIds: [],
    });
    expect(tx.ticketOfferCapacityAllocation.create).not.toHaveBeenCalled();
  });
  it('accepts a later-week return at the inclusive Max even without a trip-group link', async () => {
    const { service, tx } = setup();
    const back = {
      ...returning,
      departureAt: new Date('2099-10-19T10:00:00Z'),
      arrivalAt: new Date('2099-10-19T12:00:00Z'),
    };
    tx.ticketPublishedOffer.findMany.mockResolvedValue([outbound, back]);
    const choices = [
      selection(outbound, 'OUTBOUND'),
      selection(back, 'RETURN'),
    ];
    expect((await service.revalidate([a, b], branch, choices)).available).toBe(
      true,
    );
    tx.ticketOfferCapacityAllocation.create.mockResolvedValue({
      id: 'allocation',
    } as never);
    expect(
      (await service.reserve(choices, branch, contract, 1)).available,
    ).toBe(true);
    expect(tx.ticketOfferCapacityAllocation.create).toHaveBeenCalledTimes(2);
  });
});
