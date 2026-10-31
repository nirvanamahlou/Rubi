import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import {
  contractFlightMetadata,
  salesContractOnlyFlights,
} from '@nora/contracts';
import {
  emptySalesForm,
  patchContractFlight,
  salesFlightSelection,
  salesFlightsValid,
  salesSelectedFlightsReady,
  salesPayload,
  salesTravelDate,
  withSalesHotelDates,
  type SalesFormState,
  type ContractFlightDraft,
} from './sales-form';
import { ContractFlightEditor } from '../components/contract-flight-editor';
import { FlightTicketDocument } from '../components/flight-ticket-preview';
import { contractPrintHtml } from './contract-print';
import { printFixture, printReferences } from './contract-print.fixture';
import { reservationTickets } from '../../reservations/model/reservation-tickets';
const originId = '10000000-0000-4000-8000-000000000002',
  destinationId = '10000000-0000-4000-8000-000000000003';
const draft = {
  departureAt: '2026-10-01T10:30:00',
  arrivalAt: '2026-10-01T13:30:00',
  carrierName: 'Sample Floating Air',
  serviceNumber: 'FLOAT123',
  cabinClassCode: 'ECONOMY' as const,
};
const state: SalesFormState = {
  ...structuredClone(emptySalesForm),
  originId,
  destinationId,
  serviceKinds: ['FLIGHT'],
  contractFlights: { OUTBOUND: draft },
};
describe('Contract-only flight form and consumers', () => {
  it('shows the entered Tehran time and pending status, never demo issuance identifiers', () => {
    const html = renderToStaticMarkup(
      createElement(FlightTicketDocument, {
        state,
        cities: [],
        passengerName: 'Sample',
      }),
    );
    expect(html).toContain('10:30');
    expect(html).toContain('PENDING RESERVATION');
    expect(html).toContain('FLOAT123');
    expect(html).not.toContain('DEMO-');
  });
  it('normalizes Tehran entry to UTC, persists versioned service metadata and has no offer selection', () => {
    expect(salesFlightsValid(state)).toBe(true);
    const payload = salesPayload(state);
    expect(payload.ticketSelections).toEqual([]);
    expect(payload.services[0]?.status).toBe('NEEDS_RESERVATION_CONFIRMATION');
    expect(salesContractOnlyFlights(payload.services)[0]?.departureAt).toBe(
      '2026-10-01T07:00:00.000Z',
    );
    expect(salesTravelDate(state)).toBe('2026-10-01');
    expect(JSON.stringify(payload)).not.toContain('totalCapacity');
  });
  it('requires complete data and valid return timing independent of catalog capacity', () => {
    const both = {
      ...state,
      tripType: 'ROUND_TRIP' as const,
      contractFlights: {
        OUTBOUND: draft,
        RETURN: {
          ...draft,
          departureAt: '2026-10-02T10:30:00',
          arrivalAt: '2026-10-02T13:30:00',
        },
      },
    };
    expect(salesFlightsValid(both)).toBe(true);
    expect(
      salesFlightsValid({
        ...both,
        contractFlights: { ...both.contractFlights, RETURN: draft },
      }),
    ).toBe(false);
    expect(
      salesFlightsValid({
        ...state,
        contractFlights: { OUTBOUND: { ...draft, serviceNumber: '' } },
      }),
    ).toBe(false);
    expect(() =>
      salesPayload({
        ...state,
        contractFlights: { OUTBOUND: { ...draft, carrierName: '' } },
      }),
    ).toThrow();
  });
  it('switching to manual clears catalog identity and hotel dates follow manual travel', () => {
    const patch = patchContractFlight(
      { ...state, ticket: { ...state.ticket, outboundOfferId: 'old' } },
      'OUTBOUND',
      draft,
    );
    expect(patch.ticket?.outboundOfferId).toBe('');
    expect(patch.outboundOffer).toBeUndefined();
    const next = withSalesHotelDates(emptySalesForm, state);
    expect(next.hotel.checkIn).toBe('2026-10-01');
    expect(
      withSalesHotelDates(next, { ...next, hotelArrivesNextDay: true }).hotel
        .checkIn,
    ).toBe('2026-10-01');
    expect(
      patchContractFlight(state, 'OUTBOUND', undefined).contractFlights,
    ).toEqual({});
  });
  it('uses themed fields with no capacity input or browser select', () => {
    const html = renderToStaticMarkup(
      createElement(ContractFlightEditor, {
        value: draft,
        onChange: () => undefined,
      }),
    );
    expect(html).toContain('ایرلاین بلیط شناور');
    expect(html).toContain('ساعت حرکت');
    expect(html).not.toContain('تاریخ و ساعت حرکت');
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('type="number"');
  });
  it('renders saved manual flights in contract PDF and reservation tickets without fake offers', () => {
    const output = structuredClone(printFixture);
    const flight = salesFlightSelection(state, 'OUTBOUND')!;
    output.contract.ticketSelections = [];
    output.contract.servicesDetail = [
      {
        clientKey: 'flight-outbound',
        kind: 'FLIGHT',
        titleSnapshot: 'شناور',
        status: 'NEEDS_RESERVATION_CONFIRMATION',
        metadata: contractFlightMetadata({ ...flight, version: 1 }),
      },
    ];
    expect(contractPrintHtml(output, printReferences)).toContain('FLOAT123');
    expect(contractPrintHtml(output, printReferences)).toContain(
      'شناور، نیازمند تأیید رزرو',
    );
    const tickets = reservationTickets({
      version: 1,
      requestId: 'request',
      contractId: 'contract',
      contractNumber: 'SAMPLE',
      contractVersion: 1,
      customerId: 'customer',
      passengerIds: ['passenger'],
      passengerAssignments: [
        {
          customerId: 'passenger',
          displayNameSnapshot: 'Sample',
          ageCategory: 'ADT',
          serviceClientKeys: ['flight-outbound'],
        },
      ],
      serviceSelections: output.contract.servicesDetail,
      selectedTicketOfferIds: [],
      hotelSelection: null,
      ticketSelections: [],
      createdAt: '2026-10-01T00:00:00Z',
    });
    expect(tickets[0]?.offers[0]).toMatchObject({
      serviceNumber: 'FLOAT123',
      contractOnly: true,
    });
  });
});

