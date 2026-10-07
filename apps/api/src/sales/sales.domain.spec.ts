import { describe, expect, it } from 'vitest';

import type { SalesContractCreateRequest } from '@nora/contracts';
import {
  servicePriceComponents,
  salesChequeComponents,
  calculateSalesCheque,
  type SalesPaymentTerms,
} from '@nora/contracts';

import {
  calculateSalesBalances,
  passengerAgeCategory,
  salesFingerprint,
  sumSalesDecimals,
  validateSalesContract,
  validateSalesPayment,
} from './sales.domain';

const draft: SalesContractCreateRequest = {
  customerId: '10000000-0000-4000-8000-000000000001',
  tripType: 'ROUND_TRIP',
  originId: '10000000-0000-4000-8000-000000000002',
  destinationId: '10000000-0000-4000-8000-000000000003',
  departureDate: '2026-10-01',
  returnNotBefore: '2026-10-08',
  services: [
    {
      clientKey: 'flight',
      kind: 'FLIGHT',
      titleSnapshot: 'پرواز رفت‌وبرگشت',
    },
  ],
  passengers: [
    {
      customerId: '10000000-0000-4000-8000-000000000004',
      displayNameSnapshot: 'مسافر آزمون',
      birthDate: '1990-01-01',
      serviceClientKeys: ['flight'],
    },
  ],
  ticketSelections: [
    {
      serviceClientKey: 'flight',
      direction: 'OUTBOUND',
      offerId: 'offer-out',
      originId: '10000000-0000-4000-8000-000000000002',
      destinationId: '10000000-0000-4000-8000-000000000003',
      departureAt: '2026-10-01T06:00:00Z',
      arrivalAt: '2026-10-01T08:00:00Z',
      carrierNameSnapshot: 'Carrier',
      serviceNumberSnapshot: 'RB100',
      cabinClassCode: 'ECONOMY',
      quotedPrice: { amount: '100.25', currencyCode: 'USD' },
    },
    {
      serviceClientKey: 'flight',
      direction: 'RETURN',
      offerId: 'offer-back',
      originId: '10000000-0000-4000-8000-000000000003',
      destinationId: '10000000-0000-4000-8000-000000000002',
      departureAt: '2026-10-08T08:00:00Z',
      arrivalAt: '2026-10-08T10:00:00Z',
      carrierNameSnapshot: 'Carrier',
      serviceNumberSnapshot: 'RB101',
      cabinClassCode: 'ECONOMY',
      quotedPrice: { amount: '100.25', currencyCode: 'USD' },
    },
  ],
  priceComponents: [
    {
      type: 'BASE',
      title: 'اصل قرارداد',
      amount: '200.50',
      currencyCode: 'USD',
    },
  ],
};

