import type * as React from 'react';
import type * as Entry from '@/modules/customers/public/entry';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { SalesPeopleSheet } from './sales-people-sheet';
import { emptySalesForm } from '../model/sales-form';
import type { SalesPeopleDraft } from '../model/sales-people-sheet';
const fixture = vi.hoisted(() => ({
  cells: [] as unknown[],
  cursor: 0,
  rows: [] as Entry.CustomerEntryRow[],
  search: null as null | {
    onSelect: (person: { id: string; displayName: string }) => void;
    purpose: string;
  },
  detail: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const i = fixture.cursor++;
    if (!(i in fixture.cells))
      fixture.cells[i] =
        typeof initial === 'function' ? (initial as () => unknown)() : initial;
    return [
      fixture.cells[i],
      (next: unknown) => {
        fixture.cells[i] = next;
      },
    ];
  },
}));
vi.mock('@/modules/customers/public/entry', async (original) => ({
  ...(await original<typeof Entry>()),
  salesPeopleApi: { detail: fixture.detail },
  CustomerEntrySheet: (props: { rows: Entry.CustomerEntryRow[] }) => {
    fixture.rows = props.rows;
    return (
      <div data-testid="passenger-table">
        {props.rows.map((row) => (
          <div key={row.key} data-row={row.key}>
            {row.actions}
          </div>
        ))}
      </div>
    );
  },
}));
vi.mock('./sales-person-search', () => ({
  SalesPersonSearch: (props: NonNullable<typeof fixture.search>) => {
    fixture.search = props;
    return <div data-testid="existing-person-search" />;
  },
}));
vi.mock('./sales-date-picker', () => ({ SalesDatePicker: () => <div /> }));
const state = {
  ...emptySalesForm,
  serviceKinds: ['OTHER' as const],
  departureDate: '2027-09-14',
  passengerComposition: { adults: 1, children: 0, infants: 0 },
  firstPassengerIsCustomer: true,
};
let draft: SalesPeopleDraft | null = null;
const change = vi.fn((next: SalesPeopleDraft) => {
  draft = next;
});
function render() {
  fixture.cursor = 0;
  return renderToStaticMarkup(
    <SalesPeopleSheet
      state={state}
      draft={draft}
      onDraftChange={change}
      onConfirmed={vi.fn()}
      onBusyChange={vi.fn()}
      onAddInfant={vi.fn()}
    />,
  );
}
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  fixture.cells = [];
  fixture.cursor = 0;
  fixture.rows = [];
  fixture.search = null;
  draft = null;
  change.mockClear();
  fixture.detail.mockReset();
});
it('opens selection at the clicked passenger row and hydrates authorized saved identity/contact', async () => {
  render();
  const action = fixture.rows[0]!.actions as React.ReactElement<{
    children: React.ReactElement<{ onClick: () => void }>[];
  }>;
  action.props.children[0]!.props.onClick();
  const html = render();
  expect(html.indexOf('data-testid="existing-person-search"')).toBeGreaterThan(
    html.indexOf('data-row="p0"'),
  );
  expect(html.match(/data-testid="existing-person-search"/g)).toHaveLength(1);
  expect(fixture.search?.purpose).toBe('passenger');
  fixture.detail.mockResolvedValue({
    data: {
      id: 'saved',
      displayName: 'Synthetic Saved',
      firstName: 'Synthetic',
      lastName: 'Saved',
      birthDate: '1990-01-02',
      passportFirstName: 'SYNTHETIC',
      passportLastName: 'SAVED',
      passportNumber: 'S123456',
      passportExpiryDate: '2029-01-01',
      contacts: [
        { type: 'phone', value: '09120000000', isPrimary: true },
        { type: 'phone', value: '02112345678' },
      ],
      addresses: [{ isPrimary: true, label: 'Synthetic address' }],
    },
  });
  fixture.search!.onSelect({ id: 'saved', displayName: 'Synthetic Saved' });
  await vi.waitFor(() => expect(change).toHaveBeenCalled());
  expect(fixture.detail).toHaveBeenCalledWith('saved', 'customer-verification');
  expect(draft?.rows.p0?.values).toMatchObject({
    birthDate: '1990-01-02',
    passportFirstName: 'SYNTHETIC',
    passportLastName: 'SAVED',
    passportNumber: 'S123456',
    phone: '09120000000',
  });
  expect(draft?.buyerContact).toMatchObject({
    name: 'Synthetic Saved',
    phone: '09120000000',
    landline: '02112345678',
    address: 'Synthetic address',
  });
  expect(render()).not.toContain('data-testid="existing-person-search"');
});
