import { describe, expect, it } from 'vitest';
import type { MasterDataRecord } from '@rubi/contracts';

import {
  emptySalesForm,
  salesPayload,
  salesPassengerAgeLabel,
  salesSteps,
  salesDirections,
  salesDetailSteps,
  salesReturnSearchFrom,
  withSalesRouteDefaults,
  normalizeRouteSearch,
} from './sales-form';

describe('sales contract form payload', () => {
  const reference = (
    id: string,
    name: string,
    attributes: MasterDataRecord['attributes'],
    resource: MasterDataRecord['resource'] = 'cities',
  ): MasterDataRecord => ({
    id,
    name,
    attributes,
    resource,
    code: id,
    status: 'active',
    version: 1,
    createdAt: '',
    updatedAt: '',
  });
  const countries = [
    reference('ir', 'ایران', { iso2Code: 'IR' }, 'countries'),
    reference('tr', 'ترکیه', { iso2Code: 'TR' }, 'countries'),
  ];
  const cities = [
    reference('teh', 'تهران', { countryId: 'ir' }),
    reference('ant', 'آنتالیا', { countryId: 'tr' }),
    reference('other', 'شهر دیگر', { countryId: 'ir' }),
  ];
  it('resolves real Tehran/Antalya IDs under their respective countries', () => {
    expect(
      withSalesRouteDefaults(emptySalesForm, countries, cities),
    ).toMatchObject({
      originCountryId: 'ir',
      originId: 'teh',
      destinationCountryId: 'tr',
      destinationId: 'ant',
    });
    expect(withSalesRouteDefaults(emptySalesForm, [], [])).toMatchObject({
      originId: '',
      destinationId: '',
    });
  });
  it('preserves an existing draft route and infers its country', () => {
    expect(
      withSalesRouteDefaults(
        { ...emptySalesForm, originId: 'other' },
        countries,
        cities,
      ),
    ).toMatchObject({ originId: 'other', originCountryId: 'ir' });
    expect(normalizeRouteSearch('آنتاليا')).toBe(
      normalizeRouteSearch('انتالیا'),
    );
  });
  it('sends outbound flight and independent return transfer with distinct passenger assignments', () => {
    const state = {
      ...emptySalesForm,
      tripType: 'ROUND_TRIP' as const,
      departureDate: '2027-01-01',
      originId: 'teh',
      destinationId: 'ant',
      serviceKinds: ['FLIGHT', 'TRANSFER'] as const,
      serviceDirections: {
        FLIGHT: ['OUTBOUND'] as const,
        TRANSFER: ['RETURN'] as const,
      },
    };
    const input = {
      ...state,
      serviceKinds: [...state.serviceKinds],
      serviceDirections: {
        FLIGHT: [...state.serviceDirections.FLIGHT],
        TRANSFER: [...state.serviceDirections.TRANSFER],
      },
      ticket: {
        ...emptySalesForm.ticket,
        outboundOfferId: 'out',
        outboundDepartureAt: '2027-01-01T08:00:00Z',
        outboundArrivalAt: '2027-01-01T10:00:00Z',
      },
      passengers: [
        {
          customerId: 'p',
          displayName: 'مسافر آزمون',
          birthDate: '2000-01-01',
        },
      ],
      serviceDetails: {
        'TRANSFER-RETURN': {
          date: '2027-01-10',
          pickup: 'هتل',
          dropoff: 'فرودگاه',
        },
      },
    };
    const payload = salesPayload(input);
    expect(payload.ticketSelections?.map((item) => item.direction)).toEqual([
      'OUTBOUND',
    ]);
    expect(payload.services[1]).toMatchObject({
      clientKey: 'transfer-return',
      metadata: {
        direction: 'RETURN',
        date: '2027-01-10',
        pickup: 'هتل',
        dropoff: 'فرودگاه',
      },
    });
    expect(payload.passengers[0]?.serviceClientKeys).toEqual([
      'flight-outbound',
      'transfer-return',
    ]);
    expect(salesDetailSteps(input)).toEqual([
      'FLIGHT-OUTBOUND',
      'TRANSFER-RETURN',
    ]);
  });
  it('supports a return-only flight without an outbound offer', () => {
    const input = {
      ...emptySalesForm,
      tripType: 'ROUND_TRIP' as const,
      departureDate: '2027-01-01',
      serviceKinds: ['FLIGHT' as const],
      serviceDirections: { FLIGHT: ['RETURN' as const] },
      originId: 'teh',
      destinationId: 'ant',
      ticket: {
        ...emptySalesForm.ticket,
        returnOfferId: 'back',
        returnDepartureAt: '2027-03-01T08:00:00Z',
        returnArrivalAt: '2027-03-01T10:00:00Z',
      },
    };
    expect(salesPayload(input).ticketSelections).toEqual([
      expect.objectContaining({
        direction: 'RETURN',
        originId: 'ant',
        destinationId: 'teh',
      }),
    ]);
    expect(salesReturnSearchFrom(input)).toBe('2027-01-01');
    expect(
      salesDirections(
        { ...input, serviceDirections: { FLIGHT: ['RETURN', 'OUTBOUND'] } },
        'FLIGHT',
      ),
    ).toEqual(['OUTBOUND', 'RETURN']);
  });
  it('keeps legacy round-trip drafts compatible and only shows selected services', () => {
    expect(
      salesDetailSteps({
        ...emptySalesForm,
        tripType: 'ROUND_TRIP',
        serviceKinds: ['FLIGHT', 'VISA'],
      }),
    ).toEqual(['FLIGHT-OUTBOUND', 'FLIGHT-RETURN', 'VISA']);
    expect(
      salesDetailSteps({ ...emptySalesForm, serviceKinds: ['HOTEL'] }),
    ).toEqual(['HOTEL']);
  });
  it('starts with route/services and derives age at travel date', () => {
    expect(salesSteps[0]).toBe('مسیر و خدمات');
    expect(salesPassengerAgeLabel('2025-10-02', '2027-10-01')).toBe('نوزاد');
    expect(salesPassengerAgeLabel('2025-10-01', '2027-10-01')).toBe('کودک');
    expect(salesPassengerAgeLabel('2015-10-01', '2027-10-01')).toBe('بزرگسال');
  });
  it('builds a mixed-currency contract and UTC payment schedule', () => {
    const payload = salesPayload({
      ...emptySalesForm,
      customerId: '10000000-0000-4000-8000-000000000001',
      customerName: 'مشتری آزمون',
      originId: '10000000-0000-4000-8000-000000000002',
      destinationId: '10000000-0000-4000-8000-000000000003',
      departureDate: '2026-10-01',
      serviceKinds: ['VISA', 'HOTEL'],
      visaReferenceId: 'visa-public-reference',
      passengers: [
        {
          customerId: '10000000-0000-4000-8000-000000000004',
          displayName: 'مسافر آزمون',
          birthDate: '1990-01-01',
        },
      ],
      priceComponents: [
        {
          type: 'BASE',
          title: 'ریالی',
          amount: '1000000',
          currencyCode: 'IRR',
        },
        { type: 'BASE', title: 'ارزی', amount: '100', currencyCode: 'USD' },
      ],
      payments: [
        {
          amount: '500000',
          currencyCode: 'IRR',
          dueAt: '2026-09-10T10:30',
          method: 'BANK_TRANSFER',
        },
      ],
    });
    expect(payload.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'VISA',
          referenceId: 'visa-public-reference',
        }),
      ]),
    );
    expect(
      payload.priceComponents.map(({ currencyCode }) => currencyCode),
    ).toEqual(['IRR', 'USD']);
    expect(payload.payments?.[0]?.dueAt).toMatch(/Z$/);
    expect(payload.passengers[0]?.serviceClientKeys).toEqual(['visa', 'hotel']);
  });
});
