import { describe, it, expect } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import type { Product } from './catalog';
import { wallTimeToUtc } from './catalog';
import { emptyInput, initialQuery, queryProducts } from './preview';
import {
  arrivalWallTimeAfterDepartureChange,
  arrivalWallTimeAfterMidnight,
  catalogProductsFromOffers,
  catalogOffer,
  publishedLoadGroup,
  publishedLoadGroups,
  samePublishedFlight,
} from './published-catalog';
const offers = Array.from(
  { length: 10 },
  (_, index) =>
    ({
      id: String(index),
      catalogProductId: 'cached-' + index,
      version: 3,
      branchId: 'branch',
      originId: 'a',
      destinationId: 'b',
      departureAt: '2099-10-01T10:00:00Z',
      arrivalAt: '2099-10-01T12:00:00Z',
      carrierName: 'Carrier',
      serviceNumber: '4512',
      cabinClassCode: 'ECONOMY',
      totalCapacity: 50,
      remainingCapacity: 49,
      status: index === 0 ? 'PAUSED' : 'ACTIVE',
    }) as TicketOfferV1,
);
const local = Array.from(
  { length: 4 },
  (_, index) =>
    ({
      id: 'cached-' + index,
      version: 1,
      status: 'active',
      definition: emptyInput(),
      fares: [],
      definitions: [],
      history: [],
    }) as Product,
);
describe('authoritative ticket catalog', () => {
  it('moves an earlier same-day arrival to the next calendar day', () => {
    expect(
      arrivalWallTimeAfterMidnight('2026-09-29T23:30', '2026-09-29T01:00'),
    ).toBe('2026-09-30T01:00');
    expect(
      arrivalWallTimeAfterMidnight('2026-09-29T08:00', '2026-09-29T09:00'),
    ).toBe('2026-09-29T09:00');
    expect(
      arrivalWallTimeAfterMidnight('2026-09-29T23:30', '2026-09-30T01:00'),
    ).toBe('2026-09-30T01:00');
    expect(
      arrivalWallTimeAfterMidnight('2026-09-30T00:30', '2026-09-29T23:00'),
    ).toBe('2026-09-30T23:00');

    const departure = wallTimeToUtc(
      '2026-09-29T23:30',
      'Asia/Tehran',
      '+03:30',
    );
    const arrival = wallTimeToUtc(
      arrivalWallTimeAfterMidnight('2026-09-29T23:30', '2026-09-29T01:00'),
      'Asia/Tehran',
      '+03:30',
    );
    expect(Date.parse(arrival)).toBeGreaterThan(Date.parse(departure));
  });

  it('rebases an earlier arrival date when the departure date moves forward', () => {
    expect(
      arrivalWallTimeAfterDepartureChange(
        '2026-10-02T23:30',
        '2026-10-01T01:00',
      ),
    ).toBe('2026-10-03T01:00');
  });

  it('renders ten separate server tickets with four cached definitions, including identical schedules', () => {
    const products = catalogProductsFromOffers(local, offers, []);
    expect(products).toHaveLength(10);
    expect(new Set(products.map((p) => p.id)).size).toBe(10);
    expect(products[0]?.status).toBe('paused');
    expect(products[0]?.definition.totalCapacity).toBe(50);
    expect(catalogOffer(products[0]!, offers)?.remainingCapacity).toBe(49);
    expect(local[0]?.definition.totalCapacity).toBe(0);
    expect(
      queryProducts(products, { ...initialQuery, sort: 'updated' }).total,
    ).toBe(10);
    expect(
      queryProducts(products, { ...initialQuery, sort: 'updated' }, 12).rows,
    ).toHaveLength(10);
  });
  it('works in a fresh browser and removes archived server tickets without resurrecting cached copies', () => {
    expect(catalogProductsFromOffers([], offers, [])).toHaveLength(10);
    expect(catalogProductsFromOffers(local, offers.slice(1), [])).toHaveLength(
      9,
    );
    expect(catalogProductsFromOffers(local, [], [])).toHaveLength(0);
  });
  it('preserves local ground products and extra metadata only for the exact catalog source identity', () => {
    const ground = {
      ...local[0]!,
      id: 'train',
      definition: { ...emptyInput(), transport: 'train' as const },
    };
    const products = catalogProductsFromOffers([...local, ground], offers, []);
    expect(products).toHaveLength(11);
    expect(products.at(-1)).toBe(ground);
  });
  it('reconstructs editable server fields from shared references on a fresh device', () => {
    const references = [
      {
        id: 'airline',
        kind: 'airline',
        name: 'Carrier',
        active: true,
      },
      {
        id: 'economy',
        kind: 'flightClass',
        name: 'Economy',
        code: 'ECONOMY',
        active: true,
      },
      {
        id: 'a',
        kind: 'city',
        name: 'Origin',
        countryId: 'country-a',
        active: true,
      },
      {
        id: 'b',
        kind: 'city',
        name: 'Destination',
        countryId: 'country-b',
        active: true,
      },
    ] as const;
    const product = catalogProductsFromOffers([], [offers[0]!], references)[0]!;
    expect(product.definition.flightClassId).toBe('economy');
    expect(product.definition.segments[0]).toEqual(
      expect.objectContaining({
        airlineId: 'airline',
        originCountryId: 'country-a',
        originCityId: 'a',
        destinationCountryId: 'country-b',
        destinationCityId: 'b',
      }),
    );
  });

  it('groups every row created by one server load and keeps other loads separate', () => {
    const grouped = offers.slice(0, 3).map((offer) => ({
      ...offer,
      loadGroupId: 'group-a',
    }));
    const other = { ...offers[3]!, loadGroupId: 'group-b' };
    expect(publishedLoadGroup(grouped[0]!, [...grouped, other], [])).toEqual(
      grouped,
    );
  });

  it('expands every visible table row to its complete load without duplicates', () => {
    const firstLoad = offers.slice(0, 3).map((offer) => ({
      ...offer,
      loadGroupId: 'group-a',
    }));
    const secondLoad = offers.slice(3, 5).map((offer) => ({
      ...offer,
      loadGroupId: 'group-b',
    }));
    const all = [...firstLoad, ...secondLoad, offers[5]!];
    expect(
      publishedLoadGroups(
        [firstLoad[1]!, firstLoad[2]!, secondLoad[0]!],
        all,
        [],
      ),
    ).toEqual([...firstLoad, ...secondLoad]);
  });

  it('recovers an older same-browser load only from its exact creation event', () => {
    const history = [
      {
        version: 1,
        action: 'create',
        at: '2026-10-10T10:00:00.000Z',
        actor: 'operator',
        reason: 'تعریف برنامه هفتگی پرواز',
      },
    ];
    const cached = local
      .slice(0, 3)
      .map((product) => ({ ...product, history }));
    expect(publishedLoadGroup(offers[0]!, offers.slice(0, 4), cached)).toEqual(
      offers.slice(0, 3),
    );
  });
});

it('matches backfill by dated flight rather than optional null fields or changed capacity', () => {
  const offer = offers[1]!;
  const input = {
    ...offer,
    totalCapacity: 60,
    supplyType: 'COMPANY' as const,
    manifestTemplateId: null,
    originAirportId: null,
    arrivalAt: '2099-10-01T13:00:00Z',
  };
  expect(samePublishedFlight(offer, input)).toBe(true);
  expect(
    samePublishedFlight(offer, { ...input, cabinClassCode: 'BUSINESS' }),
  ).toBe(false);
  expect(
    samePublishedFlight(offer, {
      ...input,
      departureAt: '2099-10-02T10:00:00Z',
    }),
  ).toBe(false);
  expect(samePublishedFlight(offer, { ...input, supplyType: 'API' })).toBe(
    false,
  );
});
