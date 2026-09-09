import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import {
  contractFlightMetadata,
  salesContractOnlyFlights,
} from '@rubi/contracts';
import {
  emptySalesForm,
  patchContractFlight,
  salesFlightSelection,
  salesFlightsValid,
  salesPayload,
  salesTravelDate,
  withSalesHotelDates,
  type SalesFormState,
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
    expect(next.hotel.checkIn).toBe('2026-10-02');
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
    expect(html).toContain('تاریخ و ساعت حرکت');
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
