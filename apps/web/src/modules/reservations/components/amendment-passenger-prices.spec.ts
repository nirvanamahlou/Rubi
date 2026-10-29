import { expect, it } from 'vitest';
import {
  salesChequeComponents,
  SALES_CHEQUE_FEE,
  type SalesPaymentTerms,
  PASSENGER_TOTAL_PRICES,
  PASSENGER_DEDUCTIONS,
  validatePassengerTotalPricing,
  type SalesContractAmendmentV1,
} from '@nora/contracts';
import {
  amendmentPassengerGross,
  prepareAmendmentPersonPrices,
  amendmentPricingRows,
  applyAmendmentPassengerPrices,
} from './amendment-passenger-prices';
const gross = {
  a: [
    { amount: '100', currencyCode: 'USD' },
    { amount: '1000', currencyCode: 'IRR' },
  ],
  b: [{ amount: '50', currencyCode: 'USD' }],
};
const draft = {
  services: [
    {
      clientKey: 'hotel',
      kind: 'HOTEL',
      metadata: {
        passengerPackagePricingVersion: 1,
        [PASSENGER_TOTAL_PRICES]: JSON.stringify(gross),
      },
    },
  ],
  passengers: [
    { customerId: 'a', agreedPrices: gross.a },
    { customerId: 'b', agreedPrices: gross.b },
  ],
  priceComponents: [],
  hotelSelection: {
    rooms: [{ agreedPrice: { amount: '9999', currencyCode: 'USD' } }],
  },
} as unknown as SalesContractAmendmentV1;
it('normalizes saved rial/foreign totals and removes obsolete flight price requirements before correction submission', () => {
  const old = {
    ...draft,
    services: draft.services.map((s) => ({
      ...s,
      metadata: {
        ...s.metadata,
        automaticFlightRoomTotalV1: true,
        passengerFlightPricesV1: '{}',
        passengerHotelPricesV1: 'obsolete',
      },
    })),
  };
  const next = prepareAmendmentPersonPrices(old);
  expect(next.services[0]!.metadata).not.toHaveProperty(
    'automaticFlightRoomTotalV1',
  );
  expect(next.services[0]!.metadata).not.toHaveProperty(
    'passengerFlightPricesV1',
  );
  expect(next.services[0]!.metadata).not.toHaveProperty(
    'passengerHotelPricesV1',
  );
  expect(next.passengers.map((p) => p.agreedPrices)).toEqual(
    draft.passengers.map((p) => p.agreedPrices),
  );
  expect(() =>
    validatePassengerTotalPricing(next.services, next.passengers),
  ).not.toThrow();
});
it('edits each passenger gross and deductions once, without adding old room prices', () => {
  const next = applyAmendmentPassengerPrices(draft, gross, {
    a: {
      discount: { amount: '10', currencyCode: 'USD' },
      commission: { amount: '5', currencyCode: 'USD' },
    },
  });
  expect(next.passengers[0]!.agreedPrices).toEqual([
    { currencyCode: 'USD', amount: '85' },
    { currencyCode: 'IRR', amount: '1000' },
  ]);
  expect(next.priceComponents.map((p) => [p.currencyCode, p.amount])).toEqual([
    ['USD', '135'],
    ['IRR', '1000'],
  ]);
  expect(() =>
    validatePassengerTotalPricing(next.services, next.passengers),
  ).not.toThrow();
  const changed = applyAmendmentPassengerPrices(
    next,
    { ...gross, a: [{ amount: '120', currencyCode: 'USD' }, gross.a[1]!] },
    { a: { commission: { amount: '2', currencyCode: 'USD' } } },
  );
  expect(changed.passengers[0]!.agreedPrices?.[0]?.amount).toBe('118');
  expect(
    JSON.parse(String(changed.services[0]!.metadata![PASSENGER_DEDUCTIONS])).a
      .discount,
  ).toBeUndefined();
});
it('recovers legacy gross from net plus deductions and preserves zero-fare passengers', () => {
  const legacy = {
    ...draft,
    services: [
      {
        ...draft.services[0]!,
        metadata: {
          passengerPackagePricingVersion: 1,
          [PASSENGER_DEDUCTIONS]: JSON.stringify({
            a: { discount: { amount: '10', currencyCode: 'USD' } },
          }),
        },
      },
    ],
    passengers: [
      {
        ...draft.passengers[0]!,
        agreedPrices: [{ amount: '90', currencyCode: 'USD' }],
      },
      {
        ...draft.passengers[1]!,
        agreedPrices: [{ amount: '0', currencyCode: 'USD' }],
      },
    ],
  };
  const prices = amendmentPassengerGross(legacy);
  expect(prices.a).toEqual([{ currencyCode: 'USD', amount: '100' }]);
  expect(() =>
    validatePassengerTotalPricing(
      applyAmendmentPassengerPrices(legacy, prices, {}).services,
      applyAmendmentPassengerPrices(legacy, prices, {}).passengers,
    ),
  ).not.toThrow();
});
it('rejects excessive or cross-currency deductions and incomplete passengers', () => {
  expect(() =>
    applyAmendmentPassengerPrices(draft, gross, {
      a: { commission: { amount: '101', currencyCode: 'USD' } },
    }),
  ).toThrow('همان مسافر');
  expect(() =>
    applyAmendmentPassengerPrices(draft, gross, {
      a: { discount: { amount: '1', currencyCode: 'EUR' } },
    }),
  ).toThrow('همان ارز');
  expect(() =>
    applyAmendmentPassengerPrices(draft, { ...gross, b: [] }, {}),
  ).toThrow('هر مسافر');
});