it('cancels a floating outbound without losing the other direction or leaving its price', () => {
  const current = {
    ...state,
    contractFlights: { OUTBOUND: draft, RETURN: draft },
    servicePricing: {
      'flight-outbound': {} as never,
      'flight-return': {} as never,
    },
  };
  let next: SalesFormState = current;
  const editor = ContractFlightEditor({
    value: draft,
    onChange: (flight) => {
      next = { ...next, ...patchContractFlight(next, 'OUTBOUND', flight) };
    },
  });
  editor.props.children[0].props.children[1].props.onClick();
  expect(next.contractFlights?.OUTBOUND).toBeUndefined();
  expect(next.contractFlights?.RETURN).toEqual(draft);
  expect(next.servicePricing).toEqual({ 'flight-return': {} });
  expect(
    renderToStaticMarkup(
      createElement(ContractFlightEditor, {
        value: next.contractFlights?.OUTBOUND,
        onChange: () => undefined,
      }),
    ),
  ).toContain('افزودن بلیط شناور');
  expect(salesFlightSelection(next, 'OUTBOUND')).toBeUndefined();
});

it('keeps an entered manual fare while editing its flight details', () => {
  const pricing = { 'flight-outbound': {} as never };
  expect(
    patchContractFlight({ ...state, servicePricing: pricing }, 'OUTBOUND', {
      ...draft,
      serviceNumber: 'EDITED',
    }).servicePricing,
  ).toBe(pricing);
});

it('restored floating selections are ready without transient catalog search state', () => {
  expect(salesSelectedFlightsReady(state)).toBe(true);
  expect(salesSelectedFlightsReady({ ...state, contractFlights: {} })).toBe(
    false,
  );
  expect(
    salesSelectedFlightsReady({
      ...state,
      contractFlights: { OUTBOUND: { ...draft, serviceNumber: '' } },
    }),
  ).toBe(false);
  expect(salesSelectedFlightsReady({ ...state, tripType: 'ROUND_TRIP' })).toBe(
    false,
  );
  expect(
    salesSelectedFlightsReady({
      ...state,
      tripType: 'ROUND_TRIP',
      contractFlights: {
        OUTBOUND: draft,
        RETURN: {
          ...draft,
          departureAt: '2026-10-02T10:30:00',
          arrivalAt: '2026-10-02T13:30:00',
        },
      },
    }),
  ).toBe(true);
});

it('does not require an unused return when every confirmed passenger excludes that leg', () => {
  expect(
    salesSelectedFlightsReady({
      ...state,
      tripType: 'ROUND_TRIP',
      passengers: [
        {
          customerId: 'synthetic',
          displayName: 'Synthetic Person',
          birthDate: '1990-01-01',
        },
      ],
      passengerFlightDirections: { synthetic: ['OUTBOUND'] },
    }),
  ).toBe(true);
});

it('confirms overnight floating tickets through the button and builds a contract without inventory selection', () => {
  const confirm = (date: string, value: typeof draft) => {
    let result: ContractFlightDraft = value;
    const editor = ContractFlightEditor({
      value,
      flightDate: date,
      onChange: (next) => {
        if (next) result = next;
      },
    });
    const button = editor.props.children[3];
    expect(button.props.type).toBe('button');
    button.props.onClick();
    return result;
  };
  const outbound = confirm('2027-09-01', {
    ...draft,
    departureAt: '2027-08-01T01:08',
    arrivalAt: '2027-08-01T00:02',
  });
  const returning = confirm('2027-09-14', {
    ...draft,
    departureAt: '2027-08-01T00:30',
    arrivalAt: '2027-08-01T08:09',
  });
  expect(outbound.arrivalAt).toBe('2027-09-02T00:02');
  const confirmed = {
    ...state,
    tripType: 'ROUND_TRIP' as const,
    contractFlights: { OUTBOUND: outbound, RETURN: returning },
  };
  expect(salesSelectedFlightsReady(confirmed)).toBe(true);
  expect(salesFlightsValid(confirmed)).toBe(true);
  const payload = salesPayload(confirmed);
  expect(payload.ticketSelections).toEqual([]);
  expect(salesContractOnlyFlights(payload.services)).toHaveLength(2);
  expect(JSON.stringify(payload)).not.toContain('confirmation');
});

it('rejects a floating return after a company-inventory outbound', () => {
  const outboundOffer = {
    id: 'company',
    originId,
    destinationId,
    departureAt: '2026-10-01T06:00:00Z',
    arrivalAt: '2026-10-01T08:00:00Z',
    carrierName: 'Air',
    serviceNumber: '123',
    cabinClassCode: 'ECONOMY',
    availableCapacity: 10,
    remainingCapacity: 10,
  } as unknown as NonNullable<SalesFormState['outboundOffer']>;
  const mixed: SalesFormState = {
    ...state,
    tripType: 'ROUND_TRIP',
    outboundOffer,
    contractFlights: {
      RETURN: {
        ...draft,
        departureAt: '2026-10-02T10:30:00',
        arrivalAt: '2026-10-02T13:30:00',
      },
    },
  };
  expect(salesFlightsValid(mixed)).toBe(false);
  expect(salesSelectedFlightsReady(mixed)).toBe(false);
});
