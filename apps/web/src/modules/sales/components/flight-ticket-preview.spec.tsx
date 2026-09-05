import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FlightTicketDocument } from './flight-ticket-preview';
import { emptySalesForm } from '../model/sales-form';

describe('flight ticket output template', () => {
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
      'FARE &amp; PAYMENT DETAILS',
      'NOTICE',
      'DRAFT',
      'RLOC',
      'E-Ticket No',
      'Synthetic Passenger',
    ])
      expect(html).toContain(label);
    expect(html).not.toContain('7143');
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
