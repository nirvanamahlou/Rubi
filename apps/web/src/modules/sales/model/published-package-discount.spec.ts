import { expect, it } from 'vitest';
import { contractSaleComponents, emptySalesForm } from './sales-form';
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
