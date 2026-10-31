import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ContractReviewPreview } from './contract-review-preview';
import { emptySalesForm } from '../model/sales-form';
import type { SalesReferences } from '../api/reference-refresh';
const fixture = vi.hoisted(() => ({ company: true }));
vi.mock('@/modules/legal-entities/components/legal-entity-context', () => ({
  useLegalEntityContext: () => ({
    context: {
      legalEntity: fixture.company
        ? {
            id: 'company',
            code: 'JAHAN_BASTAN',
            persianName: 'شرکت آزمایشی',
            latinName: 'SAMPLE',
            brandingSnapshotVersion: 1,
          }
        : null,
    },
  }),
}));
const references: SalesReferences = {
  countries: [],
  cities: [],
  hotels: [],
  roomTypes: [],
  visaServices: [],
  banks: [],
  currencies: [],
  airlines: [],
};
const state = {
  ...emptySalesForm,
  departureDate: '2099-10-20',
  customerName: 'BUYER',
  serviceKinds: ['OTHER' as const],
  priceComponents: [
    {
      type: 'BASE' as const,
      title: 'Sale',
      amount: '125.5',
      currencyCode: 'USD',
    },
  ],
  passengers: [
    {
      customerId: 'one',
      displayName: 'PASSPORT NAME',
      birthDate: '1990-01-01',
    },
  ],
};
describe('review contract document', () => {
  it('retains Gregorian travel dates for an international draft preview', () => {
    const html = renderToStaticMarkup(
      <ContractReviewPreview
        state={{
          ...state,
          destinationCountryCode: 'TR',
          serviceKinds: ['HOTEL'],
          hotel: {
            ...state.hotel,
            hotelId: 'hotel',
            roomTypeId: 'room',
            name: 'Synthetic hotel',
            checkIn: '2026-10-23',
            checkOut: '2026-10-25',
            guestCustomerIds: ['one'],
          },
        }}
        references={references}
      />,
    );
    expect(html).toContain('<iframe');
    expect(html).toContain('23/10/2026');
    expect(html).toContain('25/10/2026');
  });
  it('shows the full sandboxed document and follows edits without creating or confirming anything', () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    try {
      const html = renderToStaticMarkup(
        <ContractReviewPreview state={state} references={references} />,
      );
      expect(html).toContain('<iframe');
      expect(html).toContain('sandbox=""');
      expect(html).toContain('PASSPORT NAME');
      expect(html).toContain('125.5');
      const edited = renderToStaticMarkup(
        <ContractReviewPreview
          state={{
            ...state,
            passengers: [
              { ...state.passengers[0]!, displayName: 'EDITED NAME' },
            ],
          }}
          references={references}
        />,
      );
      expect(edited).toContain('EDITED NAME');
      expect(edited).not.toContain('PASSPORT NAME');
      expect(fetch).not.toHaveBeenCalled();
      expect(html).not.toContain('<button');
    } finally {
      fetch.mockRestore();
    }
  });
  it('requires a concrete issuer instead of inventing a company for an aggregate context', () => {
    fixture.company = false;
    try {
      const html = renderToStaticMarkup(
        <ContractReviewPreview state={state} references={references} />,
      );
      expect(html).toContain('شرکت فعال را انتخاب کنید');
      expect(html).not.toContain('<iframe');
    } finally {
      fixture.company = true;
    }
  });
});
