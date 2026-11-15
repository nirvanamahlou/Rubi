import { expect, it } from 'vitest';
import type { SalesReservationRequestV1 } from '@nora/contracts';
import { insuranceContractTrip } from './contract-trip';
const contract = {
  departureDate: new Date('2027-01-01'),
  returnNotBefore: new Date('2027-01-07'),
};
function snapshot(tickets: unknown[] = [], hotelSelection: unknown = null) {
  return {
    serviceSelections: [],
    ticketSelections: tickets,
    hotelSelection,
  } as unknown as SalesReservationRequestV1;
}
it('counts both travel dates, including a same-day trip', () => {
  expect(insuranceContractTrip(contract).durationDays).toBe(7);
  expect(
    insuranceContractTrip({ departureDate: contract.departureDate })
      .durationDays,
  ).toBe(1);
});
it('uses actual outbound and return flights instead of a stale search range', () => {
  expect(
    insuranceContractTrip(
      contract,
      snapshot([
        {
          direction: 'OUTBOUND',
          departureAt: '2027-02-01T20:30:00Z',
          arrivalAt: '2027-02-02T00:30:00Z',
        },
        {
          direction: 'RETURN',
          departureAt: '2027-02-07T20:00:00Z',
          arrivalAt: '2027-02-07T22:00:00Z',
        },
      ]),
    ),
  ).toEqual({ departureDate: '2027-02-02', durationDays: 7 });
});
it('covers the return arrival day when arrival is after midnight in Tehran', () => {
  expect(
    insuranceContractTrip(
      contract,
      snapshot([
        {
          direction: 'RETURN',
          departureAt: '2027-01-07T18:00:00Z',
          arrivalAt: '2027-01-07T21:00:00Z',
        },
      ]),
    ).durationDays,
  ).toBe(8);
});
it('uses the latest hotel checkout when there is no return flight', () => {
  expect(
    insuranceContractTrip(
      contract,
      snapshot([], {
        checkOutDate: '2027-01-08',
        additionalStays: [{ checkOutDate: '2027-01-12' }],
      }),
    ).durationDays,
  ).toBe(12);
});
