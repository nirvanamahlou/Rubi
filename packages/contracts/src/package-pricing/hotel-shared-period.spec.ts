import { describe, expect, it } from 'vitest';
import {
  sharedHotelCandidates,
  validHotelStay,
  type HotelRatePeriodV1,
} from './hotel-shared-period';
import { quoteHotelOccupancy } from './hotel-occupancy';
import { buildHotelPackageTable } from './hotel-package-table';

const period = (
  id: string,
  from: string,
  to: string,
  amount = '100',
  hotelId = 'hotel',
): HotelRatePeriodV1 => ({
  id,
  batchId: id,
  version: 1,
  checkIn: from,
  checkOut: to,
  method: 'STAY',
  rows: [
    {
      hotelId,
      hotelName: hotelId,
      brokerId: 'broker',
      brokerName: 'Broker',
      currency: 'EUR',
      roomRates: [
        {
          roomTypeId: 'room',
          roomTypeName: 'Land view',
          factor: '1',
          maxAdults: 2,
          maxChildren: 1,
          occupancyRates: [
            { adults: 1, childAges: [], composition: 'SGL' },
            { adults: 2, childAges: [], composition: 'DBL' },
            {
              adults: 2,
              childAges: [{ min: 6, maxExclusive: 12 }],
              composition: '2AD+CWB',
            },
          ].map((shape) => ({
            ...shape,
            amount,
            saleAmount: amount,
            startsOn: from,
            endsOnExclusive: to,
            currencyCode: 'EUR',
            board: 'BB',
          })),
        },
      ],
    },
  ],
});
const total = (periods: HotelRatePeriodV1[], from: string, to: string) => {
  const row = sharedHotelCandidates(periods, from, to)[0]!;
  return quoteHotelOccupancy(row.roomRates[0]?.occupancyRates ?? [], {
    adults: 1,
    childAges: [],
    rooms: 1,
    checkIn: from,
    checkOut: to,
  });
};
describe('shared hotel stay periods', () => {
  it('selects both independently priced hotels for their common five nights, with no inter-hotel average', () => {
    const periods = [
      period('a', '2027-04-01', '2027-05-01', '100', 'A'),
      period('b', '2027-04-18', '2027-05-20', '250', 'B'),
    ];
    const rows = sharedHotelCandidates(periods, '2027-04-20', '2027-04-25');
    expect(rows.map((row) => [row.hotelId, row.available])).toEqual([
      ['A', true],
      ['B', true],
    ]);
    expect(total([periods[0]!], '2027-04-20', '2027-04-25')?.amount).toBe(
      '500',
    );
    expect(total([periods[1]!], '2027-04-20', '2027-04-25')?.amount).toBe(
      '1250',
    );
  });
  it('charges two nights at100 and three at200, preserving nightly segments through package pricing', () => {
    const periods = [
      period('a', '2027-04-01', '2027-04-22'),
      period('b', '2027-04-22', '2027-05-01', '200'),
    ];
    expect(total(periods, '2027-04-20', '2027-04-25')?.amount).toBe('800');
    const row = sharedHotelCandidates(periods, '2027-04-20', '2027-04-25')[0]!;
    const result = buildHotelPackageTable({
      row: {
        ...row,
        id: 'derived',
        batchId: 'batch',
        version: 1,
        basePerNight: '1',
        factors: {},
        currencyCode: row.currency,
      },
      checkIn: '2027-04-20',
      checkOut: '2027-04-25',
      currencyCode: 'EUR',
      calculation: {
        adjustment: { direction: 'increase', mode: 'percent', value: '0' },
        adultFlight: { amount: '0', currencyCode: 'EUR' },
        childFlight: { amount: '0', currencyCode: 'EUR' },
        businessUplift: { amount: '0', currencyCode: 'EUR' },
        businessCabin: false,
        commissionPercent: '0',
      },
    });
    expect(
      result.find((price) => price.roomCode === 'single')?.hotelPurchase,
    ).toBe('800.00');
    expect(
      result.find((price) => price.roomCode === 'double')?.hotelPurchase,
    ).toBe('400.00');
  });
  it('rejects gaps and different overlapping prices, accepts identical overlaps without double charging', () => {
    expect(
      sharedHotelCandidates(
        [
          period('a', '2027-04-20', '2027-04-22'),
          period('b', '2027-04-23', '2027-04-25'),
        ],
        '2027-04-20',
        '2027-04-25',
      )[0]?.available,
    ).toBe(false);
    const a = period('a', '2027-04-20', '2027-04-25');
    expect(
      sharedHotelCandidates(
        [a, period('b', '2027-04-22', '2027-04-25', '200')],
        '2027-04-20',
        '2027-04-25',
      )[0]?.available,
    ).toBe(false);
    expect(
      total(
        [a, period('b', '2027-04-22', '2027-04-25')],
        '2027-04-20',
        '2027-04-25',
      )?.amount,
    ).toBe('500');
  });
  it('does not bridge brokers or room types and never counts checkout as a night', () => {
    const a = period('a', '2027-04-20', '2027-04-22');
    const b = period('b', '2027-04-22', '2027-04-25');
    b.rows[0]!.brokerId = 'other';
    expect(
      sharedHotelCandidates([a, b], '2027-04-20', '2027-04-25').every(
        (row) => !row.available,
      ),
    ).toBe(true);
    b.rows[0]!.brokerId = 'broker';
    b.rows[0]!.roomRates[0]!.roomTypeId = 'other';
    expect(
      sharedHotelCandidates([a, b], '2027-04-20', '2027-04-25')[0]?.available,
    ).toBe(false);
    expect(total([a], '2027-04-20', '2027-04-22')?.amount).toBe('200');
  });
  it('validates dates and does not mutate source tariffs or coefficients', () => {
    expect(validHotelStay('2027-02-30', '2027-03-03')).toBe(false);
    expect(validHotelStay('2028-02-29', '2028-03-01')).toBe(true);
    const source = period('a', '2027-04-01', '2027-05-01');
    const before = JSON.stringify(source);
    sharedHotelCandidates([source], '2027-04-20', '2027-04-25');
    expect(JSON.stringify(source)).toBe(before);
  });
});
