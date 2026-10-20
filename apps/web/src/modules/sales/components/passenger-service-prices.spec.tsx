import { beforeEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PassengerServicePrices } from './passenger-service-prices';
import { emptySalesForm } from '../model/sales-form';
const fields = vi.hoisted(() => ({
  money: [] as {
    'aria-label': string;
    value: string;
    onValueChange: (value: string) => void;
  }[],
  currency: [] as {
    label: string;
    value: string;
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
  defaultSalesCurrency: () => 'IRR',
  SalesCurrencySelect: (props: (typeof fields.currency)[number]) => {
    fields.currency.push(props);
    return (
      <select aria-label={props.label} value={props.value} onChange={() => {}}>
        <option value="IRR">IRR</option>
        <option value="USD">USD</option>
      </select>
    );
  },
}));
beforeEach(() => {
  fields.money = [];
  fields.currency = [];
});
const state = {
  ...emptySalesForm,
  serviceKinds: ['FLIGHT', 'HOTEL'] as typeof emptySalesForm.serviceKinds,
  departureDate: '2026-10-19',
  passengers: [
    { customerId: 'a', displayName: 'Adult', birthDate: '1990-01-01' },
    { customerId: 'b', displayName: 'Child', birthDate: '2020-01-01' },
  ],
  passengerFlightDirections: { a: ['OUTBOUND'] as ['OUTBOUND'], b: [] },
  hotel: { ...emptySalesForm.hotel, guestCustomerIds: ['a', 'b'] },
  passengerFlightPrices: { a: [{ currencyCode: 'IRR', amount: '100' }] },
  passengerHotelPrices: {
    a: [{ currencyCode: 'USD', amount: '20' }],
    b: [{ currencyCode: 'IRR', amount: '30' }],
  },
};
it('uses one combined table with one currency amount per service, including IRR, and age second', () => {
  const html = renderToStaticMarkup(
    <PassengerServicePrices state={state} currencies={[]} onChange={vi.fn()} />,
  );
  expect((html.match(/<table/g) || []).length).toBe(1);
  expect(html).toContain('قیمت ارزی');
  expect(html).not.toContain('قیمت ریالی');
  expect(html).toContain('کودک');
  expect(html).toContain('رفت');
  expect([...html.matchAll(/<th[^>]*>(.*?)<\/th>/g)][1]?.[1]).toBe('رده سنی');
  expect(
    fields.money.find((p) => p['aria-label'] === 'قیمت پرواز Child'),
  ).toBeUndefined();
  expect(fields.currency.find((p) => p.label === 'ارز هتل Child')?.value).toBe(
    'IRR',
  );
});
it('replaces the single selected service currency and persists each deduction independently', () => {
  const onChange = vi.fn();
  renderToStaticMarkup(
    <PassengerServicePrices
      state={state}
      currencies={[]}
      onChange={onChange}
    />,
  );
  fields.currency.find((p) => p.label === 'ارز پرواز Adult')!.onChange('USD');
  expect(onChange).toHaveBeenLastCalledWith({
    passengerFlightPrices: { a: [{ amount: '100', currencyCode: 'USD' }] },
  });
  fields.money
    .find((p) => p['aria-label'] === 'تخفیف Adult')!
    .onValueChange('10');
  expect(onChange).toHaveBeenLastCalledWith({
    passengerDeductions: {
      a: { discount: { amount: '10', currencyCode: 'IRR' } },
    },
  });
});

it('edits the different-stay amount in pricing/payment using the existing hotel allocation exactly once', () => {
  const onChange = vi.fn();
  const html = renderToStaticMarkup(
    <PassengerServicePrices
      state={{
        ...state,
        passengerHotelStays: {
          a: { different: true, checkIn: '2026-11-02', checkOut: '2026-11-04' },
        },
      }}
      currencies={[]}
      onChange={onChange}
    />,
  );
  expect(html).toContain('مبلغ اقامت متفاوت');
  const price = fields.money.find(
    (f) => f['aria-label'] === 'مبلغ اقامت متفاوت Adult',
  )!;
  expect(price.value).toBe('20');
  price.onValueChange('45');
  expect(onChange).toHaveBeenLastCalledWith({
    passengerHotelPrices: {
      ...state.passengerHotelPrices,
      a: [{ currencyCode: 'USD', amount: '45' }],
    },
  });
});
