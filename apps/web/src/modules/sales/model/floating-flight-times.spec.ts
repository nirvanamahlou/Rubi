import { describe, expect, it } from 'vitest';
import {
  confirmFloatingFlight,
  floatingFlightClock,
  floatingFlightDate,
  floatingFlightTimes,
} from './floating-flight-times';
const flight = {
  departureAt: '',
  arrivalAt: '',
  carrierName: 'TEST',
  serviceNumber: '42',
  cabinClassCode: 'ECONOMY' as const,
};
describe('floating flight clocks reuse prior calendar dates', () => {
  it('combines clocks with the selected day and preserves other facts', () => {
    expect(
      floatingFlightTimes('2026-10-19', flight, {
        departure: '10:15',
        arrival: '12:30',
      }),
    ).toEqual({
      ...flight,
      departureAt: '2026-10-19T10:15',
      arrivalAt: '2026-10-19T12:30',
    });
  });
  it('rolls arrival across month and year boundaries', () => {
    expect(
      floatingFlightTimes('2026-12-31', flight, {
        departure: '23:30',
        arrival: '01:00',
      }).arrivalAt,
    ).toBe('2027-01-01T01:00');
  });
  it('reads UTC snapshots as Tehran clocks', () => {
    expect(floatingFlightClock('2026-10-18T21:30:00Z')).toBe('01:00');
  });
  it('keeps incomplete clocks invalid and rejects malformed dates', () => {
    expect(
      floatingFlightTimes('2026-02-30', flight, {
        departure: '12:00',
        arrival: '13:00',
      }).departureAt,
    ).toBe('');
    expect(
      floatingFlightTimes('2026-10-19', flight, { departure: '25:00' })
        .departureAt,
    ).toBe('');
  });
});

it('does not confirm incomplete details or invalid dates', () => {
  expect(confirmFloatingFlight('', flight).confirmation).toBe('invalid');
  expect(
    confirmFloatingFlight('2027-09-01', {
      ...flight,
      departureAt: '2027-09-01T01:08',
      arrivalAt: '2027-09-01T00:02',
      carrierName: '',
    }).confirmation,
  ).toBe('invalid');
  const saved = confirmFloatingFlight('2027-09-01', {
    ...flight,
    departureAt: '2027-09-01T01:08',
    arrivalAt: '2027-09-01T00:02',
  });
  expect(saved.confirmation).toBe('saved');
  expect(saved.arrivalAt).toBe('2027-09-02T00:02');
});

it('restores the saved Tehran flight day without catalog search state', () => {
  expect(floatingFlightDate('2026-10-18T21:30:00Z')).toBe('2026-10-19');
  expect(floatingFlightDate('2026-10-19T01:00')).toBe('2026-10-19');
  expect(floatingFlightDate('')).toBe('');
});