it('opens total-only named contracts with all currencies on the first passenger and zeros on others', () => {
  const total = {
    ...draft,
    services: [
      {
        ...draft.services[0]!,
        metadata: { contractPackagePricingVersion: 1 },
      },
    ],
    passengers: draft.passengers.map((p) =>
      (() => {
        const next = { ...p };
        delete next.agreedPrices;
        return next;
      })(),
    ),
    priceComponents: [
      {
        type: 'BASE' as const,
        title: 'Total',
        amount: '2706300000',
        currencyCode: 'IRR',
      },
      {
        type: 'BASE' as const,
        title: 'Total',
        amount: '350',
        currencyCode: 'USD',
      },
    ],
  };
  const next = prepareAmendmentPersonPrices(total);
  expect(next.passengers[0]!.agreedPrices).toEqual([
    { currencyCode: 'IRR', amount: '2706300000' },
    { currencyCode: 'USD', amount: '350' },
  ]);
  expect(next.passengers[1]!.agreedPrices).toEqual([
    { currencyCode: 'IRR', amount: '0' },
    { currencyCode: 'USD', amount: '0' },
  ]);
  expect(next.services[0]!.metadata?.passengerPackagePricingVersion).toBe(1);
  expect(
    next.services[0]!.metadata?.contractPackagePricingVersion,
  ).toBeUndefined();
  expect(next.services[0]!.pricing).toBeUndefined();
  expect(next.priceComponents.map((p) => p.amount)).toEqual([
    '2706300000',
    '350',
  ]);
});
it('redistributes anonymous legacy totals by age without creating passengers or changing capacity counts', () => {
  const services = [
    {
      clientKey: 'hotel',
      kind: 'HOTEL' as const,
      titleSnapshot: 'Hotel',
      metadata: {
        contractPackagePricingVersion: 1,
        legacyServicePartiesV2: JSON.stringify({
          hotel: { adults: 2, children: 1, infants: 1 },
        }),
      },
    },
  ];
  const old = {
    ...draft,
    services,
    passengers: [],
    passengerCategories: {},
    priceComponents: [
      {
        type: 'BASE' as const,
        title: 'Total',
        amount: '400',
        currencyCode: 'USD',
      },
    ],
  };
  const rows = amendmentPricingRows(old);
  expect(rows.map((p) => p.ageCategory)).toEqual(['ADT', 'ADT', 'CHD', 'INF']);
  const next = prepareAmendmentPersonPrices(old);
  expect(next.passengers).toEqual([]);
  const gross = amendmentPassengerGross(next);
  expect(gross['legacy-ADT-1']![0]!.amount).toBe('400');
  expect(gross['legacy-INF-1']![0]!.amount).toBe('0');
  const edited = applyAmendmentPassengerPrices(
    next,
    {
      ...gross,
      'legacy-ADT-1': [{ currencyCode: 'USD', amount: '200' }],
      'legacy-ADT-2': [{ currencyCode: 'USD', amount: '150' }],
      'legacy-CHD-1': [{ currencyCode: 'USD', amount: '50' }],
    },
    {},
  );
  expect(edited.priceComponents[0]!.amount).toBe('400');
  expect(edited.passengers).toEqual([]);
  expect(edited.services[0]!.metadata?.legacyServicePartiesV2).toBe(
    services[0]!.metadata.legacyServicePartiesV2,
  );
  expect(amendmentPassengerGross(JSON.parse(JSON.stringify(edited)))).toEqual({
    ...gross,
    'legacy-ADT-1': [{ currencyCode: 'USD', amount: '200' }],
    'legacy-ADT-2': [{ currencyCode: 'USD', amount: '150' }],
    'legacy-CHD-1': [{ currencyCode: 'USD', amount: '50' }],
  });
});

