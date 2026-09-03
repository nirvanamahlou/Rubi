import { describe, expect, it } from 'vitest';

import { emptySalesForm, salesPayload } from './sales-form';

describe('sales contract form payload', () => {
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
