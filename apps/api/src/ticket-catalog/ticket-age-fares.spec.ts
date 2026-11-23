import { describe, it, expect, vi } from 'vitest';
import { ageFareTotal, ageCounts } from './ticket-age-fares';
import { websiteFlightQuotes } from '../site-commerce/ticket-quote';
import { applySaleCommissions } from './ticket-sale-commissions';
import { websiteTargetOffer } from './website-target-offer';
import { Prisma } from '@nora/database';
import type { TicketOfferV1 } from '@nora/contracts';
describe('published age fares', () => {
  it('keeps legacy children as seats and infants free', () =>
    expect(
      ageFareTotal(
        { amount: '100' },
        { adults: 1, children: 2, infants: 1 },
        0,
      ).toString(),
    ).toBe('300'));
  it('uses explicit zero and group rates with adult tiers while children still consume capacity', () => {
    const fare = {
      amount: '100',
      childAmount: '40',
      infantAmount: '0',
      tiers: [
        { seatCount: 1, amount: '100' },
        { seatCount: 3, amount: '200' },
      ],
    };
    expect(
      ageFareTotal(fare, { adults: 1, children: 1, infants: 1 }, 1).toString(),
    ).toBe('240');
    expect(() =>
      ageFareTotal(fare, { adults: 1, children: 1, infants: 0 }, 3),
    ).toThrow();
  });
  it('calculates exact categories, commissions and target projection without raw rate leakage', () => {
    const offer = {
      standaloneSalePrice: {
        revision: 1,
        amount: '100',
        currencyCode: 'IRR',
        childAmount: '60',
        infantAmount: '10',
      },
      roundTripSalePrices: [],
    } as unknown as TicketOfferV1;
    const target = {
      id: 'target',
      branchId: 'branch',
      name: 'site',
      code: 'NSS',
      version: 1,
      isActive: true,
    };
    const projected = websiteTargetOffer(
      applySaleCommissions(offer, [
        {
          returnOfferId: null,
          salePriceTargetId: 'target',
          revision: 1,
          percent: new Prisma.Decimal(10),
          target,
        },
      ]),
      'target',
    );
    expect(projected.standaloneSalePrice).toMatchObject({
      amount: '90',
      childAmount: '54',
      infantAmount: '9',
    });
    expect(ageCounts(['ADT', 'CHD', 'INF'])).toEqual({
      adults: 1,
      children: 1,
      infants: 1,
    });
  });
  it('splits an odd-cent paired total exactly once and keeps standalone return independent', () => {
    const out = {
      id: 'out',
      branchId: 'branch',
      originId: 'a',
      destinationId: 'b',
      departureAt: '2035-01-01T10:00:00Z',
      arrivalAt: '2035-01-01T12:00:00Z',
      remainingCapacity: 2,
      roundTripSalePrices: [
        {
          returnOfferId: 'back',
          revision: 1,
          amount: '100',
          childAmount: '40',
          infantAmount: '0.01',
          currencyCode: 'IRR',
        },
      ],
    } as unknown as TicketOfferV1;
    const back = {
      id: 'back',
      branchId: 'branch',
      originId: 'b',
      destinationId: 'a',
      departureAt: '2035-01-04T10:00:00Z',
      remainingCapacity: 2,
    } as unknown as TicketOfferV1;
    expect(
      websiteFlightQuotes(out, back, 2, {
        adults: 1,
        children: 1,
        infants: 1,
      }).map((x) => x.amount),
    ).toEqual(['70.00', '70.01']);
    expect(() =>
      websiteFlightQuotes({ ...out, remainingCapacity: 1 }, back, 2, {
        adults: 1,
        children: 1,
        infants: 0,
      }),
    ).toThrow();
  });
});

