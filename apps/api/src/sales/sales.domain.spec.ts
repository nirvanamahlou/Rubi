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
  contractPassengerAgeCategory,
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

it('uses canonical passenger totals despite obsolete split-flight pricing metadata', () => {
  const input = structuredClone(draft);
  input.passengers[0]!.agreedPrices = [
    { amount: '200.50', currencyCode: 'USD' },
  ];
  input.services[0]!.metadata = {
    passengerPackagePricingVersion: 1,
    passengerTotalPricesV1: JSON.stringify({
      [input.passengers[0]!.customerId]: input.passengers[0]!.agreedPrices,
    }),
    automaticFlightRoomTotalV1: true,
    passengerFlightPricesV1: '{}',
    passengerHotelPricesV1: 'obsolete',
  };
  expect(() => validateSalesContract(input)).not.toThrow();
  input.passengers[0]!.agreedPrices = [{ amount: '1', currencyCode: 'USD' }];
  expect(() => validateSalesContract(input)).toThrow();
});
it('keeps composite hotel stays ordered with explicit independent dates and no duplicated price components', () => {
  const input = structuredClone(draft);
  input.services = [
    { clientKey: 'hotel', kind: 'HOTEL', titleSnapshot: 'Composite' },
  ];
  input.passengers[0]!.serviceClientKeys = ['hotel'];
  input.ticketSelections = [];
  input.hotelSelection = {
    serviceClientKey: 'hotel',
    hotelId: '10000000-0000-4000-8000-000000000010',
    hotelNameSnapshot: 'First',
    cityId: input.destinationId,
    checkInDate: '2026-10-01',
    checkOutDate: '2026-10-03',
    roomCount: 1,
    roomTypeId: '10000000-0000-4000-8000-000000000011',
    occupancy: 1,
    inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
    additionalStays: [
      {
        hotelId: '10000000-0000-4000-8000-000000000012',
        hotelNameSnapshot: 'Second',
        cityId: '10000000-0000-4000-8000-000000000013',
        checkInDate: '2026-10-03',
        checkOutDate: '2026-10-08',
      },
    ],
  };
  expect(() => validateSalesContract(input)).not.toThrow();
  expect(input.priceComponents).toEqual(draft.priceComponents);
  const stay = input.hotelSelection.additionalStays![0]!;
  stay.rooms = [
    {
      ordinal: 1,
      roomTypeId: input.hotelSelection.roomTypeId,
      roomTypeNameSnapshot: 'Single',
      adults: 1,
      childAges: [],
      roomCategory: 'SINGLE',
    },
  ];
  expect(() => validateSalesContract(input)).not.toThrow();
  stay.rooms[0]!.roomCategory = 'FAMILY';
  expect(() => validateSalesContract(input)).toThrow('اتاق');
  stay.rooms[0]!.roomCategory = 'SINGLE';
  stay.rooms[0]!.adults = 2;
  expect(() => validateSalesContract(input)).toThrow('اتاق');
  stay.rooms[0]!.adults = 1;
  const validRooms = stay.rooms;
  stay.rooms = null as never;
  expect(() => validateSalesContract(input)).toThrow('اتاق');
  stay.rooms = validRooms;
  stay.checkInDate = '';
  expect(() => validateSalesContract(input)).toThrow();
  stay.checkInDate = '2026-10-02';
  expect(() => validateSalesContract(input)).toThrow('overlap');
  stay.checkInDate = '2026-10-03';
  stay.hotelId = input.hotelSelection.hotelId;
  expect(() => validateSalesContract(input)).toThrow('itinerary');
  input.hotelSelection.additionalStays = [null as never];
  expect(() => validateSalesContract(input)).toThrow('itinerary');
});

it('validates per-person discounts and commissions against the same-currency gross service price', () => {
  const input = structuredClone(draft),
    id = input.passengers[0]!.customerId;
  input.services[0]!.metadata = {
    automaticFlightRoomTotalV1: true,
    passengerFlightPricesV1: JSON.stringify({
      [id]: [{ amount: '200.50', currencyCode: 'USD' }],
    }),
    passengerDeductionsV1: JSON.stringify({
      [id]: {
        discount: { amount: '10', currencyCode: 'USD' },
        commission: { amount: '5', currencyCode: 'USD' },
      },
    }),
  };
  input.priceComponents = [
    ...input.priceComponents,
    {
      type: 'DISCOUNT',
      title: 'Passenger deductions',
      amount: '15',
      currencyCode: 'USD',
    },
  ];
  expect(() => validateSalesContract(input)).not.toThrow();
  input.priceComponents[1]!.amount = '14';
  expect(() => validateSalesContract(input)).toThrow(
    'مبلغ کل قرارداد باید برابر',
  );
  input.services[0]!.metadata = {
    ...input.services[0]!.metadata,
    passengerDeductionsV1: JSON.stringify({
      [id]: { discount: { amount: '201', currencyCode: 'USD' } },
    }),
  };
  expect(() => validateSalesContract(input)).toThrow();
});

