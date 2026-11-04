import { beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PassengerServicePrices } from './passenger-service-prices';
import { emptySalesForm } from '../model/sales-form';
const fields = vi.hoisted(() => ({
  money: [] as {
    'aria-label': string;
    value: string;
    disabled?: boolean;
    onValueChange: (value: string) => void;
  }[],
  currency: [] as {
    label: string;
    value: string;
    currencies: { code: string }[];
    onChange: (value: string) => void;
  }[],
}));
vi.mock('@/components/ui/money-input', () => ({
  formatSalesMoney: (v: string) => v,
  MoneyInput: (props: (typeof fields.money)[number]) => {
    fields.money.push(props);
    return (
      <input aria-label={props['aria-label']} value={props.value} readOnly />
    );
  },
}));
vi.mock('./sales-currency-select', () => ({
  SalesCurrencySelect: (props: (typeof fields.currency)[number]) => {
    fields.currency.push(props);
    return <span>{props.label}</span>;
  },
}));
vi.mock('@/i18n/locale-context', () => ({ useDisplayLanguage: () => 'fa' }));
beforeEach(() => {
  fields.money = [];
  fields.currency = [];
});
const state = {
  ...emptySalesForm,
  passengerTotalPricing: true,
  serviceKinds: ['FLIGHT', 'HOTEL'] as typeof emptySalesForm.serviceKinds,
  departureDate: '2026-10-19',
  passengers: [
    {
      customerId: 'a',
      displayName: 'Full Passport Name',
      birthDate: '1990-01-01',
    },
    { customerId: 'b', displayName: 'Child Name', birthDate: '2020-01-01' },
  ],
  passengerFlightDirections: { a: ['OUTBOUND'] as ['OUTBOUND'], b: [] },
  hotel: {
    ...emptySalesForm.hotel,
    guestCustomerIds: ['a'],
    checkIn: '2026-11-01',
    checkOut: '2026-11-08',
  },
  passengerFlightPrices: { a: [{ currencyCode: 'IRR', amount: '100' }] },
  passengerHotelPrices: { a: [{ currencyCode: 'USD', amount: '20' }] },
  passengerPrices: { b: [{ currencyCode: 'IRR', amount: '0' }] },
  passengerHotelStays: {
    a: { different: true, checkIn: '2026-11-02', checkOut: '2026-11-07' },
  },
};
it('shows complete names once, actual services and individual hotel dates, with fixed IRR and default USD', () => {
  const html = renderToStaticMarkup(
    <PassengerServicePrices
      state={state}
      currencies={[
        { code: 'IRR', name: 'ریال', status: 'active' },
        { code: 'USD', name: 'Dollar', status: 'active' },
      ]}
      onChange={vi.fn()}
    />,
  );
  expect(html).toContain('قیمت کل خدمات هر مسافر');
  expect(html).toContain('خدمات');
  expect(html).toContain('قیمت ریالی');
  expect(html).toContain('قیمت ارزی');
  expect(html).toContain('صفر ریال');
  expect((html.match(/Full Passport Name/g) ?? []).length).toBe(1);
  expect(html).toContain('پرواز رفت');
  expect(html).toContain('dateTime="2026-11-02"');
  expect(html).toContain('dateTime="2026-11-07"');
  expect(html).not.toContain('ارز هتل');
  expect(html).not.toContain('ارز پرواز');
  expect(fields.currency.every((f) => !f.label.includes('Name'))).toBe(true);
  expect(
    fields.currency
      .filter((f) => f.label === 'نوع ارز')
      .every(
        (f) => f.value === 'USD' && f.currencies.every((c) => c.code !== 'IRR'),
      ),
  ).toBe(true);
  expect(
    fields.money.filter((f) => f['aria-label'] === 'قیمت ریالی'),
  ).toHaveLength(2);
});
it('edits total prices without assigning the amount to flight/hotel and retains the other currency', () => {
  const onChange = vi.fn();
  renderToStaticMarkup(
    <PassengerServicePrices
      state={state}
      currencies={[]}
      onChange={onChange}
    />,
  );
  fields.money
    .find((p) => p['aria-label'] === 'قیمت ریالی')!
    .onValueChange('250');
  expect(onChange).toHaveBeenLastCalledWith({
    passengerPrices: {
      ...state.passengerPrices,
      a: [
        { currencyCode: 'USD', amount: '20' },
        { currencyCode: 'IRR', amount: '250' },
      ],
    },
  });
  fields.currency.find((p) => p.label === 'نوع ارز')!.onChange('EUR');
  expect(onChange).toHaveBeenLastCalledWith({
    passengerPrices: {
      ...state.passengerPrices,
      a: [
        { currencyCode: 'IRR', amount: '100' },
        { currencyCode: 'EUR', amount: '20' },
      ],
    },
  });
  fields.money.find((p) => p['aria-label'] === 'تخفیف')!.onValueChange('10');
  expect(onChange).toHaveBeenLastCalledWith({
    passengerDeductions: {
      a: { discount: { currencyCode: 'IRR', amount: '10' } },
    },
  });
});
it('reports deductions above the same-person same-currency total', () => {
  const html = renderToStaticMarkup(
    <PassengerServicePrices
      state={{
        ...state,
        passengerDeductions: {
          a: { discount: { currencyCode: 'IRR', amount: '101' } },
        },
      }}
      currencies={[]}
      onChange={vi.fn()}
    />,
  );
  expect(html).toContain('تخفیف و کمیسیون نباید از قیمت همان مسافر');
});

it('shows only each passenger’s selected transfer legs and added services', () => {
  const html = renderToStaticMarkup(
    <PassengerServicePrices
      state={{
        ...state,
        tripType: 'ROUND_TRIP',
        serviceKinds: ['FLIGHT', 'HOTEL', 'TRANSFER'],
        serviceDirections: { TRANSFER: ['OUTBOUND', 'RETURN'] },
        passengerTransferDirections: { a: ['RETURN'], b: [] },
        additionalServices: ['CITY_TOUR', 'TOUR_GUIDE'],
      }}
      currencies={[]}
      onChange={vi.fn()}
    />,
  );
  expect((html.match(/ترانسفر برگشت/g) ?? []).length).toBe(1);
  expect(html).not.toContain('ترانسفر رفت');
  expect(html).toContain('گشت شهری');
  expect(html).toContain('راهنما');
});

it('prices a different stay in the payment row total without a second hotel charge', () => {
  const onChange = vi.fn();
  const html = renderToStaticMarkup(
    <PassengerServicePrices
      state={state}
      currencies={[]}
      onChange={onChange}
    />,
  );
  expect(html).toContain('اقامت متفاوت');
  const price = fields.money.find((f) => f['aria-label'] === 'قیمت ارزی')!;
  expect(price.value).toBe('20');
  price.onValueChange('45');
  expect(onChange).toHaveBeenLastCalledWith({
    passengerPrices: {
      ...state.passengerPrices,
      a: [
        { currencyCode: 'IRR', amount: '100' },
        { currencyCode: 'USD', amount: '45' },
      ],
    },
  });
  expect(onChange.mock.calls[0]![0]).not.toHaveProperty('passengerHotelPrices');
});
it('uses the shared Gregorian hotel choice for payment-table stay dates', () => {
  const html = renderToStaticMarkup(
    <PassengerServicePrices
      state={{
        ...state,
        hotel: { ...state.hotel, calendarSystem: 'gregorian' },
      }}
      currencies={[]}
      onChange={vi.fn()}
    />,
  );
  expect(html).toContain('2 Nov 2026');
  expect(html).toContain('7 Nov 2026');
});
