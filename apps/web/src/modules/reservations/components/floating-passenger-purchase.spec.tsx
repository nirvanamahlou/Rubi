import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReservationIntakeV1 } from '@nora/contracts';
vi.mock('./reservation-currencies', () => ({
  useReservationCurrencies: () => ({
    currencies: [{ code: 'USD', name: 'Dollar' }],
    loading: false,
    error: '',
  }),
  ReservationCurrencySelect: ({ label }: { label: string }) => (
    <select aria-label={label}>
      <option>USD</option>
    </select>
  ),
}));
vi.mock('./reservation-purchase-broker-lookup', () => ({
  ReservationPurchaseBrokerLookup: () => <div>Agency</div>,
}));
import {
  FloatingPassengerPurchase,
  passengerPurchaseTotals,
} from './floating-passenger-purchase';
it('sums purchase currencies independently using decimal arithmetic', () => {
  expect(
    passengerPurchaseTotals([
      {
        customerId: 'a',
        rialAmount: '10.0001',
        foreignAmount: '2',
        currencyCode: 'USD',
      },
      {
        customerId: 'b',
        rialAmount: '0.0002',
        foreignAmount: '3',
        currencyCode: 'USD',
      },
    ]),
  ).toEqual([
    { currencyCode: 'IRR', amount: '10.0003' },
    { currencyCode: 'USD', amount: '5' },
  ]);
});
it('shows names, both child bands and separate rial and foreign purchase inputs', () => {
  const request = {
    id: 'request',
    snapshot: {
      passengerAssignments: [
        {
          customerId: 'a',
          displayNameSnapshot: 'Child A',
          ageCategory: 'CHD',
          childAgeBand: 'AGE_2_6',
        },
        {
          customerId: 'b',
          displayNameSnapshot: 'Child B',
          ageCategory: 'CHD',
          childAgeBand: 'AGE_6_12',
        },
      ],
    },
  } as unknown as ReservationIntakeV1;
  const html = renderToStaticMarkup(
    <FloatingPassengerPurchase
      request={request}
      purchaseRoot="sales/contracts/id/purchases"
      onSaved={() => {}}
    />,
  );
  for (const value of [
    'Child A',
    'Child B',
    'کودک ۲ تا ۶ سال',
    'کودک ۶ تا ۱۲ سال',
    'خرید ریالی مسافر 1',
    'خرید ارزی مسافر 2',
    'جمع کل خرید',
  ])
    expect(html).toContain(value);
});
