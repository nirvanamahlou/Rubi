import { expect, it } from 'vitest';
import {
  contractSaleComponents,
  emptySalesForm,
  withSalesHotelDates,
  type SalesFormState,
} from './sales-form';
it('records the salesperson discount without changing negotiated values or summing hotel alternatives', () => {
  const state = {
    ...emptySalesForm,
    automaticComponentPricing: true,
    serviceKinds: [],
    contractPrices: [
      { currencyCode: 'EUR', amount: '110.20' },
      { currencyCode: 'IRR', amount: '9007199254740993' },
    ],
    packageSaleQuote: {
      tourDepartureId: 'tour',
      selectionKey: 'key',
      items: [],
      prices: [
        { currencyCode: 'EUR', amount: '123.45' },
        { currencyCode: 'IRR', amount: '9007199254740993' },
      ],
    },
  };
  expect(contractSaleComponents(state)).toEqual([
    {
      type: 'BASE',
      title: 'قیمت منتشرشده پکیج',
      currencyCode: 'EUR',
      amount: '123.45',
    },
    {
      type: 'DISCOUNT',
      title: 'تخفیف فروشنده',
      currencyCode: 'EUR',
      amount: '13.25',
    },
    {
      type: 'BASE',
      title: 'مبلغ کل قرارداد',
      currencyCode: 'IRR',
      amount: '9007199254740993',
    },
  ]);
  expect(state.contractPrices[0]?.amount).toBe('110.20');
});

it('keeps published-package automatic dates stable across later room changes', () => {
  const state = {
    ...emptySalesForm,
    packageSaleAvailable: true,
    tour: { startsOn: '2026-10-01', endsOn: '2026-10-03' } as NonNullable<
      SalesFormState['tour']
    >,
    hotel: {
      ...emptySalesForm.hotel,
      checkIn: '2026-10-01',
      checkOut: '2026-10-03',
      checkInManual: false,
      checkOutManual: false,
    },
  };
  expect(
    withSalesHotelDates(state, {
      ...state,
      hotel: { ...state.hotel, roomCount: 2 },
    }).hotel.checkIn,
  ).toBe('2026-10-01');
  const manual = {
    ...state,
    hotel: { ...state.hotel, checkIn: '2026-10-02', checkInManual: true },
  };
  expect(withSalesHotelDates(manual, manual).hotel.checkIn).toBe('2026-10-02');
});
