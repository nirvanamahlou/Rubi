import { describe, expect, it } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import {
  companyFlightLegs,
  companyReturnLegs,
  flightLoadTotals,
  type FlightLoadFilter,
} from './flight-load';
const offer = (
  id: string,
  date: string,
  patch: Partial<TicketOfferV1> = {},
): TicketOfferV1 => ({
  id,
  version: 1,
  branchId: 'branch',
  originId: 'a',
  destinationId: 'b',
  departureAt: date + 'T10:00:00Z',
  arrivalAt: date + 'T12:00:00Z',
  carrierName: 'Air',
  serviceNumber: 'ABC4512',
  cabinClassCode: 'ECONOMY',
  totalCapacity: 50,
  remainingCapacity: 43,
  allocatedCapacity: 5,
  reservedCapacity: 2,
  status: 'ACTIVE',
  supplyType: 'COMPANY',
  ...patch,
});
const filter: FlightLoadFilter = {
  from: '2099-10-01',
  to: '2099-10-30',
  origin: 'a',
  destination: 'b',
  carrier: '',
  number: '451',
  weekday: '',
  cabin: '',
};
describe('company flight load', () => {
  it('includes only company capacity, inclusive dates and substring flight search', () => {
    const rows = [
      offer('first', '2099-10-01'),
      offer('last', '2099-10-30'),
      offer('later', '2099-10-31'),
      offer('api', '2099-10-03', { supplyType: 'API' }),
      offer('floating', '2099-10-03', { supplyType: 'FLOATING' }),
      offer('legacy', '2099-10-03', { supplyType: null }),
    ];
    expect(companyFlightLegs(rows, filter).map((row) => row.id)).toEqual([
      'first',
      'last',
    ]);
  });
  it('selects reverse legs within inclusive Min/Max beyond outbound filter end, branch and class', () => {
    const outbound = offer('out', '2099-10-30', {
      returnMinDays: 2,
      returnMaxDays: 15,
    });
    const back = (
      id: string,
      date: string,
      patch: Partial<TicketOfferV1> = {},
    ) => offer(id, date, { originId: 'b', destinationId: 'a', ...patch });
    const rows = [
      back('min', '2099-11-01'),
      back('max', '2099-11-14'),
      back('outside', '2099-11-15'),
      back('branch', '2099-11-02', { branchId: 'other' }),
      back('business', '2099-11-02', { cabinClassCode: 'BUSINESS' }),
      back('api', '2099-11-02', { supplyType: 'API' }),
    ];
    expect(
      companyReturnLegs(rows, outbound, true).map((row) => row.id),
    ).toEqual(['min', 'max']);
    expect(
      companyReturnLegs(rows, outbound, false).map((row) => row.id),
    ).toEqual(['min', 'business', 'max']);
    expect(companyReturnLegs(rows, undefined, false)).toEqual([]);
  });
  it('totals legs once and separates active allocation from held seats', () => {
    expect(
      flightLoadTotals([offer('a', '2099-10-01'), offer('b', '2099-10-02')]),
    ).toEqual({ total: 100, remaining: 86, sold: 10, reserved: 4 });
  });
  it('filters weekday in Tehran calendar rather than UTC date', () => {
    const row = offer('late', '2099-10-01', {
      departureAt: '2099-10-01T22:00:00Z',
    });
    const day = new Date('2099-10-02T00:00:00Z').getUTCDay().toString();
    expect(companyFlightLegs([row], { ...filter, weekday: day })).toHaveLength(
      1,
    );
  });
});
