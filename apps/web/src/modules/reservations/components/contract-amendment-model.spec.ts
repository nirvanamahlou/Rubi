import { applyManualAmendmentFlights } from './contract-amendment-model';
import { describe, it, expect } from 'vitest';
import type {
  SalesContractDetail,
  SalesContractAmendmentV1,
  TicketOfferV1,
} from '@nora/contracts';
import {
  amendmentFromContract,
  amendmentBusinessOutput,
  withAmendmentBusinessOutput,
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

it('persists both business-output states on all flight services and preserves unrelated contract data', () => {
  const draft = amendmentFromContract({
    ...contract,
    servicesDetail: [
      {
        clientKey: 'out',
        kind: 'FLIGHT',
        titleSnapshot: 'Out',
        metadata: {
          direction: 'OUTBOUND',
          businessOutput: true,
          reservationNote: 'KEEP',
        },
      },
      {
        clientKey: 'back',
        kind: 'FLIGHT',
        titleSnapshot: 'Back',
        metadata: { direction: 'RETURN', contractFlightVersion: 1 },
      },
      {
        clientKey: 'hotel',
        kind: 'HOTEL',
        titleSnapshot: 'Hotel',
        metadata: { reservationNote: 'HOTEL' },
      },
    ],
  });
  const before = JSON.stringify(draft);
  expect(amendmentBusinessOutput(draft)).toBe(true);
  const off = withAmendmentBusinessOutput(draft, false);
  expect(amendmentBusinessOutput(off)).toBe(false);
  expect(
    off.services.slice(0, 2).map((s) => s.metadata?.businessOutput),
  ).toEqual([false, false]);
  expect(off.services[0]?.metadata?.reservationNote).toBe('KEEP');
  expect(off.services[1]?.metadata?.contractFlightVersion).toBe(1);
  expect(off.services[2]).toBe(draft.services[2]);
  expect(off.ticketSelections).toBe(draft.ticketSelections);
  expect(off.priceComponents).toBe(draft.priceComponents);
  expect(off.passengers).toBe(draft.passengers);
  const on = withAmendmentBusinessOutput(off, true);
  expect(
    on.services.slice(0, 2).map((s) => s.metadata?.businessOutput),
  ).toEqual([true, true]);
  expect(JSON.stringify(draft)).toBe(before);
  expect(
    amendmentBusinessOutput(
      amendmentFromContract({ ...contract, servicesDetail: [] }),
    ),
  ).toBe(false);
});
