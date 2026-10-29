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
        serviceKinds: ['FLIGHT'],
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
  expect(html).toContain('قیمت ریالی و ارزی هر مسافر');
  expect(html).toContain('قیمت ریالی PASSPORT NAME');
  expect(html).toContain('قیمت ارزی PASSPORT NAME');
  expect(html).not.toContain('مبلغ معتبر با حداکثر');
});

it('shows editable hotel currency amounts and the age as the second column', () => {
  const html = renderToStaticMarkup(
    <PassengerPackagePrices
      hotel
      state={{
        ...emptySalesForm,
        serviceKinds: ['HOTEL'],
        hotel: { ...emptySalesForm.hotel, guestCustomerIds: ['p'] },
        departureDate: '2026-10-19',
        passengers: [
          { customerId: 'p', displayName: 'Guest', birthDate: '2020-01-01' },
        ],
      }}
      onChange={vi.fn()}
    />,
  );
  expect(html).toContain('قیمت ارزی Guest');
  expect(html).toContain('کودک');
  const heads = [...html.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map((m) => m[1]);
  expect(heads[1]).toBe('رده سنی');
  expect(html).not.toContain('سهم ارزی اتاق');
});
