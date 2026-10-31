import { describe, expect, it } from 'vitest';
import { contractReviewOutput } from './contract-review';
import {
  emptySalesForm,
  salesPayload,
  type SalesFormState,
} from './sales-form';
import { contractPrintHtml } from './contract-print';
import { printFixture } from './contract-print.fixture';
const state: SalesFormState = {
  ...emptySalesForm,
  customerId: 'buyer',
  customerName: 'Synthetic Buyer',
  departureDate: '2099-10-20',
  originId: 'origin',
  destinationId: 'destination',
  serviceKinds: ['OTHER'],
  passengers: [
    {
      customerId: 'adult',
      displayName: 'PASSPORT ADULT',
      birthDate: '1990-01-01',
    },
    {
      customerId: 'child',
      displayName: 'PASSPORT CHILD',
      birthDate: '2092-01-01',
    },
    {
      customerId: 'infant',
      displayName: 'PASSPORT INFANT',
      birthDate: '2099-01-01',
    },
  ],
  priceComponents: [
    { type: 'BASE', title: 'Sale', amount: '100000.25', currencyCode: 'IRR' },
    { type: 'BASE', title: 'Room', amount: '15.75', currencyCode: 'USD' },
    { type: 'BASE', title: 'Room2', amount: '4.25', currencyCode: 'USD' },
  ],
};
const now = '2099-10-01T09:00:00Z';
describe('unregistered contract review', () => {
  it('carries the printed notice through the saved payload and draft renderer without internal notes', () => {
    const draft = {
      ...state,
      serviceKinds: ['OTHER', 'CIP'] as SalesFormState['serviceKinds'],
      contractNotice: '  خدمات مطابق توافق\nزمان حضور: ساعت ۸  ',
      reservationNote: 'INTERNAL RESERVATION NOTE',
      pricingNotes: 'INTERNAL PRICING NOTE',
    };
    const payload = salesPayload(draft);
    expect(
      payload.services.filter((s) => s.metadata?.contractNotice),
    ).toHaveLength(1);
    expect(payload.services[0]?.metadata).toMatchObject({
      contractNotice: 'خدمات مطابق توافق\nزمان حضور: ساعت ۸',
      reservationNote: 'INTERNAL RESERVATION NOTE',
    });
    const output = contractReviewOutput(draft, printFixture.company, now);
    const html = contractPrintHtml(output, { names: {} });
    expect(html).toContain('<p>خدمات مطابق توافق\nزمان حضور: ساعت ۸</p>');
    expect(html).not.toContain('INTERNAL RESERVATION NOTE');
    expect(html).not.toContain('INTERNAL PRICING NOTE');
  });
  it('uses exactly the final payload, without mutating draft or allocating identity', () => {
    const before = JSON.stringify(state),
      payload = salesPayload(state);
    const { contract } = contractReviewOutput(state, printFixture.company, now);
    expect(JSON.stringify(state)).toBe(before);
    expect(contract.id).toBe('');
    expect(contract.contractNumber).toContain('ثبت نشده');
    expect(contract.status).toBe('DRAFT');
    expect(contract.reservationStatus).toBe('NOT_SENT');
    expect(contract.servicesDetail).toEqual(payload.services);
    expect(contract.priceComponents).toEqual(payload.priceComponents);
    expect(contract.passengersDetail.map((p) => p.displayNameSnapshot)).toEqual(
      payload.passengers.map((p) => p.displayNameSnapshot),
    );
    expect(contract.passengersDetail.map((p) => p.ageCategory)).toEqual([
      'ADT',
      'CHD',
      'INF',
    ]);
    expect(contract.balances.map((p) => [p.currencyCode, p.amount])).toEqual([
      ['IRR', '100000.25'],
      ['USD', '20'],
    ]);
  });
  it('subtracts discounts without losing decimal precision', () => {
    const output = contractReviewOutput(
      {
        ...state,
        priceComponents: [
          ...state.priceComponents,
          {
            type: 'DISCOUNT',
            title: 'Discount',
            amount: '0.25',
            currencyCode: 'IRR',
          },
        ],
      },
      printFixture.company,
      now,
    );
    expect(output.contract.balances[0]?.amount).toBe('100000');
  });
  it('updates the same canonical contract presentation after editing, escaping entered names', () => {
    const output = contractReviewOutput(
      { ...state, customerName: '<script>bad</script>' },
      printFixture.company,
      now,
    );
    const html = contractPrintHtml(
      output,
      { names: { origin: 'Origin', destination: 'Destination' } },
      { draft: true },
    );
    expect(html).toContain('پیش‌نمایش قرارداد — هنوز ثبت');
    expect(html).toContain('PASSPORT CHILD');
    expect(html).toContain('&lt;script&gt;bad&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(contractPrintHtml(printFixture, { names: {} })).not.toContain(
      'پیش‌نمایش قرارداد — هنوز ثبت',
    );
  });
});

it.each(['AGE_2_6', 'AGE_6_12'] as const)(
  'keeps unknown-DOB child %s through payload, preview and both output tables',
  (childAgeBand) => {
    const next = {
      ...state,
      passengers: [
        {
          customerId: 'child',
          displayName: 'SYNTHETIC CHILD',
          birthDate: '',
          ageCategory: 'CHD' as const,
          childAgeBand,
        },
      ],
    };
    expect(salesPayload(next).passengers[0]).toMatchObject({
      ageCategory: 'CHD',
      childAgeBand,
      birthDate: '',
    });
    const output = contractReviewOutput(next, printFixture.company, now);
    expect(output.contract.passengersDetail[0]).toMatchObject({
      ageCategory: 'CHD',
      childAgeBand,
    });
    const html = contractPrintHtml(output, { names: {} });
    expect(
      html.match(
        childAgeBand === 'AGE_2_6'
          ? /کودک \(<bdi dir="ltr">2-6<\/bdi>\)/g
          : /کودک \(<bdi dir="ltr">6-12<\/bdi>\)/g,
      ),
    ).toHaveLength(2);
  },
);
