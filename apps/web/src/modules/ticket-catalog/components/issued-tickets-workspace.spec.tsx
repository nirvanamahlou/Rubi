import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { IssuedTicketsWorkspace } from './issued-tickets-workspace';
describe('issued passenger ticket exports', () => {
  it('keeps the defined flight time visible when the report also includes hotel context', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-09T12:00:00Z'));
    try {
      const html = renderToStaticMarkup(
        <IssuedTicketsWorkspace
          tickets={[
            {
              id: 'test',
              contractNumber: '001234',
              passengerDisplayName: 'Synthetic Passenger',
              ticketNumber: '0001',
              pnr: null,
              originCityId: 'a',
              origin: 'Origin',
              destinationCityId: 'b',
              destination: 'Destination',
              airlineId: 'airline',
              airline: 'Airline',
              issuedAt: '2026-11-09T10:00:00Z',
              departureAt: '2026-11-09T21:00:00Z',
              status: 'issued',
              serviceKind: 'FLIGHT',
              serviceTitle: 'T100',
              hotelId: 'hotel',
              hotelName: 'Synthetic Hotel',
              checkInDate: '2026-11-11',
              checkOutDate: '2026-11-15',
            },
          ]}
        />,
      );
      expect(html).toContain('2026-11-10 00:30');
      expect(html).not.toContain('2026-11-11');
      expect(html).not.toContain('2026-11-15');
      expect(html).toContain('T100');
    } finally {
      vi.useRealTimers();
    }
  });
  it('offers both server exports and mandatory issuance dates', () => {
    const html = renderToStaticMarkup(<IssuedTicketsWorkspace tickets={[]} />);
    expect(html).toContain('دانلود اکسل');
    expect(html).toContain('دانلود PDF');
    expect(html).toContain('صدور از تاریخ');
    expect(html).toContain('صدور تا تاریخ');
    expect(html).not.toContain('انتخاب بازه تاریخ صدور برای خروجی الزامی است');
  });
});
