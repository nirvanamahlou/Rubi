import { expect, it } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import {
  loadWeekdayOffers,
  loadWeekdayRevisions,
  loadWeekdayMoveRevisions,
  offerWeekday,
} from './load-weekday-edit';
import { publishedOfferInput } from './published-catalog';
const first: TicketOfferV1 = {
  id: 'first',
  version: 3,
  branchId: 'branch',
  loadGroupId: 'load',
  originId: 'a',
  destinationId: 'b',
  departureAt: '2026-10-22T21:00:00Z',
  arrivalAt: '2026-10-22T23:00:00Z',
  carrierName: 'Test airline',
  serviceNumber: '12',
  cabinClassCode: 'ECONOMY',
  totalCapacity: 20,
  remainingCapacity: 18,
  status: 'ACTIVE',
};

it('moves Sunday flights to Monday in Tehran while retaining every per-flight fact and overnight offset', () => {
  const sunday = {
    ...first,
    departureAt: '2026-10-24T21:00:00Z',
    arrivalAt: '2026-10-25T23:00:00Z',
  };
  const next = {
    ...sunday,
    id: 'second',
    version: 9,
    cabinClassCode: 'BUSINESS' as const,
    totalCapacity: 7,
    departureAt: '2026-10-31T21:00:00Z',
    arrivalAt: '2026-11-01T23:00:00Z',
    economyBaggageKg: '30',
    returnMinDays: 2,
    returnMaxDays: 9,
  };
  const rows = [sunday, next];
  const before = JSON.stringify(rows);
  const result = loadWeekdayMoveRevisions(sunday, rows, 1);
  expect(result).toEqual(
    rows.map((offer) => ({
      id: offer.id,
      expectedVersion: offer.version,
      offer: {
        ...publishedOfferInput(offer),
        departureAt: new Date(
          Date.parse(offer.departureAt) + 86400000,
        ).toISOString(),
        arrivalAt: new Date(
          Date.parse(offer.arrivalAt) + 86400000,
        ).toISOString(),
      },
    })),
  );
  expect(result[0]?.offer.departureAt).toBe('2026-10-25T21:00:00.000Z');
  expect(
    result.every((item) => offerWeekday(item.offer.departureAt) === 1),
  ).toBe(true);
  expect(JSON.stringify(rows)).toBe(before);
});

it('moves within the Saturday-Friday week across a year boundary', () => {
  const saturday = {
    ...first,
    departureAt: '2026-12-26T07:00:00Z',
    arrivalAt: '2026-12-26T10:00:00Z',
  };
  const friday = loadWeekdayMoveRevisions(saturday, [saturday], 5)[0]!.offer;
  expect(friday.departureAt).toBe('2027-01-01T07:00:00.000Z');
  const moved = { ...saturday, ...friday };
  expect(
    loadWeekdayMoveRevisions(moved, [moved], 6)[0]?.offer.departureAt,
  ).toBe('2026-12-26T07:00:00.000Z');
});

it('rejects unchanged days, invalid targets and mixed or duplicate flight groups before writing', () => {
  expect(() =>
    loadWeekdayMoveRevisions(first, [first], offerWeekday(first.departureAt)),
  ).toThrow();
  for (const day of [-1, 7, 1.5, NaN])
    expect(() => loadWeekdayMoveRevisions(first, [first], day)).toThrow();
  for (const other of [
    { ...first, branchId: 'other' },
    { ...first, loadGroupId: 'other' },
    { ...first, originId: first.destinationId, destinationId: first.originId },
    { ...first, departureAt: '2026-10-24T21:00:00Z' },
  ])
    expect(() =>
      loadWeekdayMoveRevisions(first, [first, { ...other, id: 'other' }], 1),
    ).toThrow();
  for (const rows of [[], [first, first], [{ ...first, id: 'missing' }]])
    expect(() => loadWeekdayMoveRevisions(first, rows, 1)).toThrow();
});
it('selects Tehran weekday in one load/direction across classes and dates, excluding other branches and weekdays', () => {
  const next = {
    ...first,
    id: 'next',
    version: 8,
    departureAt: '2026-10-29T21:00:00Z',
    arrivalAt: '2026-10-29T23:00:00Z',
    cabinClassCode: 'BUSINESS' as const,
    totalCapacity: 8,
  };
  const rows = [
    first,
    next,
    { ...first, id: 'other-day', departureAt: '2026-10-23T21:00:00Z' },
    { ...first, id: 'other-load', loadGroupId: 'other' },
    { ...first, id: 'other-branch', branchId: 'other' },
    { ...first, id: 'return', originId: 'b', destinationId: 'a' },
  ];
  expect(loadWeekdayOffers(first, rows, []).map((x) => x.id)).toEqual([
    'first',
    'next',
  ]);
  const before = JSON.stringify(rows);
  const changes = loadWeekdayRevisions(first, [first, next], {
    ...publishedOfferInput(first),
    serviceNumber: '14',
    departureAt: '2026-10-22T22:00:00Z',
    arrivalAt: '2026-10-23T01:00:00Z',
  });
  expect(changes[1]).toMatchObject({
    id: 'next',
    expectedVersion: 8,
    offer: {
      departureAt: '2026-10-29T22:00:00.000Z',
      arrivalAt: '2026-10-30T01:00:00.000Z',
      cabinClassCode: 'BUSINESS',
      totalCapacity: 8,
      serviceNumber: '14',
    },
  });
  expect(JSON.stringify(rows)).toBe(before);
  expect(() =>
    loadWeekdayRevisions(first, [first], {
      ...publishedOfferInput(first),
      departureAt: '2026-10-24T10:00:00Z',
    }),
  ).toThrow();
});
it('keeps unchanged times and saved per-flight limits', () => {
  const next = { ...first, id: 'next', returnMinDays: 2, returnMaxDays: 8 };
  expect(
    loadWeekdayRevisions(first, [next], {
      ...publishedOfferInput(first),
      carrierName: 'New carrier',
    })[0]?.offer,
  ).toMatchObject({
    departureAt: first.departureAt,
    arrivalAt: first.arrivalAt,
    returnMinDays: 2,
    returnMaxDays: 8,
  });
});