it('keeps cheque fees separate and applies insurance extras only once while migrating a total', () => {
  const terms: SalesPaymentTerms = {
    version: 1,
    mode: 'CHECK',
    plans: [
      {
        currencyCode: 'IRR',
        downPayment: '30000000',
        months: 3,
        firstDueDate: '2099-02-01',
      },
    ],
  };
  const components = salesChequeComponents(
    [
      {
        type: 'BASE',
        title: 'Total',
        currencyCode: 'IRR',
        amount: '100000000',
      },
    ],
    terms,
  );
  const old = {
    ...draft,
    paymentTerms: terms,
    priceComponents: components,
    passengers: draft.passengers.map((p) =>
      (() => {
        const next = { ...p };
        delete next.agreedPrices;
        return next;
      })(),
    ),
    services: [
      {
        clientKey: 'insurance',
        kind: 'INSURANCE' as const,
        titleSnapshot: 'Insurance',
        metadata: { contractPackagePricingVersion: 1 },
      },
      {
        clientKey: 'extra',
        kind: 'OTHER' as const,
        titleSnapshot: 'Extra',
        metadata: {
          contractPackagePricingVersion: 1,
          insuranceAgeSurcharge: true,
          passengerId: 'a',
          extraToman: '100',
        },
        pricing: [
          {
            version: 1 as const,
            currencyCode: 'IRR',
            daySale: { basis: 'TOTAL' as const, amount: '1000' },
            agreed: { basis: 'TOTAL' as const, amount: '1000' },
          },
        ],
      },
    ],
  };
  const next = prepareAmendmentPersonPrices(old);
  expect(next.passengers[0]!.agreedPrices).toEqual([
    { currencyCode: 'IRR', amount: '100000000' },
  ]);
  expect(next.services[1]!.pricing).toEqual(old.services[1]!.pricing);
  expect(
    next.priceComponents.find((p) => p.title === SALES_CHEQUE_FEE)?.amount,
  ).toBe(components.find((p) => p.title === SALES_CHEQUE_FEE)?.amount);
  expect(
    next.priceComponents.filter((p) => p.title !== SALES_CHEQUE_FEE)[0]!.amount,
  ).toBe('100000000');
});

it('retains explicitly recorded total-contract discount and commission on the first row', () => {
  const old = {
    ...draft,
    services: [
      { ...draft.services[0]!, metadata: { contractPackagePricingVersion: 1 } },
    ],
    passengers: draft.passengers.map((p) => {
      const next = { ...p };
      delete next.agreedPrices;
      return next;
    }),
    priceComponents: [
      {
        type: 'BASE' as const,
        title: 'مبلغ کل قرارداد',
        currencyCode: 'USD',
        amount: '100',
      },
      {
        type: 'DISCOUNT' as const,
        title: 'تخفیف قرارداد',
        currencyCode: 'USD',
        amount: '10',
      },
      {
        type: 'DISCOUNT' as const,
        title: 'کمیسیون قرارداد',
        currencyCode: 'USD',
        amount: '5',
      },
    ],
  };
  const next = prepareAmendmentPersonPrices(old);
  expect(amendmentPassengerGross(next).a).toEqual([
    { currencyCode: 'USD', amount: '100' },
  ]);
  expect(next.passengers[0]!.agreedPrices).toEqual([
    { currencyCode: 'USD', amount: '85' },
  ]);
  expect(next.priceComponents[0]!.amount).toBe('85');
  expect(
    JSON.parse(String(next.services[0]!.metadata![PASSENGER_DEDUCTIONS])).a,
  ).toEqual({
    discount: { currencyCode: 'USD', amount: '10' },
    commission: { currencyCode: 'USD', amount: '5' },
  });
});