describe('Sales contract domain', () => {
  it('validates financed fees separately from passenger service prices and rejects an underfunded down payment', () => {
    const terms: SalesPaymentTerms = {
      version: 1,
      mode: 'CHECK',
      plans: [
        {
          currencyCode: 'USD',
          downPayment: '60.15',
          months: 3,
          firstDueDate: '2026-11-01',
        },
      ],
    };
    const components = salesChequeComponents(draft.priceComponents, terms);
    const input: SalesContractCreateRequest = {
      ...draft,
      paymentTerms: terms,
      passengers: draft.passengers.map((p) => ({
        ...p,
        agreedPrices: [{ amount: '200.50', currencyCode: 'USD' }],
      })),
      priceComponents: components,
      payments: [
        {
          method: 'CASH',
          amount: '60.15',
          currencyCode: 'USD',
          dueAt: '2026-10-01',
        },
        ...calculateSalesCheque('200.50', terms.plans[0]!).schedule.map(
          (row) => ({
            method: 'CHECK' as const,
            amount: row.amount,
            currencyCode: 'USD',
            dueAt: row.dueDate,
            check: {
              bankId: '10000000-0000-4000-8000-000000000005',
              secureIdentifier: 'synthetic',
              ownerName: 'Test',
              dueDate: row.dueDate,
            },
          }),
        ),
      ],
    };
    expect(() => validateSalesContract(input)).not.toThrow();
    expect(() =>
      validateSalesContract({
        ...input,
        paymentTerms: {
          ...terms,
          plans: [{ ...terms.plans[0]!, downPayment: '60' }],
        },
      }),
    ).toThrow('۳۰٪');
    expect(() =>
      validateSalesContract({
        ...input,
        priceComponents: draft.priceComponents,
      }),
    ).toThrow('کارمزد');
    expect(() =>
      validateSalesContract(
        {
          ...input,
          paymentTerms: null,
          priceComponents: draft.priceComponents,
        },
        true,
      ),
    ).toThrow('نوع فروش چکی');
  });
  it('accepts explicit buyer contact and rejects invalid or mismatched payer details', () => {
    const buyerContact = {
      name: 'Synthetic Buyer',
      phone: '09120000000',
      address: 'Synthetic address',
      postalCode: '0012345678',
    };
    expect(() =>
      validateSalesContract({
        ...draft,
        buyerContact,
        payerCustomerId: draft.customerId,
      }),
    ).not.toThrow();
    for (const change of [
      { phone: 'bad' },
      { postalCode: '123' },
      { name: ' ' },
      { address: ' ' },
    ])
      expect(() =>
        validateSalesContract({
          ...draft,
          buyerContact: { ...buyerContact, ...change },
        }),
      ).toThrow('طرف حساب');
    expect(() =>
      validateSalesContract({
        ...draft,
        buyerContact,
        payerCustomerId: draft.destinationId,
      }),
    ).toThrow('طرف حساب');
  });
  it('rejects accommodation without a hotel allocation', () => {
    const input = structuredClone(draft);
    input.passengers[0]!.accommodationKind = 'DBL';
    expect(() => validateSalesContract(input)).toThrow('نوع اقامت');
  });
  it('accepts included transfers but rejects adding their price to the bill', () => {
    const input = structuredClone(draft);
    input.services[0]!.pricing = [
      {
        version: 1,
        currencyCode: 'USD',
        daySale: { basis: 'TOTAL', amount: '300' },
        agreed: { basis: 'TOTAL', amount: '250' },
      },
    ];
    input.services = [
      ...input.services,
      {
        clientKey: 'transfer-return',
        kind: 'TRANSFER',
        titleSnapshot: 'ترانسفر',
        metadata: { direction: 'RETURN', includedWithoutCharge: true },
      },
    ];
    input.priceComponents = servicePriceComponents(input.services)!;
    expect(() => validateSalesContract(input)).not.toThrow();
    input.services[1]!.pricing = input.services[0]!.pricing;
    expect(() => validateSalesContract(input)).toThrow('نباید قیمت');
    input.services[1]!.pricing = [];
    input.priceComponents = [
      ...input.priceComponents,
      {
        type: 'BASE',
        title: 'ترانسفر',
        amount: '10',
        currencyCode: 'USD',
      },
    ];
    expect(() => validateSalesContract(input)).toThrow('مطابقت');
  });
  it('only permits an empty bill for explicitly included transfers, without payments', () => {
    const input = structuredClone(draft);
    input.services = [
      {
        clientKey: 'transfer-return',
        kind: 'TRANSFER',
        titleSnapshot: 'ترانسفر',
        metadata: { direction: 'RETURN', includedWithoutCharge: true },
      },
    ];
    input.passengers[0]!.serviceClientKeys = ['transfer-return'];
    input.ticketSelections = [];
    input.priceComponents = [];
    expect(() => validateSalesContract(input)).not.toThrow();
    input.payments = [
      {
        amount: '10',
        currencyCode: 'USD',
        method: 'CASH',
        dueAt: '2026-10-01T00:00:00Z',
      },
    ];
    expect(() => validateSalesContract(input)).toThrow('برنامه پرداخت');
    input.payments = [];
    input.services[0]!.metadata = { direction: 'RETURN' };
    expect(() => validateSalesContract(input)).toThrow('الزامی');
  });
  it('validates versioned service pricing and rejects a tampered bill', () => {
    const input = structuredClone(draft);
    input.services[0]!.pricing = [
      {
        version: 1,
        currencyCode: 'USD',
        daySale: { basis: 'TOTAL', amount: '300' },
        agreed: { basis: 'TOTAL', amount: '250' },
      },
    ];
    input.priceComponents = servicePriceComponents(input.services)!;
    expect(() => validateSalesContract(input)).not.toThrow();
    input.priceComponents = input.priceComponents.map((price) => ({
      ...price,
      amount: '1',
    }));
    expect(() => validateSalesContract(input)).toThrow('مطابقت');
  });
  it('rejects duplicate passengers before persistence', () => {
    const input = structuredClone(draft);
    input.passengers = [...input.passengers, ...input.passengers];
    expect(() => validateSalesContract(input)).toThrow('دوبار');
  });
  it.each(Array.from({ length: 15 }, (_, index) => index + 1))(
    'accepts independent flight/transfer combination %s',
    (flags) => {
      const input = structuredClone(draft);
      const choices = [
        { kind: 'FLIGHT' as const, direction: 'OUTBOUND' as const },
        { kind: 'FLIGHT' as const, direction: 'RETURN' as const },
        { kind: 'TRANSFER' as const, direction: 'OUTBOUND' as const },
        { kind: 'TRANSFER' as const, direction: 'RETURN' as const },
      ].filter((_, index) => (flags & (1 << index)) !== 0);
      input.tripType = choices.some((item) => item.direction === 'RETURN')
        ? 'ROUND_TRIP'
        : 'ONE_WAY';
      input.services = choices.map((item) => ({
        clientKey: `${item.kind}-${item.direction}`,
        kind: item.kind,
        titleSnapshot: 'خدمت آزمون',
        metadata: {
          direction: item.direction,
          ...(item.kind === 'TRANSFER'
            ? {
                date: '2026-10-10',
                pickup: 'هتل',
                dropoff: 'فرودگاه',
              }
            : {}),
        },
      }));
      input.ticketSelections = choices
        .filter((item) => item.kind === 'FLIGHT')
        .map((item) => ({
          ...draft.ticketSelections!.find(
            (ticket) => ticket.direction === item.direction,
          )!,
          serviceClientKey: `FLIGHT-${item.direction}`,
        }));
      input.passengers = [
        {
          ...input.passengers[0]!,
          serviceClientKeys: input.services.map((item) => item.clientKey),
        },
      ];
      expect(() => validateSalesContract(input)).not.toThrow();
    },
  );
  it.each(['OUTBOUND', 'RETURN'] as const)(
    'allows a %s-only flight on a round trip with an independent opposite transfer',
    (direction) => {
      const input = structuredClone(draft);
      input.services = [
        {
          clientKey: 'flight',
          kind: 'FLIGHT',
          titleSnapshot: 'بلیت',
          metadata: { direction },
        },
        {
          clientKey: 'transfer',
          kind: 'TRANSFER',
          titleSnapshot: 'ترانسفر',
          metadata: {
            direction: direction === 'OUTBOUND' ? 'RETURN' : 'OUTBOUND',
            date: '2026-10-10',
            pickup: 'هتل',
            dropoff: 'فرودگاه',
          },
        },
      ];
      input.ticketSelections = input.ticketSelections!.filter(
        (item) => item.direction === direction,
      );
      expect(() => validateSalesContract(input)).not.toThrow();
      input.ticketSelections = [];
      expect(() => validateSalesContract(input)).toThrow('بلیت جهت انتخاب‌شده');
    },
  );
  it('rejects mismatched ticket directions and a return-only ticket on the wrong route', () => {
    const input = structuredClone(draft);
    input.services = [
      {
        clientKey: 'flight',
        kind: 'FLIGHT',
        titleSnapshot: 'برگشت',
        metadata: { direction: 'RETURN' },
      },
    ];
    input.ticketSelections = [input.ticketSelections![0]!];
    expect(() => validateSalesContract(input)).toThrow('خدمت بلیت');
    input.ticketSelections = [
      { ...draft.ticketSelections![1]!, originId: draft.originId },
    ];
    expect(() => validateSalesContract(input)).toThrow(
      'مسیر یا زمان بلیت برگشت',
    );
  });
  it('rejects missing legacy return tickets but accepts a transfer flag without details', () => {
    const input = structuredClone(draft);
    input.ticketSelections = [input.ticketSelections![0]!];
    expect(() => validateSalesContract(input)).toThrow('بلیت جهت انتخاب‌شده');
    input.services = [
      {
        clientKey: 'flight',
        kind: 'TRANSFER',
        titleSnapshot: 'ترانسفر',
        metadata: { direction: 'OUTBOUND' },
      },
    ];
    input.ticketSelections = [];
    expect(() => validateSalesContract(input)).not.toThrow();
  });
  it.each(['BUS', 'TRAIN'] as const)(
    'rejects %s together with flight',
    (kind) => {
      const input = structuredClone(draft);
      input.services = [
        ...input.services,
        {
          clientKey: 'other-transport',
          kind,
          titleSnapshot: 'وسیله دیگر',
        },
      ];
      expect(() => validateSalesContract(input)).toThrow(
        'پرواز با قطار یا اتوبوس',
      );
    },
  );
  it('requires hotel occupancy to match the selected passenger members', () => {
    const input = structuredClone(draft);
    input.services = [
      { clientKey: 'hotel', kind: 'HOTEL', titleSnapshot: 'هتل' },
    ];
    input.ticketSelections = [];
    input.passengers = [
      { ...input.passengers[0]!, serviceClientKeys: ['hotel'] },
    ];
    input.hotelSelection = {
      serviceClientKey: 'hotel',
      hotelId: 'hotel',
      hotelNameSnapshot: 'هتل آزمون',
      cityId: input.destinationId,
      checkInDate: '2026-10-01',
      checkOutDate: '2026-10-03',
      roomCount: 1,
      roomTypeId: 'room',
      occupancy: 1,
      inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
    };
    expect(() => validateSalesContract(input)).not.toThrow();
    input.hotelSelection.occupancy = 2;
    expect(() => validateSalesContract(input)).toThrow('اعضای انتخاب‌شده');
    input.hotelSelection.occupancy = 1;
    input.hotelSelection.singleRoomCount = 1;
    input.hotelSelection.doubleRoomCount = 1;
    expect(() => validateSalesContract(input)).toThrow('ترکیب اتاق');
  });
  it('validates a round-trip contract and deterministically fingerprints it', () => {
    expect(() => validateSalesContract(draft)).not.toThrow();
    expect(salesFingerprint({ b: 2, a: 1 })).toBe(
      salesFingerprint({ a: 1, b: 2 }),
    );
  });

  it('rejects a return ticket before the selected return date', () => {
    const invalid = structuredClone(draft);
    invalid.ticketSelections = [
      invalid.ticketSelections![0]!,
      { ...invalid.ticketSelections![1]!, departureAt: '2026-10-07T08:00:00Z' },
    ];
    expect(() => validateSalesContract(invalid)).toThrow(
      'مسیر یا زمان بلیت برگشت',
    );
  });

  it('requires secure check metadata only for check payments', () => {
    expect(() =>
      validateSalesPayment({
        amount: '10',
        currencyCode: 'IRR',
        dueAt: '2026-10-01T00:00:00Z',
        method: 'CHECK',
      }),
    ).toThrow('اطلاعات امن چک');
  });

  it('reduces outstanding balance only for Finance-confirmed payments', () => {
    expect(
      calculateSalesBalances(
        [
          {
            type: 'BASE',
            title: 'قیمت',
            amount: '1000',
            currencyCode: 'IRR',
          },
          {
            type: 'DISCOUNT',
            title: 'تخفیف',
            amount: '100',
            currencyCode: 'IRR',
          },
        ],
        [
          {
            amount: '300',
            currencyCode: 'IRR',
            status: 'PENDING_FINANCE_CONFIRMATION',
          },
          { amount: '250', currencyCode: 'IRR', status: 'FINANCE_CONFIRMED' },
        ],
      ),
    ).toEqual([
      {
        amount: '900',
        currencyCode: 'IRR',
        confirmedPaid: '250',
        pendingFinance: '300',
        outstanding: '650',
      },
    ]);
  });

  it('aggregates a negative computed balance without accepting a negative payment', () => {
    const balances = calculateSalesBalances(
      [{ type: 'BASE', title: 'قیمت', amount: '100', currencyCode: 'IRR' }],
      [{ amount: '120', currencyCode: 'IRR', status: 'FINANCE_CONFIRMED' }],
    );
    expect(balances[0]?.outstanding).toBe('-20');
    expect(
      sumSalesDecimals(balances.map(({ outstanding }) => outstanding)),
    ).toBe('-20');
    expect(sumSalesDecimals(['-20', '50'])).toBe('30');
    expect(() =>
      validateSalesPayment({
        amount: '-20',
        currencyCode: 'IRR',
        dueAt: '2026-10-01T00:00:00Z',
        method: 'CASH',
      }),
    ).toThrow('مبلغ Decimal معتبر نیست');
  });

  it('derives passenger category at departure date', () => {
    expect(passengerAgeCategory('2025-01-01', '2026-10-01')).toBe('INF');
    expect(passengerAgeCategory('2020-01-01', '2026-10-01')).toBe('CHD');
    expect(passengerAgeCategory('2000-01-01', '2026-10-01')).toBe('ADT');
  });
});

