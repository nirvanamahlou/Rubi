import type * as ButtonModule from '@/components/ui/button';
import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import type { FlightDateRange } from './flight-date-range';
import {
  emptySalesForm,
  salesFlightsValid,
  type SalesFormState,
} from '../model/sales-form';
import { SalesContractForm } from './sales-contract-form';

const fixture = vi.hoisted(() => ({
  cells: [] as unknown[],
  cursor: 0,
  draft: null as SalesFormState | null,
  pickers: [] as {
    selectedId: string;
    onSelect: (offer: TicketOfferV1) => void;
    query: {
      originId: string;
      destinationId: string;
      departureFrom: string;
      departureTo: string;
    };
    exactDay: string;
    requireStandaloneFare?: boolean;
  }[],
  dates: null as null | {
    onChange: (range: FlightDateRange) => void;
    onReturningOffers: (offers: TicketOfferV1[]) => void;
    requireFare: boolean;
    originId: string;
    destinationId: string;
    primaryDirection: string;
    roundTrip: boolean;
  },
  confirms: [] as (() => void)[],
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
    if (props['aria-label'] === 'ثبت بلیط شناور')
      fixture.confirms.push(props.onClick as () => void);
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
vi.mock('./hotel-stay-dates', () => ({
  HotelStayDates: () => <div>shared hotel stay dates</div>,
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
  fixture.confirms = [];
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
it.each(['ONE_WAY', 'ROUND_TRIP'] as const)(
  'selects unpriced flight-only inventory without a hotel (%s)',
  (tripType) => {
    fixture.draft = { ...fixture.draft!, tripType };
    const unpricedOut = {
      ...out,
      standaloneSalePrice: null,
      roundTripSalePrices: [],
    };
    const unpricedBack = {
      ...back,
      standaloneSalePrice: null,
      roundTripSalePrices: [],
    };
    render();
    expect(fixture.dates!.requireFare).toBe(false);
    fixture.dates!.onReturningOffers([unpricedBack]);
    fixture.dates!.onChange({
      from: '2099-10-01',
      to: tripType === 'ROUND_TRIP' ? '2099-10-04' : '2099-10-01',
    });
    render();
    expect(fixture.pickers[0]!.requireStandaloneFare).toBe(false);
    fixture.pickers[0]!.onSelect(unpricedOut);
    render();
    const selected = fixture.cells.find((c): c is SalesFormState =>
      Boolean(c && typeof c === 'object' && 'serviceKinds' in c),
    )!;
    expect(selected.ticket.outboundOfferId).toBe('out');
    if (tripType === 'ROUND_TRIP') {
      expect(selected.ticket.returnOfferId).toBe('back');
      expect(fixture.pickers[1]!.requireStandaloneFare).toBe(false);
    }
    expect(salesFlightsValid(selected)).toBe(true);
    expect(selected.servicePricing?.['flight-outbound']).toBeUndefined();
  },
);
it('shows exact-date cards automatically, selects the registered return, and allows manual return changes', () => {
  render();
  expect(fixture.pickers).toHaveLength(0);
  fixture.dates!.onReturningOffers([back]);
  fixture.dates!.onChange({ from: '2099-10-01', to: '' });
  render();
  expect(fixture.pickers).toHaveLength(0);
  fixture.dates!.onChange({ from: '2099-10-01', to: '2099-10-06' });
  const searched = render();
  expect(fixture.pickers).toHaveLength(1);
  expect(searched).not.toContain('جست‌وجوی بلیط‌ها');
  expect(searched).not.toContain('جزئیات سفر');
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
  expect(fixture.pickers).toHaveLength(2);
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
  expect(fixture.pickers[0]?.selectedId).toBe('');
});

it('clears the old return and both pair quotes when the next outbound has no eligible partner', () => {
  render();
  fixture.dates!.onReturningOffers([back]);
  fixture.dates!.onChange({ from: '2099-10-01', to: '2099-10-04' });
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

it('sets shared hotel dates from selected registered flights and preserves dates until a different flight is chosen', () => {
  fixture.draft = {
    ...fixture.draft!,
    serviceKinds: ['FLIGHT', 'HOTEL'],
    roomDrivenGuests: true,
    hotel: {
      ...emptySalesForm.hotel,
      checkIn: '2099-11-01',
      checkOut: '2099-11-10',
      checkInManual: true,
      checkOutManual: true,
      rooms: [
        {
          ordinal: 1,
          roomTypeId: 'room',
          roomTypeNameSnapshot: 'Double',
          adults: 2,
          childAges: [],
        },
      ],
    },
  };
  render();
  fixture.dates!.onReturningOffers([back]);
  fixture.dates!.onChange({ from: '2099-10-01', to: '2099-10-06' });
  render();
  fixture.pickers[0]!.onSelect(out);
  render();
  const selected = fixture.cells.find((c): c is SalesFormState =>
    Boolean(c && typeof c === 'object' && 'serviceKinds' in c),
  )!;
  expect(selected.hotel).toMatchObject({
    checkIn: '2099-10-01',
    checkOut: '2099-10-03',
    checkInManual: false,
    checkOutManual: false,
  });
});

it('confirms overnight floating tickets and enables continuation with confirmed passengers without catalog search', () => {
  fixture.draft = {
    ...fixture.draft!,
    originCountryId: '10000000-0000-4000-8000-000000000010',
    destinationCountryId: '10000000-0000-4000-8000-000000000011',
    originId: '10000000-0000-4000-8000-000000000002',
    destinationId: '10000000-0000-4000-8000-000000000003',
    customerId: 'person',
    passengerComposition: { adults: 1, children: 0, infants: 0 },
    passengers: [
      {
        customerId: 'person',
        displayName: 'Synthetic Person',
        birthDate: '1990-01-01',
      },
    ],
    contractFlights: {
      OUTBOUND: {
        carrierName: 'Synthetic',
        serviceNumber: '119',
        departureAt: '2099-10-01T01:08:00',
        arrivalAt: '2099-10-01T00:02:00',
        cabinClassCode: 'ECONOMY',
      },
      RETURN: {
        carrierName: 'Synthetic',
        serviceNumber: '120',
        departureAt: '2099-10-04T01:16:00',
        arrivalAt: '2099-10-04T08:16:00',
        cabinClassCode: 'ECONOMY',
      },
    },
  };
  render();
  expect(fixture.confirms).toHaveLength(2);
  fixture.confirms[0]!();
  render();
  fixture.confirms[1]!();
  const html = render();
  expect(html).toContain('بلیط شناور ثبت شد.');
  const button = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
    .map((match) => match[0])
    .find((markup) => markup.includes('تأیید مسیر و خدمات'));
  expect(button).toBeDefined();
  expect(button).not.toContain('disabled');
});

it('opens only the reverse-route return cards on the selected return day without choosing outbound', () => {
  fixture.draft = {
    ...fixture.draft!,
    tripType: 'ONE_WAY',
    serviceDirections: { FLIGHT: ['RETURN'] },
  };
  render();
  expect(fixture.dates).toMatchObject({
    originId: 'destination',
    destinationId: 'origin',
    primaryDirection: 'RETURN',
    roundTrip: false,
  });
  fixture.dates!.onChange({ from: '2099-10-04', to: '2099-10-04' });
  const html = render();
  expect(html).not.toContain('ابتدا بلیط رفت');
  expect(fixture.pickers).toHaveLength(1);
  expect(fixture.pickers[0]).toMatchObject({
    exactDay: '2099-10-04',
    query: {
      originId: 'destination',
      destinationId: 'origin',
      departureFrom: '2099-10-04T00:00:00+03:30',
      departureTo: '2099-10-04',
    },
  });
  fixture.pickers[0]!.onSelect(back);
  render();
  const selected = fixture.cells.find((c): c is SalesFormState =>
    Boolean(c && typeof c === 'object' && 'serviceKinds' in c),
  )!;
  expect(selected.ticket.outboundOfferId).toBe('');
  expect(selected.ticket.returnOfferId).toBe('back');
  expect(salesFlightsValid(selected)).toBe(true);
  fixture.dates!.onChange({ from: '2099-10-05', to: '2099-10-05' });
  render();
  expect(fixture.pickers).toHaveLength(1);
  expect(fixture.pickers[0]!.exactDay).toBe('2099-10-05');
  expect(fixture.pickers[0]!.selectedId).toBe('');
});
