import { applyManualAmendmentFlights } from './contract-amendment-model';
import { describe, it, expect } from 'vitest';
import type {
  SalesContractDetail,
  SalesContractAmendmentV1,
  TicketOfferV1,
} from '@nora/contracts';
import {
  amendmentFromContract,
  replaceAmendmentFlight,
} from './contract-amendment-model';
const contract = {
  version: 4,
  customerId: 'buyer',
  payerCustomerId: 'payer',
  assignedUserId: null,
  tripType: 'ROUND_TRIP',
  originId: 'a',
  destinationId: 'b',
  departureDate: '2099-01-01T00:00:00Z',
  returnNotBefore: null,
  servicesDetail: [
    { clientKey: 'flight', kind: 'FLIGHT', titleSnapshot: 'Flights' },
  ],
  passengersDetail: [
    {
      id: 'p',
      customerId: 'person',
      displayNameSnapshot: 'Synthetic',
      birthDate: '2000-01-01',
      ageCategory: 'ADT',
      serviceClientKeys: ['flight'],
    },
  ],
  ticketSelections: [
    { direction: 'OUTBOUND', serviceClientKey: 'flight', offerId: 'old' },
    { direction: 'RETURN', serviceClientKey: 'flight', offerId: 'back' },
  ],
  hotelSelection: null,
  priceComponents: [
    { amount: '100', currencyCode: 'USD', type: 'BASE', title: 'Sale' },
  ],
  payments: [{ id: 'receipt', amount: '50', currencyCode: 'USD' }],
} as unknown as SalesContractDetail;
const offer = {
  id: 'new',
  originId: 'a',
  destinationId: 'b',
  departureAt: '2099-01-02T10:00:00Z',
  arrivalAt: '2099-01-02T12:00:00Z',
  carrierName: 'Synthetic air',
  serviceNumber: '2',
  cabinClassCode: 'ECONOMY',
} as TicketOfferV1;
describe('contract amendment draft', () => {
  it('preserves buyer, payer, exact amounts and passenger identity without resubmitting receipts', () => {
    const d = amendmentFromContract(contract);
    expect(d.payerCustomerId).toBe('payer');
    expect(d.priceComponents[0]?.amount).toBe('100');
    expect(d.passengerCategories).toEqual({ person: 'ADT' });
    expect(d).not.toHaveProperty('payments');
    expect(d.passengers[0]?.birthDate).toBe('2000-01-01');
  });
  it('replaces one leg without changing return or making a shared flight service directional', () => {
    const d = replaceAmendmentFlight(
      amendmentFromContract(contract),
      'OUTBOUND',
      offer,
    );
    expect(
      d.ticketSelections?.find((t) => t.direction === 'RETURN')?.offerId,
    ).toBe('back');
    expect(d.services[0]?.metadata?.direction).toBeUndefined();
    expect(d.departureDate).toBe('2099-01-02');
    expect(d.passengers).toEqual(contract.passengersDetail);
  });
  it('removes floating metadata when selecting a catalog ticket', () => {
    const d = {
      ...amendmentFromContract(contract),
      services: [
        {
          clientKey: 'out',
          kind: 'FLIGHT',
          titleSnapshot: 'Floating',
          metadata: {
            direction: 'OUTBOUND',
            contractFlightVersion: 1,
            flightNumber: 'OLD',
            passengerPackagePricingVersion: 1,
          },
        },
      ],
      ticketSelections: [],
    } as SalesContractAmendmentV1;
    const result = replaceAmendmentFlight(d, 'OUTBOUND', offer);
    expect(result.services[0]?.metadata).toEqual({
      direction: 'OUTBOUND',
      passengerPackagePricingVersion: 1,
    });
    expect(result.services[0]?.referenceId).toBe('new');
  });
});

it('edits floating flight times in Tehran without creating a catalog allocation', () => {
  const d = {
    ...amendmentFromContract(contract),
    services: [
      {
        clientKey: 'out',
        kind: 'FLIGHT',
        status: 'NEEDS_RESERVATION_CONFIRMATION',
        titleSnapshot: 'Floating',
        metadata: { direction: 'OUTBOUND', contractFlightVersion: 1 },
      },
    ],
    ticketSelections: [],
  } as SalesContractAmendmentV1;
  const next = applyManualAmendmentFlights(d, {
    OUTBOUND: {
      departureAt: '2099-01-02T02:00',
      arrivalAt: '2099-01-02T04:00',
      carrierName: 'Synthetic',
      serviceNumber: '42',
      cabinClassCode: 'ECONOMY',
    },
  });
  expect(next.ticketSelections).toEqual([]);
  expect(next.departureDate).toBe('2099-01-02');
  expect(next.services[0]?.metadata?.flightDepartureAt).toBe(
    '2099-01-01T22:30:00.000Z',
  );
  expect(next.services[0]?.metadata?.flightNumber).toBe('42');
});
