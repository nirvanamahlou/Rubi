import { expect, it } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import {
  eligibleReturn,
  exactFlightQuery,
  flightDay,
} from './exact-flight-dates';
const offer: TicketOfferV1 = {
  id: 'out',
  version: 1,
  branchId: 'branch',
  originId: 'origin',
  destinationId: 'destination',
  departureAt: '2099-10-01T21:00:00Z',
  arrivalAt: '2099-10-02T01:00:00Z',
  carrierName: 'Carrier',
  serviceNumber: '1',
  cabinClassCode: 'ECONOMY',
  totalCapacity: 10,
  remainingCapacity: 10,
  status: 'ACTIVE',
  returnMinDays: 2,
  returnMaxDays: 3,
};
it('uses Tehran dates on both sides of midnight and starts search at Tehran midnight', () => {
  expect(flightDay(offer)).toBe('2099-10-02');
  expect(flightDay({ ...offer, departureAt: '2099-10-01T20:29:59Z' })).toBe(
    '2099-10-01',
  );
  expect(exactFlightQuery('2099-10-02')).toEqual({
    departureFrom: '2099-10-02T00:00:00+03:30',
    departureTo: '2099-10-02',
  });
});
it('enforces reverse route, authorized branch, arrival and inclusive min/max day boundaries', () => {
  const returning = {
    ...offer,
    id: 'return',
    originId: 'destination',
    destinationId: 'origin',
    departureAt: '2099-10-04T00:00:00Z',
  };
  expect(eligibleReturn(offer, returning)).toBe(true);
  expect(
    eligibleReturn(offer, {
      ...returning,
      departureAt: '2099-10-05T00:00:00Z',
    }),
  ).toBe(true);
  expect(
    eligibleReturn(offer, {
      ...returning,
      departureAt: '2099-10-06T00:00:00Z',
    }),
  ).toBe(false);
  expect(
    eligibleReturn(offer, {
      ...returning,
      departureAt: '2099-10-03T00:00:00Z',
    }),
  ).toBe(false);
  expect(eligibleReturn(offer, { ...returning, branchId: 'other' })).toBe(
    false,
  );
  expect(eligibleReturn(offer, { ...returning, originId: 'origin' })).toBe(
    false,
  );
  expect(
    eligibleReturn(
      { ...offer, returnMinDays: null, returnMaxDays: null },
      { ...returning, departureAt: '2099-10-01T22:00:00Z' },
    ),
  ).toBe(false);
});
