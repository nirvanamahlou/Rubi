import { expect, it } from 'vitest';
import { requireFlightAirports } from './flight-airports';

it.each([
  {},
  { originAirportId: 'ika' },
  { destinationAirportId: 'ayt' },
  { originAirportId: '', destinationAirportId: 'ayt' },
  { originAirportId: 'ika', destinationAirportId: null },
])('prevents flight form submission with a missing airport: %j', (flight) => {
  expect(() => requireFlightAirports(flight)).toThrow(
    'فرودگاه مبدأ و مقصد را انتخاب کنید.',
  );
});

it('accepts both explicitly selected airports', () => {
  expect(() =>
    requireFlightAirports({
      originAirportId: 'ika',
      destinationAirportId: 'ayt',
    }),
  ).not.toThrow();
});
