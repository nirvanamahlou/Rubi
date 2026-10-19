import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import { FlightSummary } from './ticket-prices-workspace';
it('renders an international card with a Gregorian date', () => {
  const html = renderToStaticMarkup(
    <FlightSummary
      direction="رفت"
      cityCountries={{ tehran: 'IR', antalya: 'TR' }}
      offer={
        {
          originId: 'tehran',
          destinationId: 'antalya',
          departureAt: '2026-10-19T07:00:00Z',
          carrierName: 'TEST',
          serviceNumber: '42',
          cabinClassCode: 'ECONOMY',
          remainingCapacity: 3,
          totalCapacity: 4,
        } as TicketOfferV1
      }
    />,
  );
  expect(html).toContain('19 October 2026');
  expect(html).toContain('TEST');
});
