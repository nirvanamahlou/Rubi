import { describe, expect, it } from 'vitest';
import { buildHotelPackageTable } from './hotel-package-table';
import type {
  HotelOccupancyRateV1,
  PackageTourHotelPurchaseRowV1,
} from './index';

const tariff = (
  adults: number,
  amount: string,
  child = false,
): HotelOccupancyRateV1 => ({
  adults,
  amount,
  childAges: child ? [{ min: 6, maxExclusive: 12 }] : [],
  startsOn: '2026-10-01',
  endsOnExclusive: '2026-10-05',
  currencyCode: 'EUR',
  board: 'BB',
  composition: child ? '2AD+CWB' : String(adults) + 'AD',
});
const row: PackageTourHotelPurchaseRowV1 = {
  id: 'rate',
  version: 1,
  batchId: 'batch',
  hotelId: 'hotel',
  hotelName: 'Hotel',
  brokerId: 'broker',
  brokerName: 'Broker',
  basePerNight: '100',
  currencyCode: 'EUR',
  factors: {},
  roomRates: [
    {
      roomTypeId: 'deluxe',
      roomTypeName: 'Deluxe',
      factor: '1',
      maxAdults: 2,
      maxChildren: 1,
      occupancyRates: [
        tariff(1, '150'),
        tariff(2, '220'),
        tariff(2, '260', true),
      ],
    },
    {
      roomTypeId: 'standard',
      roomTypeName: 'Standard',
      factor: '1',
      maxAdults: 2,
      maxChildren: 1,
      occupancyRates: [
        tariff(1, '100'),
        tariff(2, '180'),
        tariff(2, '210', true),
      ],
    },
  ],
};
const input = {
  row,
  checkIn: '2026-10-01',
  checkOut: '2026-10-03',
  currencyCode: 'EUR',
  calculation: {
    adjustment: {
      direction: 'increase' as const,
      mode: 'percent' as const,
      value: '10',
    },
    adultFlight: { amount: '1000000', currencyCode: 'IRR' },
    childFlight: { amount: '600000', currencyCode: 'IRR' },
    businessUplift: { amount: '0', currencyCode: 'IRR' },
    businessCabin: false,
    commissionPercent: '0',
    flightCosts: [
      { adultUnitCost: '500000', childUnitCost: '300000', currencyCode: 'IRR' },
    ],
  },
};
describe('hotel package per-person composition table', () => {
  it('chooses cheapest complete occupancy rates and divides double by two, keeping currencies separate', () => {
    const prices = buildHotelPackageTable(input);
    expect(
      prices.map((p) => [
        p.roomCode,
        p.hotelPurchase,
        p.hotelSale,
        p.roomTypeName,
      ]),
    ).toEqual([
      ['single', '200.00', '220.00', 'Standard'],
      ['double', '180.00', '198.00', 'Standard'],
      ['doubleChild', '60.00', '66.00', 'Standard'],
    ]);
    expect(
      prices[1]?.currencyAmounts.find((p) => p.currencyCode === 'IRR'),
    ).toMatchObject({ sale: '1000000', purchase: '500000', profit: '500000' });
    expect(prices[2]).toMatchObject({
      childAgeMin: 6,
      childAgeMaxExclusive: 12,
    });
    expect(
      prices[2]?.currencyAmounts.find((p) => p.currencyCode === 'IRR'),
    ).toMatchObject({ sale: '600000', purchase: '300000' });
  });
  it('uses all nights, not the first daily quote', () => {
    const varying = {
      ...row,
      roomRates: [
        {
          ...row.roomRates[1]!,
          occupancyRates: [
            ...row.roomRates[1]!.occupancyRates!.map((r) => ({
              ...r,
              endsOnExclusive: '2026-10-02',
            })),
            tariff(1, '120'),
            tariff(2, '200'),
            tariff(2, '240', true),
          ].map((r, i) => (i < 3 ? r : { ...r, startsOn: '2026-10-02' })),
        },
      ],
    };
    expect(
      buildHotelPackageTable({ ...input, row: varying }).map(
        (p) => p.hotelPurchase,
      ),
    ).toEqual(['220.00', '190.00', '70.00']);
  });
  it('never substitutes missing nights or arbitrary currency/board combinations', () => {
    const missing = {
      ...row,
      roomRates: row.roomRates.map((room) => ({
        ...room,
        occupancyRates: room.occupancyRates!.map((r) => ({
          ...r,
          endsOnExclusive: '2026-10-02',
        })),
      })),
    };
    expect(buildHotelPackageTable({ ...input, row: missing })).toEqual([]);
    const different = {
      ...row,
      roomRates: [
        ...row.roomRates,
        {
          ...row.roomRates[0]!,
          occupancyRates: [{ ...tariff(1, '1'), board: 'AI' }],
        },
      ],
    };
    expect(buildHotelPackageTable({ ...input, row: different })).toEqual([]);
  });
  it('takes the child difference in the same room type and cancels fixed room extras', () => {
    const rooms = {
      ...row,
      roomRates: [
        { ...row.roomRates[0]!, occupancyRates: [tariff(2, '80')] },
        {
          ...row.roomRates[1]!,
          occupancyRates: [tariff(2, '180'), tariff(2, '210', true)],
        },
      ],
    };
    const prices = buildHotelPackageTable({
      ...input,
      row: rooms,
      calculation: {
        ...input.calculation,
        adjustment: { direction: 'increase', mode: 'fixed', value: '25' },
        extraSaleFields: [{ amount: '50', currencyCode: 'USD' }],
        commissionMode: 'fixed',
        commissionAmount: { amount: '10', currencyCode: 'EUR' },
      },
    });
    expect(prices.find((p) => p.roomCode === 'double')?.hotelPurchase).toBe(
      '80.00',
    );
    const child = prices.find((p) => p.roomCode === 'doubleChild')!;
    expect(child.hotelSale).toBe('60.00');
    expect(
      child.currencyAmounts.find((p) => p.currencyCode === 'USD')?.sale,
    ).toBe('0.00');
    expect(
      child.currencyAmounts.find((p) => p.currencyCode === 'EUR')?.commission,
    ).toBe('0.00');
  });
  it('does not derive child tariffs from room capacity or from a no-bed band', () => {
    expect(
      buildHotelPackageTable({
        ...input,
        row: {
          ...row,
          roomRates: row.roomRates.map((r) => ({
            ...r,
            occupancyRates: undefined,
          })),
        },
      }),
    ).toEqual([]);
    const noBed = {
      ...row,
      roomRates: row.roomRates.map((room) => ({
        ...room,
        occupancyRates: room.occupancyRates!.map((rate) =>
          rate.childAges.length
            ? {
                ...rate,
                childAges: [{ min: 2, maxExclusive: 6 }],
                composition: '2AD + CHILD WITHOUT BED',
              }
            : rate,
        ),
      })),
    };
    expect(
      buildHotelPackageTable({ ...input, row: noBed }).map((p) => p.roomCode),
    ).toEqual(['single', 'double']);
  });
  it('keeps legacy explicit composition tariffs and amounts above the JS safe-integer range exact', () => {
    const legacy = {
      ...row,
      basePerNight: '9007199254740993',
      currencyCode: 'IRR',
      roomRates: [],
      factors: { single: '1', double: '2', doubleChild: '2.5' },
    };
    const prices = buildHotelPackageTable({
      ...input,
      row: legacy,
      calculation: {
        ...input.calculation,
        adjustment: { direction: 'increase', mode: 'percent', value: '0' },
      },
    });
    expect(prices[1]?.hotelPurchase).toBe('18014398509481986');
    expect(prices[2]?.hotelPurchase).toBe('9007199254740994');
  });
});
