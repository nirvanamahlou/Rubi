import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { PassengerPackagePrices } from './passenger-package-prices';
import { emptySalesForm } from '../model/sales-form';
describe('Passenger whole-package price entry', () => {
  it('opens one price entry per selected person without inventing amounts', () => {
    const state = {
      ...emptySalesForm,
      passengers: [
        { customerId: 'one', displayName: 'First', birthDate: '1990-01-01' },
        { customerId: 'two', displayName: 'Second', birthDate: '2020-01-01' },
      ],
      priceComponents: [
        {
          type: 'BASE' as const,
          amount: '1000',
          currencyCode: 'IRR',
          title: 'Package',
        },
      ],
    };
    const html = renderToStaticMarkup(
      <PassengerPackagePrices state={state} onChange={vi.fn()} />,
    );
    expect(html).toContain('قیمت ریالی First');
    expect(html).toContain('قیمت ریالی Second');
    expect((html.match(/inputMode="decimal"/g) || []).length).toBe(4);
    expect(html).not.toContain('1,000');
    expect(html).toContain('قیمت ارزی');
    expect(html).toContain('value=""');
  });
});

it('offers independent rial and optional foreign flight amounts for each passenger', () => {
  const html = renderToStaticMarkup(
    <PassengerPackagePrices
      flight
      state={{
        ...emptySalesForm,
        passengers: [
          {
            customerId: 'p',
            displayName: 'PASSPORT NAME',
            birthDate: '1990-01-01',
          },
        ],
        passengerPrices: {
          p: [
            { amount: '100', currencyCode: 'IRR' },
            { amount: '', currencyCode: 'USD' },
          ],
        },
      }}
      onChange={vi.fn()}
    />,
  );
  expect(html).toContain('قیمت پرواز هر مسافر');
  expect(html).toContain('قیمت ریالی PASSPORT NAME');
  expect(html).toContain('قیمت ارزی PASSPORT NAME');
  expect(html).not.toContain('مبلغ معتبر با حداکثر');
});

it.each([1, 2])(
  'shows the hotel foreign price split across %i adults without a foreign flight input',
  (count) => {
    const passengers = Array.from({ length: count }, (_, i) => ({
      customerId: `adult-${i}`,
      displayName: `Adult ${i}`,
      birthDate: '1990-01-01',
    }));
    const html = renderToStaticMarkup(
      <PassengerPackagePrices
        flight
        state={{
          ...emptySalesForm,
          serviceKinds: ['FLIGHT', 'HOTEL'],
          passengers,
          passengerPrices: Object.fromEntries(
            passengers.map((p) => [
              p.customerId,
              [
                { amount: '15000', currencyCode: 'USD' },
                { amount: '25000000', currencyCode: 'IRR' },
              ],
            ]),
          ),
          hotel: {
            ...emptySalesForm.hotel,
            checkIn: '2026-11-23',
            guestCustomerIds: passengers.map((p) => p.customerId),
            rooms: [
              {
                ordinal: 1,
                roomTypeId: 'standard',
                roomTypeNameSnapshot: 'Standard',
                adults: count,
                childAges: [],
                agreedPrice: { amount: '25000', currencyCode: 'USD' },
              },
            ],
          },
        }}
        onChange={vi.fn()}
      />,
    );
    expect(html).toContain('سهم ارزی اتاق');
    expect(html).not.toContain('قیمت ارزی Adult');
    expect(html).not.toContain('15,000');
    expect(
      html.match(new RegExp(`${count === 1 ? '25,000' : '12,500'} \\$`, 'g')),
    ).toHaveLength(count);
  },
);
