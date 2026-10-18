import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SalesContractAmendmentV1 } from '@nora/contracts';
import {
  PassengerAgeEditor,
  changeAmendmentPassengerAge,
} from './passenger-age-editor';

const draft = {
  passengerCategories: { person: 'ADT' },
  passengers: [
    {
      customerId: 'person',
      displayNameSnapshot: 'Synthetic',
      birthDate: '2000-01-01',
      serviceClientKeys: ['hotel'],
      accommodationKind: 'SINGLE',
    },
  ],
} as unknown as SalesContractAmendmentV1;
it('changes contract category and accommodation without rewriting identity; clears child band when leaving childhood', () => {
  const child = changeAmendmentPassengerAge(draft, 'person', 'CHD');
  expect(child.passengerCategories.person).toBe('CHD');
  expect(child.passengers[0]).toMatchObject({
    birthDate: '2000-01-01',
    accommodationKind: 'CHILD_WITH_BED',
    childAgeBand: null,
  });
  const withBand = {
    ...child,
    passengers: child.passengers.map((p) => ({
      ...p,
      childAgeBand: 'AGE_6_12' as const,
    })),
  };
  expect(
    changeAmendmentPassengerAge(withBand, 'person', 'INF').passengers[0],
  ).toMatchObject({ childAgeBand: null, accommodationKind: 'INFANT' });
  expect(
    changeAmendmentPassengerAge(withBand, 'person', 'ADT').passengers[0],
  ).toMatchObject({ childAgeBand: null, accommodationKind: 'DBL' });
  expect(draft.passengerCategories.person).toBe('ADT');
});
it('offers exactly the requested child bands in the same age editor, with disabled and adult states', () => {
  const child = changeAmendmentPassengerAge(draft, 'person', 'CHD');
  const props = {
    passenger: { ...child.passengers[0]!, childAgeBand: 'AGE_6_12' as const },
    category: 'CHD' as const,
    disabled: false,
    onCategory: vi.fn(),
    onBand: vi.fn(),
    onAccommodation: vi.fn(),
  };
  const html = renderToStaticMarkup(<PassengerAgeEditor {...props} />);
  expect(html).toContain('AGE_2_6');
  expect(html).toContain('AGE_6_12');
  expect(html).toContain('۲ تا ۶ سال');
  expect(html).toContain('۶ تا ۱۲ سال');
  expect(html).not.toContain('تاریخ تولد');
  expect(
    renderToStaticMarkup(<PassengerAgeEditor {...props} disabled />),
  ).toContain('disabled');
  expect(
    renderToStaticMarkup(<PassengerAgeEditor {...props} category="ADT" />),
  ).not.toContain('AGE_2_6');
});
