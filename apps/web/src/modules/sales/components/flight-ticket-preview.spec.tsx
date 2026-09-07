import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FlightTicketDocument } from './flight-ticket-preview';
import { emptySalesForm } from '../model/sales-form';
import type { TicketOfferV1 } from '@rubi/contracts';

const demoOffer: TicketOfferV1 = {
  id: 'demo',
  version: 1,
  branchId: 'test',
  originId: 'a',
  destinationId: 'b',
  departureAt: '2026-09-19T07:00:00Z',
  arrivalAt: '2026-09-19T10:00:00Z',
  carrierName: 'TEST AIRLINE — آزمایشی',
  serviceNumber: 'TEST-AYT-01',
  cabinClassCode: 'ECONOMY',
  totalCapacity: 20,
  remainingCapacity: 20,
  status: 'ACTIVE',
};

describe('flight ticket output template', () => {
  it('shows explicitly marked demo identifiers and airline logo for test flights only', () => {
    const html = renderToStaticMarkup(
      <FlightTicketDocument
        state={{
          ...emptySalesForm,
          serviceKinds: ['FLIGHT'],
          serviceDirections: { FLIGHT: ['OUTBOUND'] },
          outboundOffer: demoOffer,
        }}
        cities={[]}
        passengerName="Synthetic Passenger"
      />,
    );
    expect(html).toContain('7143');
    expect(html).toContain('DEMO01');
    expect(html).toContain('SAMPLE DATA');
    expect(html).toContain('NOT VALID FOR TRAVEL');
    expect(html).toContain('لوگوی آزمایشی');
    expect(html).not.toContain('PAYMENT');
    expect(html).not.toContain('Fare Base');
    expect(html).toContain('width="210"');
  });
  it.each([
    { ...demoOffer, carrierName: 'Real airline' },
    { ...demoOffer, serviceNumber: 'REAL-123' },
  ])('never supplies sample issuance data for non-demo offers', (offer) => {
    const html = renderToStaticMarkup(
      <FlightTicketDocument
        state={{
          ...emptySalesForm,
          serviceKinds: ['FLIGHT'],
          serviceDirections: { FLIGHT: ['OUTBOUND'] },
          outboundOffer: offer,
        }}
        cities={[]}
        passengerName="Synthetic Passenger"
      />,
    );
    expect(html).not.toContain('7143');
    expect(html).not.toContain('DEMO01');
    expect(html).not.toContain('لوگوی آزمایشی');
  });
  it('prints directional transfer inclusion without requiring details', () => {
    const html = renderToStaticMarkup(
      <FlightTicketDocument
        state={{
          ...emptySalesForm,
          serviceKinds: ['TRANSFER'],
          serviceDirections: { TRANSFER: ['RETURN'] },
        }}
        cities={[]}
        passengerName="Synthetic Passenger"
      />,
    );
    expect(html).toContain('TRANSFER INCLUDED:');
    expect(html).toContain('RETURN');
  });
  it('renders reference sections without fabricating issuance or sample passenger data', () => {
    const html = renderToStaticMarkup(
      <FlightTicketDocument
        state={emptySalesForm}
        cities={[]}
        passengerName="Synthetic Passenger"
      />,
    );
    for (const label of [
      'FLIGHT TICKET',
      'FLIGHT INFORMATION',
      'NOTICE',
      'DRAFT',
      'RLOC',
      'E-Ticket No',
      'Synthetic Passenger',
    ])
      expect(html).toContain(label);
    expect(html).not.toContain('7143');
    expect(html).not.toContain('PAYMENT');
    expect(html).not.toContain('DAVOUDI');
    expect(html).not.toContain('BUSINESS');
  });
  it('prints BUSINESS only when the output checkbox is selected', () => {
    const html = renderToStaticMarkup(
      <FlightTicketDocument
        state={{ ...emptySalesForm, businessOutput: true }}
        cities={[]}
        passengerName="Synthetic Passenger"
      />,
    );
    expect(html).toContain('BUSINESS');
    expect(html).toContain('NOT VALID FOR TRAVEL');
  });
});
