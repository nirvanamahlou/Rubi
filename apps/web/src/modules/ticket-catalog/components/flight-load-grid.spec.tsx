import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import { FlightLoadGrid } from './flight-load-grid';

describe('flight load search entry', () => {
  it('does not expose flight rows or management actions before an explicit search', () => {
    const flight = {
      id: 'flight',
      supplyType: 'COMPANY',
      originId: 'a',
      destinationId: 'b',
      departureAt: '2099-10-01T10:00:00Z',
      arrivalAt: '2099-10-01T12:00:00Z',
      carrierName: 'Synthetic Air',
    } as TicketOfferV1;
    const html = renderToStaticMarkup(
      <FlightLoadGrid
        offers={[flight]}
        cityName={(id) => id}
        refreshing={false}
        onRefresh={() => {}}
        renderActions={() => <button>Manage selected flight</button>}
      />,
    );
    expect(html).toContain('تاریخ‌های معتبر');
    expect(html).toContain('لود پرواز چارتر');
    expect(html).toMatch(/type="checkbox" checked=""/);
    expect(html).toContain('جست‌وجو');
    expect(html).toContain('load-country');
    expect(html).toContain('شهر');
    expect(html).not.toContain('load-origin');
    expect(html).not.toContain('<table');
    expect(html).not.toContain('Manage selected flight');
  });
});
