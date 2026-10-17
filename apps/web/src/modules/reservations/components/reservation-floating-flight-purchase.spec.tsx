import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReservationFloatingFlightPurchase } from './reservation-floating-flight-purchase';
const request = (metadata: Record<string, string | number>) => ({
  id: 'request',
  purchaseVersion: 0,
  snapshot: {
    serviceSelections: [
      {
        clientKey: 'flight',
        kind: 'FLIGHT',
        titleSnapshot: 'SYNTHETIC FLIGHT',
        metadata,
      },
    ],
  },
});
describe('contract floating flight purchase', () => {
  it.each([{ purchaseSupplyType: 'FLOATING' }, { contractFlightVersion: 1 }])(
    'offers contract total purchase without nights for %j',
    (metadata) => {
      const html = renderToStaticMarkup(
        <ReservationFloatingFlightPurchase
          request={
            request(metadata as Record<string, string | number>) as never
          }
          onSaved={() => {}}
        />,
      );
      expect(html).toContain('SYNTHETIC FLIGHT');
      expect(html).toContain('هزینه کل خرید بلیط');
      expect(html).not.toContain('تعداد شب');
    },
  );
  it.each(['COMPANY', 'API', 'UNKNOWN'])(
    'does not ask for a contract purchase for %s',
    (type) => {
      expect(
        renderToStaticMarkup(
          <ReservationFloatingFlightPurchase
            request={request({ purchaseSupplyType: type }) as never}
            onSaved={() => {}}
          />,
        ),
      ).toBe('');
    },
  );
});
