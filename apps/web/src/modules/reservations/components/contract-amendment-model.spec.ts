import {
  isFloatingSalesContract,
  contractFlightMetadata,
} from '@nora/contracts';
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

function staleFloatingDates() {
  const leg = (direction: 'OUTBOUND' | 'RETURN', day: string) => ({
    clientKey: direction,
    kind: 'FLIGHT' as const,
    titleSnapshot: direction,
    status: 'NEEDS_RESERVATION_CONFIRMATION' as const,
    metadata: contractFlightMetadata({
      version: 1,
      direction,
      originId: direction === 'OUTBOUND' ? 'a' : 'b',
      destinationId: direction === 'OUTBOUND' ? 'b' : 'a',
      departureAt: day + 'T01:00:00Z',
      arrivalAt: day + 'T03:00:00Z',
      carrierNameSnapshot: 'Synthetic air',
      serviceNumberSnapshot: 'OLD',
      cabinClassCode: 'ECONOMY',
    }),
  });
  return {
    ...amendmentFromContract(contract),
    departureDate: '2026-07-03',
    returnNotBefore: '2026-07-01',
    services: [leg('OUTBOUND', '2026-07-03'), leg('RETURN', '2026-07-10')],
    ticketSelections: [],
  } as SalesContractAmendmentV1;
}
it.each(['OUTBOUND', 'RETURN'] as const)(
  'reconciles stale contract dates when replacing a floating %s flight with charter',
  (direction) => {
    const draft = staleFloatingDates();
    const before = structuredClone(draft);
    const selected = {
      ...offer,
      originId: direction === 'OUTBOUND' ? 'a' : 'b',
      destinationId: direction === 'OUTBOUND' ? 'b' : 'a',
      departureAt:
        direction === 'OUTBOUND'
          ? '2026-07-03T01:00:00Z'
          : '2026-07-10T01:15:00Z',
      arrivalAt:
        direction === 'OUTBOUND'
          ? '2026-07-03T03:00:00Z'
          : '2026-07-10T04:00:00Z',
    };
    const next = replaceAmendmentFlight(draft, direction, selected);
    expect(next.departureDate).toBe('2026-07-03');
    expect(next.returnNotBefore).toBe('2026-07-10');
    expect(next.priceComponents).toEqual(before.priceComponents);
    expect(next.passengers).toEqual(before.passengers);
    expect(draft).toEqual(before);
  },
);
it('uses Tehran calendar dates after editing a floating return across UTC midnight', () => {
  const draft = staleFloatingDates();
  const next = applyManualAmendmentFlights(draft, {
    RETURN: {
      departureAt: '2026-07-11T02:00',
      arrivalAt: '2026-07-11T04:00',
      carrierName: 'Synthetic air',
      serviceNumber: 'BACK',
      cabinClassCode: 'ECONOMY',
    },
  });
  expect(next.departureDate).toBe('2026-07-03');
  expect(next.returnNotBefore).toBe('2026-07-11');
  expect(next.ticketSelections).toEqual([]);
});
it('does not repair actual reversed flights or rewrite dates without an applied flight edit', () => {
  const draft = staleFloatingDates();
  expect(applyManualAmendmentFlights(draft, {})).toBe(draft);
  const next = replaceAmendmentFlight(draft, 'RETURN', {
    ...offer,
    originId: 'b',
    destinationId: 'a',
    departureAt: '2026-07-02T01:00:00Z',
    arrivalAt: '2026-07-02T03:00:00Z',
  });
  expect(next.departureDate).toBe('2026-07-03');
  expect(next.returnNotBefore).toBe('2026-07-02');
});

it('refreshes purchase ownership when a floating catalog flight is replaced', () => {
  const draft = amendmentFromContract(contract);
  draft.services = draft.services.map((service) => ({
    ...service,
    metadata: { ...service.metadata, purchaseSupplyType: 'FLOATING' },
  }));
  expect(isFloatingSalesContract(draft.services)).toBe(true);
  const replaced = replaceAmendmentFlight(draft, 'OUTBOUND', {
    ...offer,
    supplyType: 'COMPANY',
  });
  expect(isFloatingSalesContract(replaced.services)).toBe(false);
  expect(replaced.services[0]?.metadata?.purchaseSupplyType).toBe('COMPANY');
});

