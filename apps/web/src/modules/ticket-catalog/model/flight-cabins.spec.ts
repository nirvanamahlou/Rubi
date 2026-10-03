import { describe, expect, it } from 'vitest';
import { expandFlightCabins, flightCabinCode } from './flight-cabins';
import { emptyInput } from './preview';
import { buildWeekdayTickets } from './weekday-schedule';
import type { Reference } from './catalog';
const references: Reference[] = [
  {
    id: 'economy',
    kind: 'flightClass',
    name: 'Economy',
    code: 'ECONOMY',
    active: true,
  },
  {
    id: 'business',
    kind: 'flightClass',
    name: 'Business',
    code: 'BUSINESS',
    active: true,
  },
  {
    id: 'first',
    kind: 'flightClass',
    name: 'First',
    code: 'FIRST',
    active: true,
  },
];
const input = { ...emptyInput(), flightClassId: 'economy', totalCapacity: 20 };
describe('multiple flight cabins', () => {
  it('creates independent 20 economy and 5 business inventories without mutating the draft', () => {
    const result = expandFlightCabins(
      input,
      [{ flightClassId: 'business', totalCapacity: 5 }],
      references,
    );
    expect(
      result.map((item) => [item.flightClassId, item.totalCapacity]),
    ).toEqual([
      ['economy', 20],
      ['business', 5],
    ]);
    expect(result[0]!.segments).not.toBe(result[1]!.segments);
    expect(result[0]!.fare).not.toBe(result[1]!.fare);
    expect(input.totalCapacity).toBe(20);
    expect(
      result.map((item) =>
        flightCabinCode(
          references.find((ref) => ref.id === item.flightClassId),
        ),
      ),
    ).toEqual(['ECONOMY', 'BUSINESS']);
  });
  it('rejects duplicate classes, including two reference IDs for the same published cabin', () => {
    expect(() =>
      expandFlightCabins(
        input,
        [{ flightClassId: 'economy', totalCapacity: 5 }],
        references,
      ),
    ).toThrow('فقط یک بار');
    expect(() =>
      expandFlightCabins(
        input,
        [{ flightClassId: 'other', totalCapacity: 5 }],
        [...references, { ...references[0]!, id: 'other' }],
      ),
    ).toThrow('فقط یک بار');
  });
  it('rejects empty, inactive and invalid-capacity rows before any publication', () => {
    for (const flightClassId of ['', 'missing'])
      expect(() =>
        expandFlightCabins(
          input,
          [{ flightClassId, totalCapacity: 5 }],
          references,
        ),
      ).toThrow('انتخاب');
    expect(() =>
      expandFlightCabins(
        input,
        [{ flightClassId: 'business', totalCapacity: 5 }],
        references.map((ref) => ({ ...ref, active: ref.id !== 'business' })),
      ),
    ).toThrow('انتخاب');
    for (const totalCapacity of [NaN, -1, 1.5, 100001])
      expect(() =>
        expandFlightCabins(
          input,
          [{ flightClassId: 'business', totalCapacity }],
          references,
        ),
      ).toThrow('ظرفیت');
  });
  it('preserves legacy single-cabin and non-flight definitions', () => {
    expect(expandFlightCabins(input, [], references)).toEqual([input]);
    const train = { ...input, transport: 'train' as const };
    expect(
      expandFlightCabins(
        train,
        [{ flightClassId: 'business', totalCapacity: 5 }],
        references,
      ),
    ).toEqual([train]);
  });
});

it('expands recurring outbound and shared return flights once per cabin with stable retry details', () => {
  const outbound = {
    ...input,
    segments: [
      {
        ...input.segments[0]!,
        originCityId: 'a',
        destinationCityId: 'b',
        departureZone: 'UTC',
        arrivalZone: 'UTC',
      },
    ],
  };
  const returning = {
    ...outbound,
    journeyRole: 'return' as const,
    segments: [
      { ...outbound.segments[0]!, originCityId: 'b', destinationCityId: 'a' },
    ],
  };
  const time = { departure: '10:00', arrival: '12:00', arrivalDayOffset: 0 };
  const build = () =>
    buildWeekdayTickets(
      [
        { outbound: '2099-10-03', returning: '2099-10-05' },
        { outbound: '2099-10-04', returning: '2099-10-05' },
      ],
      outbound,
      returning,
      time,
      time,
      'batch',
      (wall) => new Date(wall + ':00Z').toISOString(),
    ).flatMap((definition) =>
      expandFlightCabins(
        definition,
        [{ flightClassId: 'business', totalCapacity: 5 }],
        references,
      ),
    );
  const products = build();
  expect(products).toHaveLength(6);
  expect(
    products
      .filter((item) => item.journeyRole === 'return')
      .map((item) => [
        item.serviceDate,
        item.flightClassId,
        item.totalCapacity,
      ]),
  ).toEqual([
    ['2099-10-05', 'economy', 20],
    ['2099-10-05', 'business', 5],
  ]);
  expect(build()).toEqual(products);
});

it('keeps outbound/return pairing scoped to the same cabin', () => {
  const extra = [{ flightClassId: 'business', totalCapacity: 5 }];
  const outbound = expandFlightCabins(
    { ...input, journeyRole: 'outbound', tripGroupId: 'pair' },
    extra,
    references,
  );
  const returning = expandFlightCabins(
    { ...input, journeyRole: 'return', tripGroupId: 'pair' },
    extra,
    references,
  );
  expect(outbound.map((item) => item.tripGroupId)).toEqual([
    'pair:ECONOMY',
    'pair:BUSINESS',
  ]);
  expect(returning.map((item) => item.tripGroupId)).toEqual(
    outbound.map((item) => item.tripGroupId),
  );
});
