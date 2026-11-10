import { expect, it } from 'vitest';
import {
  quoteCombinedHotels,
  combinedHotelOptions,
  combinedPublishedSale,
} from './combined-hotels';
import type { PackageTourCostGridV1 } from './index';
import { packageRoomCode, packageRoomIdentity } from './room-compositions';
import { tourDestinationIds, tourStayPeriods } from '../travel/tours';

function grid(count = 2): PackageTourCostGridV1 {
  return {
    version: 1,
    nights: count * 2,
    missingHotelIds: [],
    missingFlightOfferIds: [],
    flightPurchaseCosts: [],
    tour: {
      id: 'tour',
      branchId: 'branch',
      startsOn: '2026-11-01',
      endsOn: `2026-11-0${1 + count * 2}`,
      package: {
        destinationId: 'city-0',
        originId: 'home',
        hotelIds: [],
        details: {
          version: 1,
          isCombined: true,
          destinations: Array.from({ length: count }, (_, i) => ({
            cityId: `city-${i}`,
            nights: 2,
          })),
        },
      },
    },
    purchaseBatches: Array.from({ length: count }, (_, i) => ({
      id: `batch-${i}`,
      version: 1,
      branchId: 'branch',
      cityId: `city-${i}`,
      checkIn: '2026-11-01',
      checkOut: '2026-12-01',
      method: 'STAY',
      currencyCode: 'EUR',
      observedAt: '2026-10-01',
      rows: [
        {
          id: `rate-${i}`,
          version: 1,
          batchId: `batch-${i}`,
          hotelId: `hotel-${i}`,
          hotelName: `Hotel ${i}`,
          brokerId: 'broker',
          brokerName: 'Broker',
          basePerNight: '0',
          currencyCode: 'EUR',
          factors: {},
          roomRates: [
            {
              roomTypeId: `room-${i}`,
              roomTypeName: 'Room',
              factor: '1',
              maxAdults: 2,
              maxChildren: 0,
              occupancyRates: [
                {
                  adults: 2,
                  childAges: [],
                  startsOn: '2026-11-01',
                  endsOnExclusive: '2026-12-01',
                  amount: String((i + 1) * 100),
                  currencyCode: 'EUR',
                  composition: 'DBL',
                  board: 'BB',
                },
              ],
            },
          ],
        },
      ],
    })),
  } as unknown as PackageTourCostGridV1;
}
const definition = (count = 2) => ({
  id: 'combo',
  rooms: Array.from({ length: count }, (_, i) => ({
    rateId: `rate-${i}`,
    roomCode: packageRoomCode({
      roomTypeId: `room-${i}`,
      adults: 2,
      childAges: [],
      board: 'BB',
    }),
  })),
});
it.each([2, 3])(
  'sums only the consecutive nights of all %i destinations and preserves hotel identities',
  (count) => {
    const source = grid(count),
      before = JSON.stringify(source);
    const q = quoteCombinedHotels(source, [definition(count)])[0]!;
    expect(q.purchase).toEqual([
      { currencyCode: 'EUR', amount: count === 2 ? '600.00' : '1200.00' },
    ]);
    expect(q.stays.map((s) => [s.checkIn, s.checkOut])).toEqual(
      tourStayPeriods(
        source.tour.package,
        source.tour.startsOn,
        source.tour.endsOn,
      ).map((s) => [s.checkIn, s.checkOut]),
    );
    expect(packageRoomIdentity(q.roomCode)?.adults).toBe(2);
    expect(combinedPublishedSale(q, 'pub').stays).toHaveLength(count);
    expect(JSON.stringify(source)).toBe(before);
  },
);
it('separates shared sale from purchase and keeps alternative boxes separate', () => {
  const q = quoteCombinedHotels(grid(), [
    { ...definition(), sales: [{ currencyCode: 'EUR', amount: '777.77' }] },
    { ...definition(), id: 'other' },
  ]);
  expect(q.map((c) => c.prices[0]?.amount)).toEqual(['777.77', '600.00']);
  expect(q[0]?.purchase[0]?.amount).toBe('600.00');
});
it('rejects other-city rates, another branch, wrong room identity and gaps without guessing a price', () => {
  for (const patch of [
    (g: PackageTourCostGridV1) => {
      g.purchaseBatches[1]!.cityId = 'wrong';
    },
    (g: PackageTourCostGridV1) => {
      g.purchaseBatches[1]!.branchId = 'other';
    },
    (g: PackageTourCostGridV1) => {
      g.purchaseBatches[1]!.checkOut = '2026-11-03';
    },
  ]) {
    const g = grid();
    patch(g);
    expect(() => quoteCombinedHotels(g, [definition()])).toThrow();
  }
  const d = definition();
  d.rooms[1]!.roomCode = d.rooms[0]!.roomCode;
  expect(() => quoteCombinedHotels(grid(), [d])).toThrow();
  const g = grid();
  g.tour.endsOn = '2026-11-06';
  expect(() => quoteCombinedHotels(g, [definition()])).toThrow();
});
it('does not confuse a single Antalya tour with Izmir or retain stale combined destinations', () => {
  const p = grid().tour.package;
  expect(tourDestinationIds(p)).toEqual(['city-0', 'city-1']);
  expect(
    tourDestinationIds({ ...p, details: { ...p.details!, isCombined: false } }),
  ).toEqual(['city-0']);
  expect(combinedHotelOptions(grid(), 1).map((o) => o.row.hotelId)).toEqual([
    'hotel-1',
  ]);
});
it('rejects duplicate boxes, malformed amounts and mismatched currencies', () => {
  expect(() =>
    quoteCombinedHotels(grid(), [definition(), definition()]),
  ).toThrow();
  for (const amount of ['-1', 'NaN', '1.234'])
    expect(() =>
      quoteCombinedHotels(grid(), [
        { ...definition(), sales: [{ currencyCode: 'EUR', amount }] },
      ]),
    ).toThrow();
  expect(() =>
    quoteCombinedHotels(grid(), [
      { ...definition(), sales: [{ currencyCode: 'USD', amount: '1' }] },
    ]),
  ).toThrow();
});
