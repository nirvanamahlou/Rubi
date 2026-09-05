import { describe, expect, it } from 'vitest';

import type { SalesContractCreateRequest } from '@rubi/contracts';

import {
  calculateSalesBalances,
  passengerAgeCategory,
  salesFingerprint,
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
    { clientKey: 'flight', kind: 'FLIGHT', titleSnapshot: 'پرواز رفت‌وبرگشت' },
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
            ? { date: '2026-10-10', pickup: 'هتل', dropoff: 'فرودگاه' }
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
        { clientKey: 'other-transport', kind, titleSnapshot: 'وسیله دیگر' },
      ];
      expect(() => validateSalesContract(input)).toThrow(
        'پرواز با قطار یا اتوبوس',
      );
    },
  );
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
          { type: 'BASE', title: 'قیمت', amount: '1000', currencyCode: 'IRR' },
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

  it('derives passenger category at departure date', () => {
    expect(passengerAgeCategory('2025-01-01', '2026-10-01')).toBe('INF');
    expect(passengerAgeCategory('2020-01-01', '2026-10-01')).toBe('CHD');
    expect(passengerAgeCategory('2000-01-01', '2026-10-01')).toBe('ADT');
  });
});
