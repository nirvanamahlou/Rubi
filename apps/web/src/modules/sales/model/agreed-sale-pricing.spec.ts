import { expect, it } from 'vitest';
import { agreedSalePricing } from './agreed-sale-pricing';
import { emptySalesForm, salesPayload } from './sales-form';

it('mirrors exact agreed values per service and currency without changing the source or rounding', () => {
  const values = {
    'flight-outbound': [
      {
        version: 1 as const,
        currencyCode: 'IRR',
        daySale: { basis: 'TOTAL' as const, amount: '100' },
        agreed: { basis: 'TOTAL' as const, amount: '9007199254740993.1234' },
      },
    ],
    hotel: [
      {
        version: 1 as const,
        currencyCode: 'USD',
        daySale: { basis: 'NIGHT' as const, amount: '10' },
        agreed: { basis: 'TOTAL' as const, amount: '27.1234' },
      },
      {
        version: 1 as const,
        currencyCode: 'EUR',
        daySale: { basis: 'TOTAL' as const, amount: '30' },
        agreed: { basis: 'NIGHT' as const, amount: '0' },
      },
    ],
  };
  const next = agreedSalePricing(values);
  expect(next.hotel![0]!.daySale).toEqual({
    basis: 'TOTAL',
    amount: '27.1234',
  });
  expect(next.hotel![1]!.daySale).toEqual({ basis: 'NIGHT', amount: '0' });
  expect(next['flight-outbound']![0]!.daySale.amount).toBe(
    '9007199254740993.1234',
  );
  expect(values.hotel[0]!.daySale.amount).toBe('10');
  expect(next.hotel![0]!.daySale).not.toBe(values.hotel[0]!.agreed);
  expect(agreedSalePricing(next)).toEqual(next);
});
it('submits mirrored pricing for a restored new-contract draft without an extra day-sale edit', () => {
  const pricing = agreedSalePricing({
    other: [
      {
        version: 1,
        currencyCode: 'USD',
        daySale: { basis: 'TOTAL', amount: '' },
        agreed: { basis: 'TOTAL', amount: '95.1250' },
      },
    ],
  });
  const payload = salesPayload({
    ...emptySalesForm,
    departureDate: '2026-10-10',
    serviceKinds: ['OTHER'],
    servicePricing: pricing,
  });
  expect(payload.services[0]!.pricing![0]!.daySale).toEqual({
    basis: 'TOTAL',
    amount: '95.1250',
  });
  expect(payload.priceComponents.some((p) => p.type === 'DISCOUNT')).toBe(
    false,
  );
});

it('carries an independent catalog quote while persisting the agreed sale amount', () => {
  const catalog = {
    version: 1 as const,
    currencyCode: 'IRR',
    daySale: { basis: 'TOTAL' as const, amount: '100' },
    agreed: { basis: 'TOTAL' as const, amount: '100' },
  };
  const agreed = {
    ...catalog,
    agreed: { basis: 'TOTAL' as const, amount: '95' },
  };
  const payload = salesPayload({
    ...emptySalesForm,
    serviceKinds: ['FLIGHT'],
    outboundOffer: {
      id: 'offer',
      version: 1,
      branchId: 'branch',
      originId: 'origin',
      destinationId: 'destination',
      departureAt: '2026-10-10T10:00:00Z',
      arrivalAt: '2026-10-10T12:00:00Z',
      carrierName: 'Synthetic Air',
      serviceNumber: 'TEST',
      cabinClassCode: 'ECONOMY',
      totalCapacity: 10,
      remainingCapacity: 10,
      status: 'ACTIVE',
    },
    servicePricing: agreedSalePricing({ 'flight-outbound': [agreed] }),
    catalogSalePricing: { 'flight-outbound': [catalog] },
  });
  expect(payload.services[0]!.pricing![0]!.daySale.amount).toBe('95');
  expect(payload.services[0]!.metadata!.catalogSaleQuote).toEqual({
    version: 1,
    amount: '100',
    currencyCode: 'IRR',
  });
});
