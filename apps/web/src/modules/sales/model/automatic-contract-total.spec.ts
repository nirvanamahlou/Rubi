import { expect, it } from 'vitest';
import { contractSaleComponents, emptySalesForm } from './sales-form';
it('automatically sums passenger flights and each room independently by currency', () => {
  const result = contractSaleComponents({
    ...emptySalesForm,
    automaticComponentPricing: true,
    serviceKinds: ['FLIGHT', 'HOTEL'],
    passengers: [
      { customerId: 'p', displayName: 'TEST', birthDate: '1990-01-01' },
    ],
    passengerFlightPrices: {
      p: [
        { amount: '100', currencyCode: 'IRR' },
        { amount: '5', currencyCode: 'USD' },
      ],
    },
    contractPrices: [{ amount: '99999', currencyCode: 'IRR' }],
    hotel: {
      ...emptySalesForm.hotel,
      rooms: [
        {
          ordinal: 1,
          roomTypeId: 'double',
          roomTypeNameSnapshot: 'DOUBLE',
          adults: 2,
          childAges: [],
          agreedPrice: { amount: '100', currencyCode: 'USD' },
        },
      ],
    },
  });
  expect(result.map((p) => [p.currencyCode, p.amount])).toEqual([
    ['IRR', '100'],
    ['USD', '105'],
  ]);
});
