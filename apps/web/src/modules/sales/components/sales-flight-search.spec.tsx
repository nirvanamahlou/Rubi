import type * as ButtonModule from '@/components/ui/button';
import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import type { FlightDateRange } from './flight-date-range';
import { emptySalesForm, type SalesFormState } from '../model/sales-form';
import { SalesContractForm } from './sales-contract-form';

const fixture = vi.hoisted(() => ({
  cells: [] as unknown[],
  cursor: 0,
  draft: null as SalesFormState | null,
  pickers: [] as {
    selectedId: string;
    onSelect: (offer: TicketOfferV1) => void;
    query: { originId: string };
  }[],
  dates: null as null | {
    onChange: (range: FlightDateRange) => void;
    onReturningOffers: (offers: TicketOfferV1[]) => void;
  },
  search: null as null | (() => void),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const index = fixture.cursor++;
    if (!(index in fixture.cells)) {
      const value =
        typeof initial === 'function' ? (initial as () => unknown)() : initial;
      fixture.cells[index] =
        value && typeof value === 'object' && 'serviceKinds' in value
          ? fixture.draft
          : value;
    }
    return [
      fixture.cells[index],
      (next: unknown) => {
        fixture.cells[index] =
          typeof next === 'function'
            ? (next as (value: unknown) => unknown)(fixture.cells[index])
            : next;
      },
    ];
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/modules/legal-entities/components/legal-entity-context', () => ({
  useLegalEntityContext: () => ({ context: { legalEntity: null } }),
}));
vi.mock('@/components/ui/button', async (original) => ({
  ...(await original<typeof ButtonModule>()),
  Button: (props: React.ComponentProps<'button'>) => {
    if (props['aria-label'] === 'جست‌وجوی بلیط‌ها')
      fixture.search = props.onClick as () => void;
    return (
      <button type="button" disabled={props.disabled}>
        {props.children}
      </button>
    );
  },
}));
vi.mock('./flight-trip-dates', () => ({
  FlightTripDates: (props: NonNullable<typeof fixture.dates>) => {
    fixture.dates = props;
    return <div>flight calendars</div>;
  },
}));
vi.mock('./ticket-offer-picker', () => ({
  TicketOfferPicker: (props: (typeof fixture.pickers)[number]) => {
    fixture.pickers.push(props);
    return <div>flight cards</div>;
  },
}));
vi.mock('./sales-people-sheet', () => ({
  SalesPeopleSheet: () => <div>passenger table</div>,
}));
vi.mock('./contract-flight-editor', () => ({
  ContractFlightEditor: () => null,
}));

const out: TicketOfferV1 = {
  id: 'out',
  version: 1,
  branchId: 'branch',
  originId: 'origin',
  destinationId: 'destination',
  departureAt: '2099-10-01T08:00:00Z',
  arrivalAt: '2099-10-01T11:00:00Z',
  carrierName: 'Synthetic',
  serviceNumber: '1',
  cabinClassCode: 'ECONOMY',
  totalCapacity: 10,
  remainingCapacity: 10,
  status: 'ACTIVE',
  loadGroupId: 'load',
  returnMinDays: 1,
  returnMaxDays: 7,
  roundTripSalePrices: [
    { returnOfferId: 'back', revision: 1, amount: '100', currencyCode: 'IRR' },
  ],
};
const back: TicketOfferV1 = {
  ...out,
  id: 'back',
  originId: 'destination',
  destinationId: 'origin',
  departureAt: '2099-10-04T08:00:00Z',
  arrivalAt: '2099-10-04T11:00:00Z',
};
function render() {
  fixture.cursor = 0;
  fixture.pickers = [];
  return renderToStaticMarkup(<SalesContractForm />);
}
beforeEach(() => {
  fixture.cells = [];
  fixture.draft = {
    ...emptySalesForm,
    serviceKinds: ['FLIGHT'],
    originId: 'origin',
    destinationId: 'destination',
    tripType: 'ROUND_TRIP',
    passengerComposition: { adults: 2, children: 0, infants: 0 },
  };
});
it('waits for Search, selects the registered return, and keeps outbound when manually changing return date', () => {
  render();
  fixture.dates!.onReturningOffers([back]);
  fixture.dates!.onChange({ from: '2099-10-01', to: '2099-10-06' });
  const beforeSearch = render();
  expect(fixture.pickers).toHaveLength(0);
  expect(beforeSearch).not.toContain('جزئیات سفر');
  fixture.search!();
  const searched = render();
  expect(searched.indexOf('flight cards')).toBeLessThan(
    searched.indexOf('passenger table'),
  );
  fixture.pickers[0]!.onSelect(out);
  render();
  const selected = fixture.cells.find((c): c is SalesFormState =>
    Boolean(c && typeof c === 'object' && 'serviceKinds' in c),
  )!;
  expect(selected.ticket.outboundOfferId).toBe('out');
  expect(selected.ticket.returnOfferId).toBe('back');
  expect(selected.returnDate).toBe('2099-10-04');
  expect(selected.servicePricing?.['flight-return']?.[0]?.agreed.amount).toBe(
    '100',
  );
  expect(fixture.pickers[1]?.selectedId).toBe('back');

  fixture.dates!.onChange({ from: '2099-10-01', to: '2099-10-06' });
  render();
  expect(fixture.pickers).toHaveLength(0);
  fixture.search!();
  render();
  expect(fixture.pickers[0]?.selectedId).toBe('out');
  expect(fixture.pickers[1]?.selectedId).toBe('');
  const alternative = {
    ...back,
    id: 'manual',
    departureAt: '2099-10-06T08:00:00Z',
    arrivalAt: '2099-10-06T11:00:00Z',
  };
  fixture.pickers[1]!.onSelect(alternative);
  render();
  expect(fixture.pickers[1]?.selectedId).toBe('manual');
  fixture.dates!.onChange({ from: '2099-10-02', to: '2099-10-06' });
  render();
  fixture.search!();
  render();
  expect(fixture.pickers[0]?.selectedId).toBe('');
});

it('clears the old return and both pair quotes when the next outbound has no eligible partner', () => {
  render();
  fixture.dates!.onReturningOffers([back]);
  fixture.dates!.onChange({ from: '2099-10-01', to: '2099-10-04' });
  render();
  fixture.search!();
  render();
  fixture.pickers[0]!.onSelect(out);
  render();
  fixture.pickers[0]!.onSelect({
    ...out,
    id: 'different',
    loadGroupId: 'other',
    roundTripSalePrices: [],
  });
  render();
  const selected = fixture.cells.find((c): c is SalesFormState =>
    Boolean(c && typeof c === 'object' && 'serviceKinds' in c),
  )!;
  expect(selected.ticket.returnOfferId).toBe('');
  expect(selected.returnOffer).toBeUndefined();
  expect(selected.servicePricing?.['flight-return']).toBeUndefined();
  expect(selected.servicePricing?.['flight-outbound']).toBeUndefined();
});
