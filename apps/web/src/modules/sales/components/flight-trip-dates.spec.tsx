import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DatePickerProps } from '@/components/ui/date-picker';
import type { TicketOfferV1 } from '@nora/contracts';
import { beforeEach, expect, it, vi } from 'vitest';
import { FlightTripDates, flightCalendarOffers } from './flight-trip-dates';
const fixture = vi.hoisted(() => ({
  outbound: [] as TicketOfferV1[],
  returning: [] as TicketOfferV1[],
  pickers: [] as DatePickerProps[],
  loaded: true,
  roundTrip: true,
  requireFare: true,
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const value =
      typeof initial === 'function' ? (initial as () => unknown)() : initial;
    return [
      value && typeof value === 'object' && 'outbound' in value
        ? {
            ...value,
            key: fixture.loaded
              ? JSON.stringify({
                  originId: 'origin',
                  destinationId: 'destination',
                  roundTrip: fixture.roundTrip,
                  seats: 1,
                  requireFare: fixture.requireFare,
                })
              : '',
            outbound: fixture.outbound,
            returning: fixture.returning,
          }
        : value,
      vi.fn(),
    ];
  },
}));
vi.mock('@/components/ui/date-picker', () => ({
  DatePicker: (props: DatePickerProps) => {
    fixture.pickers.push(props);
    return <span>{props['aria-label']}</span>;
  },
}));
vi.mock('../api/ticket-search', () => ({ searchTickets: vi.fn() }));
import { searchTickets } from '../api/ticket-search';

