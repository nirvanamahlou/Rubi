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
            key: JSON.stringify({
              originId: 'origin',
              destinationId: 'destination',
              roundTrip: true,
              seats: 1,
              requireFare: true,
            }),
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
  expect(fixture.pickers[0]!.availableDates).toEqual(['2099-10-01']);
  expect(fixture.pickers[1]!.markedDates).toEqual(['2099-10-03']);
  fixture.pickers[1]!.onChange?.('2099-10-03');
  expect(onChange).toHaveBeenLastCalledWith(
    { from: '2099-10-01', to: '2099-10-03' },
    ['out'],
  );
  fixture.pickers[0]!.onChange?.('2099-10-01');
  expect(onChange).toHaveBeenLastCalledWith({ from: '2099-10-01', to: '' });
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
