import { expect, it } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import { loadWeekdayOffers, loadWeekdayRevisions } from './load-weekday-edit';
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