it.each(['OUTBOUND', 'RETURN'] as const)(
  'converts a shared catalog %s leg without losing the opposite ticket or sale prices',
  (direction) => {
    const draft = amendmentFromContract(contract);
    const before = structuredClone(draft);
    const next = applyManualAmendmentFlights(draft, {
      [direction]: {
        departureAt: '2099-01-10T12:00',
        arrivalAt: '2099-01-10T14:00',
        carrierName: 'Synthetic air',
        serviceNumber: 'FLOAT',
        cabinClassCode: 'ECONOMY',
      },
    });
    expect(next.ticketSelections).toHaveLength(1);
    expect(next.ticketSelections?.[0]?.direction).not.toBe(direction);
    const floating = next.services.find(
      (s) => s.metadata?.contractFlightVersion === 1,
    )!;
    expect(floating.metadata?.direction).toBe(direction);
    expect(floating.referenceId).toBeFalsy();
    expect(floating.status).toBe('NEEDS_RESERVATION_CONFIRMATION');
    expect(next.passengers[0]?.serviceClientKeys).toContain(floating.clientKey);
    expect(next.priceComponents).toEqual(before.priceComponents);
    expect(draft).toEqual(before);
    expect(isFloatingSalesContract(next.services)).toBe(true);
    expect(
      direction === 'RETURN' ? next.returnNotBefore : next.departureDate,
    ).toBe('2099-01-10');
  },
);

it('preserves anonymous historical counts when splitting a shared catalog service', () => {
  const draft = amendmentFromContract(contract);
  draft.passengers = [];
  draft.passengerCategories = {};
  draft.services = [
    {
      ...draft.services[0]!,
      metadata: {
        legacyServicePartiesV2: JSON.stringify({
          flight: { adults: 2, children: 1, infants: 0 },
        }),
      },
    },
    ...draft.services.slice(1),
  ];
  const next = applyManualAmendmentFlights(draft, {
    RETURN: {
      departureAt: '2099-01-10T12:00',
      arrivalAt: '2099-01-10T14:00',
      carrierName: 'Synthetic',
      serviceNumber: 'FLOAT',
      cabinClassCode: 'ECONOMY',
    },
  });
  const counts = JSON.parse(
    String(next.services[0]?.metadata?.legacyServicePartiesV2),
  );
  expect(Object.keys(counts)).toHaveLength(2);
  expect(counts[next.services[1]!.clientKey]).toEqual(counts.flight);
  expect(
    next.services.filter((s) => s.metadata?.legacyServicePartiesV2),
  ).toHaveLength(1);
});
it('converts a dedicated catalog service without changing its key or sale metadata', () => {
  const draft = amendmentFromContract(contract);
  draft.ticketSelections = (draft.ticketSelections ?? []).filter(
    (t) => t.direction === 'OUTBOUND',
  );
  draft.services = [
    {
      ...draft.services[0]!,
      referenceId: 'old',
      metadata: {
        direction: 'OUTBOUND',
        purchaseSupplyType: 'CHARTER',
        businessOutput: true,
      },
    },
    ...draft.services.slice(1),
  ];
  const next = applyManualAmendmentFlights(draft, {
    OUTBOUND: {
      departureAt: '2099-01-10T12:00',
      arrivalAt: '2099-01-10T14:00',
      carrierName: 'Synthetic',
      serviceNumber: 'FLOAT',
      cabinClassCode: 'ECONOMY',
    },
  });
  expect(next.services).toHaveLength(1);
  expect(next.services[0]?.clientKey).toBe('flight');
  expect(next.services[0]?.metadata?.businessOutput).toBe(true);
  expect(next.ticketSelections).toEqual([]);
  expect(next.passengers).toEqual(draft.passengers);
});
