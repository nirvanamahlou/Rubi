import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { ReservationHotelPurchase } from './reservation-hotel-purchase';

vi.mock('../hotel-rates/controls', () => ({
  Lookup: ({ kind, label }: { kind: string; label: string }) => (
    <span data-source={kind}>{label}</span>
  ),
}));

it('uses independent registered broker choices for hotel and both transfer legs', () => {
  const html = renderToStaticMarkup(
    <ReservationHotelPurchase
      request={
        {
          id: 'synthetic',
          snapshot: {
            contractNumber: 'SYNTHETIC',
            passengerIds: [],
            serviceSelections: [
              { clientKey: 'hotel', kind: 'HOTEL', titleSnapshot: 'Hotel' },
              { clientKey: 'out', kind: 'TRANSFER', titleSnapshot: 'Outbound' },
              { clientKey: 'back', kind: 'TRANSFER', titleSnapshot: 'Return' },
            ],
            hotelSelection: {
              serviceClientKey: 'hotel',
              hotelNameSnapshot: 'Hotel',
              checkIn: '2099-10-01',
              checkOut: '2099-10-03',
            },
          },
        } as never
      }
      onSaved={() => undefined}
    />,
  );
  expect(html).toContain('data-source="brokers"');
  expect(html).not.toContain('data-source="organizations"');
  expect(html).toContain('کارگزار هتل');
});