describe('Sales contract domain', () => {
  it('validates explicit child bands without changing birth dates and rejects them for other categories', () => {
    const input = structuredClone(draft);
    const person = input.passengers[0]!;
    person.childAgeBand = 'AGE_2_6';
    expect(() =>
      validateSalesContract(input, false, { [person.customerId]: 'CHD' }),
    ).not.toThrow();
    person.childAgeBand = 'AGE_6_12';
    expect(() =>
      validateSalesContract(input, false, { [person.customerId]: 'CHD' }),
    ).not.toThrow();
    expect(person.birthDate).toBe('1990-01-01');
    expect(() =>
      validateSalesContract(input, false, { [person.customerId]: 'ADT' }),
    ).toThrow('رده سنی کودک');
    expect(() =>
      validateSalesContract(input, false, { [person.customerId]: 'INF' }),
    ).toThrow('رده سنی کودک');
    person.childAgeBand = 'INVALID' as never;
    expect(() =>
      validateSalesContract(input, false, { [person.customerId]: 'CHD' }),
    ).toThrow('رده سنی کودک');
  });
  it.each([
    null,
    {},
    { ...draft, services: undefined },
    { ...draft, passengers: null },
    { ...draft, priceComponents: {} },
  ])(
    'rejects malformed structure before insurance calculations (%j)',
    (input) => {
      expect(() =>
        validateSalesContract(input as SalesContractCreateRequest),
      ).toThrow('ساختار قرارداد معتبر نیست.');
    },
  );
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
    expect(() =>
      validateSalesContract({
        ...draft,
        buyerContact: {
          ...buyerContact,
          postalCode: '',
          landline: '02112345678',
        },
      }),
    ).not.toThrow();
    for (const landline of ['1', '021', '1234567', '+123']) {
      expect(() =>
        validateSalesContract({
          ...draft,
          buyerContact: { ...buyerContact, landline },
        }),
      ).not.toThrow();
    }
    for (const landline of ['', '   ', '02112345678']) {
      expect(() =>
        validateSalesContract({
          ...draft,
          buyerContact: { ...buyerContact, landline },
        }),
      ).not.toThrow();
    }
    for (const change of [
      { phone: 'bad' },
      { landline: 'bad' },
      { postalCode: '123' },
      { name: ' ' },
      { address: 'a'.repeat(1001) },
    ])
      expect(() =>
        validateSalesContract({
          ...draft,
          buyerContact: { ...buyerContact, ...change },
        }),
      ).toThrow('طرف حساب');
    for (const blank of ['', '   '])
      expect(() =>
        validateSalesContract({
          ...draft,
          buyerContact: {
            ...buyerContact,
            phone: blank,
            address: blank,
            postalCode: blank,
            landline: blank,
          },
        }),
      ).not.toThrow();
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

it('accepts opted-in contract totals without inferring passenger sale allocations', () => {
  const input = structuredClone(draft);
  input.services = input.services.map((service) => ({
    ...service,
    metadata: { ...service.metadata, contractPackagePricingVersion: 1 },
  }));
  input.passengers = input.passengers.map((person) => {
    const next = { ...person };
    delete next.agreedPrices;
    return next;
  });
  input.priceComponents = [
    {
      type: 'BASE',
      title: 'Contract total',
      amount: '1234.5678',
      currencyCode: 'USD',
    },
    {
      type: 'BASE',
      title: 'Contract total',
      amount: '2500000',
      currencyCode: 'IRR',
    },
  ];
  input.payments = [];
  expect(() => validateSalesContract(input)).not.toThrow();
  input.services[0]!.pricing = [];
  expect(() => validateSalesContract(input)).toThrow();
});

it('rejects transfer quantity above non-infant passengers or below zero', () => {
  for (const passengerCount of [-1, 2, 0.5]) {
    const input = structuredClone(draft);
    input.services = [
      ...input.services,
      {
        clientKey: 'transfer',
        kind: 'TRANSFER',
        titleSnapshot: 'Transfer',
        metadata: { direction: 'OUTBOUND', passengerCount },
      },
    ];
    input.passengers[0]!.serviceClientKeys = [
      ...input.passengers[0]!.serviceClientKeys,
      'transfer',
    ];
    expect(() => validateSalesContract(input)).toThrow(
      'تعداد مسافران ترانسفر معتبر نیست.',
    );
  }
});

describe('visa party integrity', () => {
  it('validates the assigned subset independently from all contract passengers', () => {
    const input = {
      ...draft,
      services: [
        ...draft.services,
        {
          clientKey: 'visa',
          kind: 'VISA' as const,
          titleSnapshot: 'Visa',
          metadata: {
            applicantAdults: 1,
            applicantChildren: 0,
            applicantChildAges: '',
          },
        },
      ],
      passengers: draft.passengers.map((p) => ({
        ...p,
        serviceClientKeys: [...p.serviceClientKeys, 'visa'],
      })),
    };
    expect(() => validateSalesContract(input)).not.toThrow();
    expect(() =>
      validateSalesContract({ ...input, passengers: draft.passengers }),
    ).toThrow();
  });
});

describe('hotel room party integrity', () => {
  it('validates room ordinals, canonical IDs and actual guest ages', () => {
    const id = '10000000-0000-4000-8000-000000000010';
    const input: SalesContractCreateRequest = {
      ...draft,
      services: [{ clientKey: 'hotel', kind: 'HOTEL', titleSnapshot: 'Hotel' }],
      ticketSelections: [],
      passengers: [{ ...draft.passengers[0]!, serviceClientKeys: ['hotel'] }],
      hotelSelection: {
        serviceClientKey: 'hotel',
        hotelId: 'hotel',
        hotelNameSnapshot: 'Hotel',
        cityId: draft.destinationId,
        checkInDate: '2026-10-01',
        checkOutDate: '2026-10-03',
        roomCount: 1,
        roomTypeId: id,
        occupancy: 1,
        inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
        rooms: [
          {
            ordinal: 1,
            roomTypeId: id,
            roomTypeNameSnapshot: 'Single',
            adults: 1,
            childAges: [],
          },
        ],
      },
    };
    expect(() => validateSalesContract(input)).not.toThrow();
    const hotel = input.hotelSelection!;
    expect(() =>
      validateSalesContract({
        ...input,
        hotelSelection: {
          ...hotel,
          rooms: [{ ...hotel.rooms![0]!, ordinal: 2 }],
        },
      }),
    ).toThrow();
    expect(() =>
      validateSalesContract({
        ...input,
        hotelSelection: {
          ...hotel,
          rooms: [{ ...hotel.rooms![0]!, roomTypeId: 'unknown' }],
        },
      }),
    ).toThrow();
    expect(() =>
      validateSalesContract({
        ...input,
        hotelSelection: {
          ...hotel,
          rooms: [{ ...hotel.rooms![0]!, adults: 2 }],
        },
      }),
    ).not.toThrow();
    expect(() =>
      validateSalesContract({
        ...input,
        hotelSelection: { ...hotel, rooms: [null] as never },
      }),
    ).toThrow();
  });
});

describe('room agreed sale prices', () => {
  it('keeps legacy rooms and requires valid foreign amounts within the contract total', () => {
    const id = '10000000-0000-4000-8000-000000000010';
    const base: SalesContractCreateRequest = {
      ...draft,
      services: [{ clientKey: 'hotel', kind: 'HOTEL', titleSnapshot: 'Hotel' }],
      ticketSelections: [],
      passengers: [{ ...draft.passengers[0]!, serviceClientKeys: ['hotel'] }],
      hotelSelection: {
        serviceClientKey: 'hotel',
        hotelId: 'hotel',
        hotelNameSnapshot: 'Hotel',
        cityId: draft.destinationId,
        checkInDate: '2026-10-01',
        checkOutDate: '2026-10-03',
        roomCount: 1,
        roomTypeId: id,
        occupancy: 1,
        inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
        rooms: [
          {
            ordinal: 1,
            roomTypeId: id,
            roomTypeNameSnapshot: 'Single',
            adults: 1,
            childAges: [],
          },
        ],
      },
    };
    const hotel = base.hotelSelection!;
    const priced = (amount: string, currencyCode = 'USD') => ({
      ...base,
      hotelSelection: {
        ...hotel,
        rooms: [{ ...hotel.rooms![0]!, agreedPrice: { amount, currencyCode } }],
      },
    });
    expect(() => validateSalesContract(base)).not.toThrow();
    expect(() => validateSalesContract(priced('200.50'))).not.toThrow();
    expect(() => validateSalesContract(priced('200.51'))).toThrow(
      'جمع مبالغ اتاق‌ها',
    );
    expect(() => validateSalesContract(priced('-10'))).toThrow();
    expect(() => validateSalesContract(priced('10', 'IRR'))).toThrow();
  });
});

it('verifies automatic flight-plus-room totals rather than trusting a submitted grand total', () => {
  const input = structuredClone(draft),
    id = input.passengers[0]!.customerId;
  input.services[0]!.metadata = {
    automaticFlightRoomTotalV1: true,
    passengerFlightPricesV1: JSON.stringify({
      [id]: [{ amount: '200.50', currencyCode: 'USD' }],
    }),
  };
  expect(() => validateSalesContract(input)).not.toThrow();
  input.priceComponents = [
    { type: 'BASE', title: 'Total', amount: '201', currencyCode: 'USD' },
  ];
  expect(() => validateSalesContract(input)).toThrow(
    'مبلغ کل قرارداد باید برابر',
  );
  input.services[0]!.metadata = { automaticFlightRoomTotalV1: true };
  expect(() => validateSalesContract(input)).toThrow('قیمت پرواز هر مسافر');
});

it('rejects invalid agency commission snapshots at the server boundary', () => {
  const input = structuredClone(draft);
  input.services[0]!.metadata = {
    agencyCommissionV1: JSON.stringify({ adult: '-1', child: '100' }),
  };
  expect(() => validateSalesContract(input)).toThrow(
    'کمیسیون آژانس معتبر نیست.',
  );
});

it('accepts fixed agency commission without altering the submitted financial components', () => {
  const input = structuredClone(draft),
    before = structuredClone(input.priceComponents);
  input.services[0]!.metadata = {
    agencyCommissionV1: JSON.stringify({ adult: '125000', child: '45000' }),
  };
  expect(() => validateSalesContract(input)).not.toThrow();
  expect(input.priceComponents).toEqual(before);
});

it('allows independent passenger membership for combined flight and hotel contracts', () => {
  const input = structuredClone(draft);
  input.services = [
    ...input.services,
    {
      clientKey: 'hotel',
      kind: 'HOTEL',
      titleSnapshot: 'Hotel',
    },
  ];
  input.passengers = input.passengers.map((p) => ({
    ...p,
    serviceClientKeys: [...p.serviceClientKeys, 'hotel'],
  }));
  input.hotelSelection = {
    serviceClientKey: 'hotel',
    hotelId: 'hotel',
    hotelNameSnapshot: 'Hotel',
    cityId: input.destinationId,
    checkInDate: '2026-10-01',
    checkOutDate: '2026-10-03',
    roomCount: 1,
    roomTypeId: 'room',
    occupancy: 1,
    inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
  };
  expect(() => validateSalesContract(input)).not.toThrow();
  input.passengers = [
    ...input.passengers,
    {
      ...input.passengers[0]!,
      customerId: '10000000-0000-4000-8000-000000000099',
      serviceClientKeys: ['flight'],
    },
  ];
  expect(() => validateSalesContract(input)).not.toThrow();
});

it('checks manual per-guest hotel prices against exact automatic contract totals', () => {
  const input = structuredClone(draft);
  const id = input.passengers[0]!.customerId;
  input.services[0]!.metadata = {
    automaticFlightRoomTotalV1: true,
    passengerFlightPricesV1: JSON.stringify({
      [id]: [{ currencyCode: 'USD', amount: '100' }],
    }),
  };
  input.services = [
    ...input.services,
    {
      clientKey: 'hotel',
      kind: 'HOTEL',
      titleSnapshot: 'Hotel',
      metadata: {
        passengerHotelPricesV1: JSON.stringify({
          [id]: [{ currencyCode: 'USD', amount: '100.50' }],
        }),
      },
    },
  ];
  input.passengers[0]!.serviceClientKeys = [
    ...input.passengers[0]!.serviceClientKeys,
    'hotel',
  ];
  input.hotelSelection = {
    serviceClientKey: 'hotel',
    hotelId: 'hotel',
    hotelNameSnapshot: 'Hotel',
    cityId: input.destinationId,
    checkInDate: '2026-10-01',
    checkOutDate: '2026-10-03',
    roomCount: 1,
    roomTypeId: 'room',
    occupancy: 1,
    inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
  };
  expect(() => validateSalesContract(input)).not.toThrow();
  input.services.find((s) => s.kind === 'HOTEL')!.metadata = {
    passengerHotelPricesV1: JSON.stringify({
      [id]: [{ currencyCode: 'USD', amount: '101' }],
    }),
  };
  expect(() => validateSalesContract(input)).toThrow(
    'مبلغ کل قرارداد باید برابر',
  );
});

it('validates individual hotel stay snapshots without an obsolete override price and rejects flight-only stays', () => {
  const input = structuredClone(draft),
    id = input.passengers[0]!.customerId;
  input.passengers = [
    { ...input.passengers[0]!, serviceClientKeys: ['flight', 'hotel'] },
    {
      ...input.passengers[0]!,
      customerId: '10000000-0000-4000-8000-000000000099',
      serviceClientKeys: ['flight'],
    },
  ];
  input.services = [
    ...input.services,
    {
      clientKey: 'hotel',
      kind: 'HOTEL',
      titleSnapshot: 'Sample hotel',
      metadata: {
        passengerHotelStaysV1: JSON.stringify({
          [id]: {
            different: true,
            checkInDate: '2026-10-02',
            checkOutDate: '2026-10-05',
          },
        }),
        passengerHotelPricesV1: JSON.stringify({
          [id]: [{ amount: '10', currencyCode: 'USD' }],
        }),
      },
    },
  ];
  input.hotelSelection = {
    serviceClientKey: 'hotel',
    hotelId: '10000000-0000-4000-8000-000000000010',
    hotelNameSnapshot: 'Sample',
    cityId: input.destinationId,
    checkInDate: '2026-10-01',
    checkOutDate: '2026-10-07',
    roomCount: 1,
    roomTypeId: '10000000-0000-4000-8000-000000000011',
    occupancy: 1,
    inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
  };
  expect(() => validateSalesContract(input)).not.toThrow();
  const metadata = { ...input.services[1]!.metadata! };
  input.services[1]!.metadata = metadata;
  metadata.passengerHotelStaysV1 = JSON.stringify({
    [input.passengers[1]!.customerId]: {
      different: true,
      checkInDate: '2026-10-02',
      checkOutDate: '2026-10-05',
    },
  });
  expect(() => validateSalesContract(input)).toThrow('اقامت باید فقط');
  metadata.passengerHotelStaysV1 = JSON.stringify({
    [id]: {
      different: true,
      checkInDate: '2026-10-02',
      checkOutDate: '2026-10-05',
    },
  });
  delete metadata.passengerHotelPricesV1;
  expect(() => validateSalesContract(input)).not.toThrow();
});

it('validates aggregate IRR/foreign prices and deductions without requiring flight-specific prices', () => {
  const input = structuredClone(draft);
  const id = input.passengers[0]!.customerId;
  input.services = input.services.map((s) => ({
    ...s,
    metadata: {
      passengerPackagePricingVersion: 1,
      passengerTotalPricesV1: JSON.stringify({
        [id]: [
          { amount: '100', currencyCode: 'IRR' },
          { amount: '20', currencyCode: 'USD' },
        ],
      }),
      passengerDeductionsV1: JSON.stringify({
        [id]: { discount: { amount: '10', currencyCode: 'IRR' } },
      }),
    },
  }));
  input.passengers = input.passengers.map((p) => ({
    ...p,
    agreedPrices: [
      { amount: '90', currencyCode: 'IRR' },
      { amount: '20', currencyCode: 'USD' },
    ],
  }));
  input.priceComponents = [
    {
      type: 'BASE',
      title: 'قیمت کل خدمات مسافران',
      amount: '90',
      currencyCode: 'IRR',
    },
    {
      type: 'BASE',
      title: 'قیمت کل خدمات مسافران',
      amount: '20',
      currencyCode: 'USD',
    },
  ];
  expect(() => validateSalesContract(input)).not.toThrow();
  input.passengers[0]!.agreedPrices = [
    { amount: '100', currencyCode: 'IRR' },
    { amount: '20', currencyCode: 'USD' },
  ];
  expect(() => validateSalesContract(input)).toThrow('مبلغ نهایی هر مسافر');
});

it('accepts city tour and guide using existing OTHER services with explicit passenger assignments', () => {
  const input = structuredClone(draft);
  input.services = [
    ...input.services,
    {
      clientKey: 'city-tour',
      kind: 'OTHER',
      titleSnapshot: 'گشت شهری',
      metadata: { additionalServiceRole: 'CITY_TOUR' },
    },
    {
      clientKey: 'tour-guide',
      kind: 'OTHER',
      titleSnapshot: 'راهنما',
      metadata: { additionalServiceRole: 'TOUR_GUIDE' },
    },
  ];
  input.passengers = [
    {
      ...input.passengers[0]!,
      serviceClientKeys: ['flight', 'city-tour', 'tour-guide'],
    },
    {
      ...input.passengers[0]!,
      customerId: '10000000-0000-4000-8000-000000000005',
      displayNameSnapshot: 'Second synthetic passenger',
      serviceClientKeys: ['flight'],
    },
  ];
  const before = structuredClone(input);
  expect(() => validateSalesContract(input)).not.toThrow();
  expect(input).toEqual(before);
});

describe('legacy customer-only contract', () => {
  const legacy = (): SalesContractCreateRequest => ({
    ...draft,
    tripType: 'ONE_WAY',
    returnNotBefore: null,
    services: [
      {
        clientKey: 'legacy-contract',
        kind: 'OTHER',
        titleSnapshot: 'Legacy contract',
        metadata: { legacyContractV1: true },
      },
    ],
    passengers: [],
    ticketSelections: [],
    hotelSelection: null,
    priceComponents: [
      {
        type: 'BASE',
        title: 'Agreed total',
        amount: '100',
        currencyCode: 'IRR',
      },
    ],
    payments: [],
  });
  it('accepts an explicitly marked customer-only contract without fake passengers or tickets', () => {
    expect(() => validateSalesContract(legacy(), true)).not.toThrow();
  });
  it('keeps normal passenger validation and forbids mixing legacy marker with operational passengers or flights', () => {
    expect(() => validateSalesContract({ ...draft, passengers: [] })).toThrow();
    expect(() =>
      validateSalesContract({ ...legacy(), passengers: draft.passengers }),
    ).toThrow();
    expect(() =>
      validateSalesContract({
        ...legacy(),
        services: [...legacy().services, ...draft.services],
      }),
    ).toThrow();
    expect(() =>
      validateSalesContract({ ...legacy(), priceComponents: [] }),
    ).toThrow();
  });
});

describe('aggregate legacy service contracts', () => {
  const aggregate = (): SalesContractCreateRequest => ({
    ...structuredClone(draft),
    passengers: [],
    services: draft.services.map((s) => ({
      ...s,
      metadata: {
        legacyServicePartiesV2: JSON.stringify({
          flight: { adults: 2, children: 1, infants: 1 },
        }),
      },
    })),
  });
  it('accepts contract-total historical mixed currencies and deductions without per-service prices', () => {
    const input = aggregate();
    input.services[0]!.metadata = {
      ...input.services[0]!.metadata,
      contractPackagePricingVersion: 1,
    };
    input.priceComponents = [
      {
        type: 'BASE',
        title: 'Contract total',
        amount: '100000000',
        currencyCode: 'IRR',
      },
      {
        type: 'BASE',
        title: 'Contract total',
        amount: '915.125',
        currencyCode: 'EUR',
      },
      {
        type: 'DISCOUNT',
        title: 'Contract discount',
        amount: '15.125',
        currencyCode: 'EUR',
      },
      {
        type: 'DISCOUNT',
        title: 'Contract commission',
        amount: '10000000',
        currencyCode: 'IRR',
      },
    ];
    expect(() => validateSalesContract(input)).not.toThrow();
    expect(input.ticketSelections).toHaveLength(2);
    expect(input.passengers).toEqual([]);
  });
  it('accepts real outward and return ticket selections without invented passengers', () => {
    expect(() => validateSalesContract(aggregate())).not.toThrow();
  });
  it('rejects missing/invalid counts and mixed personal identities', () => {
    const input = aggregate();
    expect(() =>
      validateSalesContract({ ...input, passengers: draft.passengers }),
    ).toThrow();
    expect(() =>
      validateSalesContract({ ...input, services: draft.services }),
    ).toThrow();
    input.services[0]!.metadata = {
      legacyServicePartiesV2: JSON.stringify({
        flight: { adults: 0, children: 0, infants: 0 },
      }),
    };
    expect(() => validateSalesContract(input)).toThrow();
  });
  it('retains normal ticket time and route validation', () => {
    const input = aggregate();
    input.ticketSelections![0]!.destinationId = input.originId;
    expect(() => validateSalesContract(input)).toThrow();
  });
});

it('validates aggregate legacy hotel occupancy and room age counts without personal guest assignments', () => {
  const input: SalesContractCreateRequest = {
    ...structuredClone(draft),
    tripType: 'ONE_WAY',
    returnNotBefore: null,
    passengers: [],
    ticketSelections: [],
    services: [
      {
        clientKey: 'hotel',
        kind: 'HOTEL',
        titleSnapshot: 'Hotel',
        metadata: {
          legacyServicePartiesV2: JSON.stringify({
            hotel: { adults: 2, children: 1, infants: 1 },
          }),
        },
      },
    ],
    hotelSelection: {
      serviceClientKey: 'hotel',
      hotelId: 'hotel',
      hotelNameSnapshot: 'Hotel',
      cityId: draft.destinationId,
      checkInDate: '2026-10-01',
      checkOutDate: '2026-10-03',
      roomCount: 1,
      roomTypeId: '10000000-0000-4000-8000-000000000005',
      occupancy: 4,
      inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
      rooms: [
        {
          ordinal: 1,
          roomTypeId: '10000000-0000-4000-8000-000000000005',
          roomTypeNameSnapshot: 'Standard',
          adults: 2,
          childAges: [5, 1],
        },
      ],
    },
  };
  expect(() => validateSalesContract(input)).not.toThrow();
  expect(() =>
    validateSalesContract({
      ...input,
      hotelSelection: { ...input.hotelSelection!, occupancy: 3 },
    }),
  ).toThrow();
  expect(() =>
    validateSalesContract({
      ...input,
      hotelSelection: {
        ...input.hotelSelection!,
        rooms: [
          {
            ...input.hotelSelection!.rooms![0]!,
            adults: 1,
            childAges: [5, 5, 1],
          },
        ],
      },
    }),
  ).toThrow();
});

it('validates anonymous per-age row prices against canonical totals without inventing passenger allocations', () => {
  const c: SalesContractCreateRequest = {
    ...draft,
    tripType: 'ONE_WAY',
    passengers: [],
    ticketSelections: [],
    services: [
      {
        clientKey: 'other',
        kind: 'OTHER',
        titleSnapshot: 'Synthetic',
        metadata: {
          contractPackagePricingVersion: 1,
          legacyServicePartiesV2: JSON.stringify({
            other: { adults: 1, children: 1, infants: 0 },
          }),
          legacyRowPricesV1: JSON.stringify({
            gross: {
              'legacy-ADT-1': [{ currencyCode: 'USD', amount: '80' }],
              'legacy-CHD-1': [{ currencyCode: 'USD', amount: '20' }],
            },
            deductions: {},
          }),
        },
      },
    ],
    priceComponents: [
      { type: 'BASE', title: 'Total', currencyCode: 'USD', amount: '100' },
    ],
  };
  expect(() => validateSalesContract(c, false)).not.toThrow();
  expect(() =>
    validateSalesContract(
      { ...c, priceComponents: [{ ...c.priceComponents[0]!, amount: '99' }] },
      false,
    ),
  ).toThrow('مجموع قیمت نفرات');
  expect(() =>
    validateSalesContract({ ...c, passengers: draft.passengers }, false),
  ).toThrow();
});

it.each(['ADT', 'CHD', 'INF'] as const)(
  'accepts unknown DOB with booked category %s and rejects missing/invalid facts',
  (ageCategory) => {
    const input = structuredClone(draft);
    input.passengers = input.passengers.map((p) => ({
      ...p,
      birthDate: '',
      ageCategory,
    }));
    expect(() => validateSalesContract(input)).not.toThrow();
    expect(
      contractPassengerAgeCategory(input.passengers[0]!, input.departureDate),
    ).toBe(ageCategory);
    expect(() =>
      contractPassengerAgeCategory({ birthDate: '' }, input.departureDate),
    ).toThrow();
    expect(() =>
      contractPassengerAgeCategory(
        { birthDate: 'invalid', ageCategory },
        input.departureDate,
      ),
    ).toThrow();
  },
);