describe('signed calculated Sales balance aggregation', () => {
  it('nets overpayments precisely without changing nonnegative input parsing', () => {
    expect(sumSalesDecimals(['10.25', '-15.2501', '0.0001'])).toBe('-5');
    expect(
      sumSalesDecimals(['999999999999999999.9999', '-999999999999999999.9998']),
    ).toBe('0.0001');
    expect(sumSalesDecimals([])).toBe('0');
  });
  it('still rejects malformed calculated amounts', () => {
    for (const amount of ['--1', '-1e3', '-NaN', '-1.12345', '+1']) {
      expect(() => sumSalesDecimals([amount])).toThrow('Decimal');
    }
  });
});

it('validates package passenger totals without inventing service prices', () => {
  const input = structuredClone(draft);
  input.services = input.services.map((s) => ({
    ...s,
    metadata: { passengerPackagePricingVersion: 1 },
  }));
  input.passengers = input.passengers.map((p) => ({
    ...p,
    agreedPrices: [
      {
        amount: input.priceComponents[0]!.amount,
        currencyCode: input.priceComponents[0]!.currencyCode,
      },
    ],
  }));
  expect(() => validateSalesContract(input)).not.toThrow();
  input.passengers = input.passengers.map((p) => ({
    ...p,
    agreedPrices: [
      { amount: '1', currencyCode: input.priceComponents[0]!.currencyCode },
    ],
  }));
  expect(() => validateSalesContract(input)).toThrow();
});