import { TicketPublicService } from './ticket-public.service';
import type { DatabaseService } from '../database/database.service';
import type { ProcurementPublicService } from '../procurement/procurement-public.service';
import type { AuthenticatedActor } from '@nora/contracts';
it.each(['standalone', 'paired'] as const)(
  'persists %s group prices as a new revision and rejects a negative rate',
  async (mode) => {
    const id = '10000000-0000-4000-8000-000000000001',
      back = '10000000-0000-4000-8000-000000000002';
    const prior = {
      revision: 1,
      childAmount: new Prisma.Decimal(40),
      infantAmount: new Prisma.Decimal(5),
    };
    const create = vi.fn(({ data }) => Promise.resolve(data));
    const rates = {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(prior),
      create,
    };
    const out = {
      id,
      branchId: 'branch',
      originId: 'a',
      destinationId: 'b',
      departureAt: new Date('2099-01-01T10:00:00Z'),
      totalCapacity: 10,
    };
    const tx = {
      $queryRaw: vi.fn(),
      ticketPublishedOffer: {
        findFirst: vi.fn().mockResolvedValue(out),
        findMany: vi.fn().mockResolvedValue([
          out,
          {
            ...out,
            id: back,
            originId: 'b',
            destinationId: 'a',
            departureAt: new Date('2099-01-04T10:00:00Z'),
          },
        ]),
      },
      ticketOfferStandaloneSalePrice: rates,
      ticketOfferRoundTripSalePrice: rates,
    };
    const service = new TicketPublicService(
      {
        client: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
      } as unknown as DatabaseService,
      {} as ProcurementPublicService,
    );
    const actor = {
      userId: 'actor',
      branchIds: ['branch'],
      permissions: ['ticket_catalog.manage'],
    } as AuthenticatedActor;
    const input = {
      expectedRevision: 1,
      amount: '100',
      childAmount: '0',
      infantAmount: '10',
      currencyCode: 'IRR',
    };
    const save = (v: typeof input) =>
      mode === 'standalone'
        ? service.updateStandaloneSalePrice(id, v, actor, 'key')
        : service.updateRoundTripSalePrice(id, back, v, actor, 'key');
    expect((await save(input)).data).toMatchObject({
      revision: 2,
      childAmount: '0',
      infantAmount: '10',
    });
    expect(create.mock.calls[0]![0].data.childAmount.toString()).toBe('0');
    expect(create.mock.calls[0]![0].data.infantAmount.toString()).toBe('10');
    expect(prior.childAmount.toString()).toBe('40');
    await expect(save({ ...input, childAmount: '-1' })).rejects.toThrow();
    expect(create).toHaveBeenCalledTimes(1);
  },
);
it('rechecks changed child fares before allocation, then reserves two seats for adult, child and infant', async () => {
  const id = '10000000-0000-4000-8000-000000000001',
    branch = '10000000-0000-4000-8000-000000000002',
    contract = '10000000-0000-4000-8000-000000000003',
    origin = '10000000-0000-4000-8000-000000000004',
    dest = '10000000-0000-4000-8000-000000000005';
  const dep = '2099-10-01T08:00:00.000Z',
    arr = '2099-10-01T10:00:00.000Z';
  const fare = {
    amount: new Prisma.Decimal(100),
    childAmount: new Prisma.Decimal(40),
    infantAmount: new Prisma.Decimal(10),
    currencyCode: 'IRR',
    tiers: [
      { seatCount: 20, amount: new Prisma.Decimal(100) },
      { seatCount: 15, amount: new Prisma.Decimal(150) },
    ],
  };
  const create = vi.fn().mockResolvedValue({ id: 'allocation' });
  const tx = {
    $queryRaw: vi.fn(),
    ticketPublishedOffer: {
      findMany: vi.fn().mockResolvedValue([
        {
          id,
          branchId: branch,
          originId: origin,
          destinationId: dest,
          departureAt: new Date(dep),
          arrivalAt: new Date(arr),
          cabinClassCode: 'ECONOMY',
          carrierName: 'Carrier',
          serviceNumber: '123',
          totalCapacity: 35,
          capacityAllocations: [{ quantity: 20 }],
          capacityHolds: [],
        },
      ]),
    },
    ticketOfferCapacityAllocation: {
      findMany: vi.fn().mockResolvedValue([]),
      create,
    },
    ticketOfferStandaloneSalePrice: {
      findFirst: vi.fn().mockImplementation(() => Promise.resolve(fare)),
    },
    ticketSaleCommissionRevision: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  };
  const service = new TicketPublicService(
    {
      client: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
    } as unknown as DatabaseService,
    {} as ProcurementPublicService,
  );
  const selection = {
    serviceClientKey: 'flight',
    direction: 'OUTBOUND' as const,
    offerId: id,
    originId: origin,
    destinationId: dest,
    departureAt: dep,
    arrivalAt: arr,
    cabinClassCode: 'ECONOMY' as const,
    carrierNameSnapshot: 'Carrier',
    serviceNumberSnapshot: '123',
  };
  const reserve = (amount: string) =>
    service.reserve([selection], branch, contract, 2, {
      flight: {
        amount,
        currencyCode: 'IRR',
        passengerCounts: { adults: 1, children: 1, infants: 1 },
      },
    });
  await expect(reserve('199')).rejects.toThrow();
  expect(create).not.toHaveBeenCalled();
  expect((await reserve('200')).available).toBe(true);
  expect(create.mock.calls[0]![0].data.quantity).toBe(2);
  create.mockClear();
  fare.childAmount = new Prisma.Decimal(50);
  await expect(reserve('200')).rejects.toThrow();
  expect(create).not.toHaveBeenCalled();
});