it('reports calendar changes for the exact leg without changing flight dates', () => {
  const onChange = vi.fn();
  const onCalendarSystemChange = vi.fn();
  renderToStaticMarkup(
    <FlightTripDates
      originId="origin"
      destinationId="destination"
      roundTrip
      seats={1}
      requireFare={false}
      value={{ from: '2099-10-01', to: '2099-10-03' }}
      onChange={onChange}
      calendarSystems={{ OUTBOUND: 'gregorian', RETURN: 'persian' }}
      onCalendarSystemChange={onCalendarSystemChange}
    />,
  );
  expect(fixture.pickers.map((picker) => picker.calendarSystem)).toEqual([
    'gregorian',
    'persian',
  ]);
  fixture.pickers[1]!.onCalendarSystemChange!('gregorian');
  expect(onCalendarSystemChange).toHaveBeenCalledWith('RETURN', 'gregorian');
  expect(onChange).not.toHaveBeenCalled();
});
const outbound: TicketOfferV1 = {
  id: 'out',
  version: 1,
  branchId: 'branch',
  originId: 'origin',
  destinationId: 'destination',
  departureAt: '2099-10-01T08:00:00Z',
  arrivalAt: '2099-10-01T11:00:00Z',
  carrierName: 'Carrier',
  serviceNumber: '1',
  cabinClassCode: 'ECONOMY',
  totalCapacity: 10,
  remainingCapacity: 10,
  status: 'ACTIVE',
  returnMinDays: 2,
  returnMaxDays: 3,
  roundTripSalePrices: [
    {
      returnOfferId: 'return',
      revision: 1,
      amount: '100',
      currencyCode: 'IRR',
    },
  ],
};
const returning: TicketOfferV1 = {
  ...outbound,
  id: 'return',
  originId: 'destination',
  destinationId: 'origin',
  departureAt: '2099-10-03T08:00:00Z',
};
beforeEach(() => {
  vi.mocked(searchTickets).mockReset();
  fixture.pickers = [];
  fixture.loaded = true;
  fixture.roundTrip = true;
  fixture.requireFare = true;
  fixture.outbound = [
    outbound,
    {
      ...outbound,
      id: 'sold',
      remainingCapacity: 0,
      departureAt: '2099-10-02T08:00:00Z',
    },
  ];
  fixture.returning = [
    returning,
    { ...returning, id: 'late', departureAt: '2099-10-05T08:00:00Z' },
  ];
});
it.each([false, true])(
  'marks unpriced inventory dates for flight-only contracts (round trip=%s)',
  (roundTrip) => {
    fixture.roundTrip = roundTrip;
    fixture.requireFare = false;
    fixture.outbound = fixture.outbound.map((offer) => ({
      ...offer,
      standaloneSalePrice: null,
      roundTripSalePrices: [],
    }));
    fixture.returning = fixture.returning.map((offer) => ({
      ...offer,
      standaloneSalePrice: null,
      roundTripSalePrices: [],
    }));
    renderToStaticMarkup(
      <FlightTripDates
        originId="origin"
        destinationId="destination"
        roundTrip={roundTrip}
        seats={1}
        requireFare={false}
        value={{ from: '2099-10-01', to: '' }}
        onChange={vi.fn()}
      />,
    );
    expect(fixture.pickers[0]!.markedDates).toEqual(['2099-10-01']);
    expect(fixture.pickers[0]!.availableDates).toBeUndefined();
    if (roundTrip)
      expect(fixture.pickers[1]!.markedDates).toEqual(['2099-10-03']);
  },
);
it('marks only available outbound days and eligible reverse-route return dates with red dots', () => {
  const onChange = vi.fn();
  renderToStaticMarkup(
    <FlightTripDates
      originId="origin"
      destinationId="destination"
      roundTrip
      seats={1}
      requireFare
      value={{ from: '2099-10-01', to: '' }}
      onChange={onChange}
    />,
  );
  expect(fixture.pickers[0]!.markedDates).toEqual(['2099-10-01']);
  expect(fixture.pickers[0]!.availableDates).toBeUndefined();
  expect(fixture.pickers[1]!.availableDates).toBeUndefined();
  expect(fixture.pickers[1]!.markedDates).toEqual(['2099-10-03']);
  fixture.pickers[1]!.onChange?.('2099-10-03');
  expect(onChange).toHaveBeenLastCalledWith(
    { from: '2099-10-01', to: '2099-10-03' },
    ['out'],
  );
  fixture.pickers[0]!.onChange?.('2099-10-01');
  expect(onChange).toHaveBeenLastCalledWith(
    { from: '2099-10-01', to: '2099-10-03' },
    ['out'],
  );
});
it('selects unmarked floating dates without an extra toggle or an empty catalog allowlist', () => {
  const onChange = vi.fn();
  const html = renderToStaticMarkup(
    <FlightTripDates
      originId="origin"
      destinationId="destination"
      roundTrip
      seats={1}
      requireFare
      value={{ from: '2099-10-01', to: '' }}
      onChange={onChange}
    />,
  );
  expect(html).not.toContain('ورود تاریخ دلخواه');
  expect(html).not.toContain('checkbox');
  expect(fixture.pickers[0]!.disabled).toBe(false);
  expect(fixture.pickers[1]!.disabled).toBe(false);
  fixture.pickers[0]!.onChange?.('2099-10-02');
  expect(onChange).toHaveBeenLastCalledWith({ from: '2099-10-02', to: '' });
  fixture.pickers[1]!.onChange?.('2099-10-04');
  expect(onChange).toHaveBeenLastCalledWith(
    { from: '2099-10-01', to: '2099-10-04' },
    undefined,
  );
  expect(fixture.pickers[1]!.minimumDate).toBe('2099-10-01');
});
it('keeps registered return dates marked when the outbound date is floating', () => {
  renderToStaticMarkup(
    <FlightTripDates
      originId="origin"
      destinationId="destination"
      roundTrip
      seats={1}
      requireFare
      value={{ from: '2099-10-02', to: '' }}
      onChange={vi.fn()}
    />,
  );
  expect(fixture.pickers[1]!.markedDates).toEqual(['2099-10-03', '2099-10-05']);
  expect(fixture.pickers[1]!.availableDates).toBeUndefined();
});
it('allows floating date selection while catalog markers are loading or unavailable', () => {
  fixture.loaded = false;
  renderToStaticMarkup(
    <FlightTripDates
      originId="origin"
      destinationId="destination"
      roundTrip
      seats={1}
      requireFare
      value={{ from: '2099-10-02', to: '' }}
      onChange={vi.fn()}
    />,
  );
  for (const picker of fixture.pickers) {
    expect(picker.disabled).toBe(false);
    expect(picker.availableDates).toBeUndefined();
    expect(picker.markedDates).toEqual([]);
  }
});
it('does not enable date selection before a route exists', () => {
  const html = renderToStaticMarkup(
    <FlightTripDates
      originId=""
      destinationId=""
      roundTrip
      seats={1}
      requireFare
      value={{ from: '', to: '' }}
      onChange={vi.fn()}
    />,
  );
  expect(fixture.pickers[0]!.disabled).toBe(true);
  expect(fixture.pickers[1]!.disabled).toBe(true);
  expect(html).toContain('ابتدا مبدأ و مقصد');
});
it('loads dates beyond the first page and fails closed on duplicate or incomplete pagination', async () => {
  const query = {
    originId: 'origin',
    destinationId: 'destination',
    departureFrom: '2099-01-01',
  };
  vi.mocked(searchTickets)
    .mockResolvedValueOnce({ data: [outbound], hasMore: true })
    .mockResolvedValueOnce({ data: [returning], hasMore: false });
  expect(
    await flightCalendarOffers(query, new AbortController().signal),
  ).toEqual([outbound, returning]);
  expect(searchTickets).toHaveBeenLastCalledWith(
    { ...query, page: 2 },
    expect.any(AbortSignal),
  );
  vi.mocked(searchTickets)
    .mockResolvedValueOnce({ data: [outbound], hasMore: true })
    .mockResolvedValueOnce({ data: [outbound], hasMore: false });
  await expect(
    flightCalendarOffers(query, new AbortController().signal),
  ).rejects.toThrow('تغییر کرد');
  vi.mocked(searchTickets).mockResolvedValueOnce({ data: [], hasMore: true });
  await expect(
    flightCalendarOffers(query, new AbortController().signal),
  ).rejects.toThrow('کامل نشد');
});
it('does not fetch after cancellation', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    flightCalendarOffers(
      {
        originId: 'origin',
        destinationId: 'destination',
        departureFrom: '2099-01-01',
      },
      controller.signal,
    ),
  ).rejects.toThrow();
  expect(searchTickets).not.toHaveBeenCalled();
});

