import { describe, it, expect } from 'vitest';
import {
  contractFlightMetadata,
  salesContractFlights,
  salesContractOnlyFlights,
} from '../src/sales/contract-flights';
import type { SalesServiceInput } from '../src/sales';
const service: SalesServiceInput = {
  clientKey: 'flight-outbound',
  kind: 'FLIGHT',
  titleSnapshot: 'شناور',
  status: 'NEEDS_RESERVATION_CONFIRMATION',
  metadata: contractFlightMetadata({
    version: 1,
    direction: 'OUTBOUND',
    originId: '10000000-0000-4000-8000-000000000002',
    destinationId: '10000000-0000-4000-8000-000000000003',
    departureAt: '2026-10-01T06:00:00Z',
    arrivalAt: '2026-10-01T08:00:00Z',
    carrierNameSnapshot: 'Sample Air',
    serviceNumberSnapshot: 'SF123',
    cabinClassCode: 'ECONOMY',
  }),
};
describe('Versioned contract-only flight metadata', () => {
  it('roundtrips as service JSON without any catalog offer identifier', () => {
    const restored = JSON.parse(JSON.stringify(service)) as SalesServiceInput;
    expect(salesContractFlights([restored])).toMatchObject([
      {
        source: 'CONTRACT_ONLY',
        serviceClientKey: 'flight-outbound',
        serviceNumberSnapshot: 'SF123',
      },
    ]);
    expect(salesContractOnlyFlights([restored])[0]).not.toHaveProperty(
      'offerId',
    );
    expect(
      salesContractOnlyFlights([
        { clientKey: 'hotel', kind: 'HOTEL', titleSnapshot: 'Hotel' },
      ]),
    ).toEqual([]);
  });
  it.each([
    { contractFlightVersion: 2 },
    { flightNumber: '' },
    { flightCarrierName: 'x'.repeat(161) },
    { flightArrivalAt: '2026-09-30T08:00:00Z' },
    { flightDepartureAt: 'invalid' },
    { flightDepartureAt: '2026-02-30T07:00:00Z' },
    { flightCabinClass: 'ANY' },
    { originId: 'invented' },
    { direction: 'SIDE' },
  ])('rejects malformed metadata %j', (patch) =>
    expect(() =>
      salesContractOnlyFlights([
        { ...service, metadata: { ...service.metadata, ...patch } },
      ]),
    ).toThrow(),
  );
  it('requires flight service and pending-reservation status', () => {
    expect(() =>
      salesContractOnlyFlights([{ ...service, kind: 'HOTEL' }]),
    ).toThrow();
    expect(() =>
      salesContractOnlyFlights([{ ...service, status: 'SELECTED' }]),
    ).toThrow();
    expect(() =>
      salesContractOnlyFlights([{ ...service, referenceId: 'offer' }]),
    ).toThrow();
  });
});
