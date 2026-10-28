import { describe, expect, it } from 'vitest';
import { readPassengerHotelPrices } from './passenger-flight-prices';

const hotel = (metadata: Record<string, unknown>) => [
  {
    clientKey: 'hotel',
    kind: 'HOTEL' as const,
    titleSnapshot: 'Hotel',
    metadata,
  },
];

describe('legacy passenger hotel price allocations', () => {
  it('ignores an allocation for a changed hotel guest roster without mutating the snapshot', () => {
    const snapshot = JSON.stringify({
      guestA: [{ amount: '50', currencyCode: 'USD' }],
    });
    const services = hotel({ passengerHotelPricesV1: snapshot });

    expect(
      readPassengerHotelPrices(services, [
        { customerId: 'guestA', serviceClientKeys: ['hotel'] },
        { customerId: 'guestB', serviceClientKeys: ['hotel'] },
      ]),
    ).toBeUndefined();
    expect(services[0]!.metadata!.passengerHotelPricesV1).toBe(snapshot);
  });

  it('continues to return and validate a matching hotel guest allocation', () => {
    const prices = JSON.stringify({
      guestA: [{ amount: '50', currencyCode: 'USD' }],
    });

    expect(
      readPassengerHotelPrices(hotel({ passengerHotelPricesV1: prices }), [
        { customerId: 'guestA', serviceClientKeys: ['hotel'] },
      ]),
    ).toEqual({
      guestA: [{ amount: '50', currencyCode: 'USD' }],
    });
  });
});