it.each([true, false])(
  'sets travel calendar default without changing saved ISO dates (%s)',
  (international) => {
    const onChange = vi.fn();
    renderToStaticMarkup(
      <FlightTripDates
        international={international}
        originId="origin"
        destinationId="destination"
        roundTrip
        seats={1}
        requireFare
        value={{ from: '2099-10-01', to: '2099-10-03' }}
        onChange={onChange}
      />,
    );
    expect(fixture.pickers).toHaveLength(2);
    for (const picker of fixture.pickers) {
      expect(picker.defaultCalendarSystem).toBe(
        international ? 'gregorian' : undefined,
      );
      expect(picker.gregorianEnglish).toBe(true);
    }
    expect(fixture.pickers[0]!.value).toBe('2099-10-01');
    expect(fixture.pickers[1]!.value).toBe('2099-10-03');
    expect(onChange).not.toHaveBeenCalled();
  },
);

it('allows changing the suggested return to a manually chosen floating day', () => {
  const onChange = vi.fn();
  renderToStaticMarkup(
    <FlightTripDates
      originId="origin"
      destinationId="destination"
      roundTrip
      seats={1}
      requireFare
      value={{ from: '2099-10-01', to: '2099-10-03' }}
      onChange={onChange}
    />,
  );
  fixture.pickers[1]!.onChange?.('2099-10-04');
  expect(onChange).toHaveBeenLastCalledWith(
    { from: '2099-10-01', to: '2099-10-04' },
    undefined,
  );
});

it('shows one enabled return calendar without an outbound date and keeps its chosen day', () => {
  fixture.roundTrip = false;
  fixture.requireFare = false;
  const onChange = vi.fn();
  const html = renderToStaticMarkup(
    <FlightTripDates
      originId="origin"
      destinationId="destination"
      primaryDirection="RETURN"
      roundTrip={false}
      seats={1}
      requireFare={false}
      value={{ from: '', to: '' }}
      onChange={onChange}
    />,
  );
  expect(fixture.pickers).toHaveLength(1);
  expect(fixture.pickers[0]!.disabled).toBe(false);
  expect(fixture.pickers[0]!['aria-label']).toBe('تاریخ بلیط برگشت');
  expect(fixture.pickers[0]!.markedDates).toEqual(['2099-10-01']);
  expect(html).not.toContain('بلیط رفت');
  fixture.pickers[0]!.onChange?.('2099-10-01');
  expect(onChange).toHaveBeenCalledWith({
    from: '2099-10-01',
    to: '2099-10-01',
  });
});
