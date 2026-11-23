import { expect, it } from 'vitest';
import {
  websitePassengerFlightPrices,
  type WebsiteFlightQuote,
} from './ticket-quote';

it('maps a booked round-trip fare once, using each passenger age and saved tier', () => {
  const quotes: WebsiteFlightQuote[] = [
    {
      amount: '97.50',
      currencyCode: 'IRR',
      pricingBreakdown: {
        version: 1,
        coverage: 'round_trip',
        currencyCode: 'IRR',
        totalAmount: '195.00',
        passengers: [
          { category: 'ADT', amount: '80.00' },
          { category: 'ADT', amount: '90.00' },
          { category: 'CHD', amount: '25.00' },
          { category: 'INF', amount: '0.00' },
        ],
      },
    },
    { amount: '97.50', currencyCode: 'IRR' },
  ];
  expect(
    websitePassengerFlightPrices(quotes, [
      { customerId: 'child', category: 'CHD' },
      { customerId: 'adult1', category: 'ADT' },
      { customerId: 'infant', category: 'INF' },
      { customerId: 'adult2', category: 'ADT' },
    ]),
  ).toEqual({
    child: [{ amount: '25.00', currencyCode: 'IRR' }],
    adult1: [{ amount: '80.00', currencyCode: 'IRR' }],
    infant: [{ amount: '0.00', currencyCode: 'IRR' }],
    adult2: [{ amount: '90.00', currencyCode: 'IRR' }],
  });
});
