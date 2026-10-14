import { describe, expect, it } from 'vitest';
import {
  contractSaleComponents,
  emptySalesForm,
  salesPayload,
} from './sales-form';
import {
  servicePriceComponents,
  validateInsuranceExtras,
  validatePassengerPackagePrices,
  SALES_CHEQUE_FEE,
} from '@nora/contracts';

describe('contract sale totals', () => {
  it('keeps each currency exact and independent of passenger count', () => {
    const state = {
      ...emptySalesForm,
      priceEntryMode: 'CONTRACT_TOTAL' as const,
      contractPrices: [
        { currencyCode: 'IRR', amount: '2500000000' },
        { currencyCode: 'USD', amount: '99.1234' },
      ],
    };
    const once = contractSaleComponents(state);
    expect(once.map((p) => p.amount)).toEqual(['2500000000', '99.1234']);
    expect(
      contractSaleComponents({
        ...state,
        passengers: [
          { customerId: 'one', displayName: 'One', birthDate: '1990-01-01' },
        ],
      }),
    ).toEqual(once);
  });
  it('does not submit legacy passenger allocations or catalog prices', () => {
    const state = {
      ...emptySalesForm,
      priceEntryMode: 'CONTRACT_TOTAL' as const,
      departureDate: '2026-11-01',
      serviceKinds: ['TRANSFER' as const],
      contractPrices: [{ currencyCode: 'IRR', amount: '12500' }],
      passengers: [
        { customerId: 'one', displayName: 'One', birthDate: '1990-01-01' },
      ],
      passengerPrices: { one: [{ currencyCode: 'IRR', amount: '999999' }] },
    };
    const payload = salesPayload(state);
    expect(payload.priceComponents[0]?.amount).toBe('12500');
    expect(payload.passengers[0]?.agreedPrices).toBeUndefined();
    expect(payload.services.every((s) => s.pricing === undefined)).toBe(true);
  });
  it('rejects empty, duplicate, negative and invalid totals', () => {
    expect(() => contractSaleComponents(emptySalesForm)).toThrow();
    for (const prices of [
      [{ currencyCode: 'IRR', amount: '-1' }],
      [{ currencyCode: 'IRR', amount: '' }],
      [
        { currencyCode: 'IRR', amount: '1' },
        { currencyCode: 'IRR', amount: '2' },
      ],
    ])
      expect(() =>
        contractSaleComponents({ ...emptySalesForm, contractPrices: prices }),
      ).toThrow();
  });
  it('adds insurance surcharge once and validates a contract without passenger allocations', () => {
    const state = {
      ...emptySalesForm,
      priceEntryMode: 'CONTRACT_TOTAL' as const,
      departureDate: '2026-11-01',
      serviceKinds: ['INSURANCE' as const],
      passengers: [
        { customerId: 'one', displayName: 'One', birthDate: '1950-01-01' },
      ],
      insurancePlan: {
        id: 'plan',
        name: 'Plan',
        code: 'PLAN',
        recordVersion: 1,
        insurerId: 'insurer',
        insurerName: 'Insurer',
      },
      insuranceExtraToman: { one: '10' },
      contractPrices: [
        { currencyCode: 'IRR', amount: '1000' },
        { currencyCode: 'USD', amount: '2.5' },
      ],
    };
    const payload = salesPayload(state);
    expect(payload.priceComponents.map((p) => p.amount)).toEqual([
      '1100',
      '2.5',
    ]);
    expect(servicePriceComponents(payload.services)).toBeNull();
    expect(() => validateInsuranceExtras(payload)).not.toThrow();
    expect(() =>
      validatePassengerPackagePrices(
        payload.passengers,
        payload.priceComponents,
      ),
    ).not.toThrow();
    expect(() =>
      validateInsuranceExtras({
        ...payload,
        priceComponents: [
          { type: 'BASE', title: 'Total', currencyCode: 'IRR', amount: '99' },
        ],
      }),
    ).toThrow();
    expect(salesPayload(state).priceComponents).toEqual(
      payload.priceComponents,
    );
    expect(() =>
      validateInsuranceExtras({
        ...payload,
        priceComponents: [
          { type: 'BASE', title: 'Total', currencyCode: 'IRR', amount: '99' },
          {
            type: 'BASE',
            title: SALES_CHEQUE_FEE,
            currencyCode: 'IRR',
            amount: '1000',
          },
        ],
      }),
    ).toThrow();
  });
});
