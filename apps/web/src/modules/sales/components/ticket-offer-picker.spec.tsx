import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareTicketSearch } from '../api/ticket-search';
import { TicketOfferPicker } from './ticket-offer-picker';

const effects = vi.hoisted(() => [] as (() => void | (() => void))[]);
const states = vi.hoisted(() => [] as unknown[]);
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useEffect: (effect: () => void | (() => void)) => effects.push(effect),
  useState: (initial: unknown) => [
    states.length
      ? states.shift()
      : typeof initial === 'function'
        ? initial()
        : initial,
    vi.fn(),
  ],
}));
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'https://synthetic.invalid/api/v1',
}));
const fetcher = vi.fn();
beforeEach(() => {
  effects.length = 0;
  states.length = 0;
  fetcher.mockReset().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data: [], hasMore: false }),
  });
  vi.stubGlobal('fetch', fetcher);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('ticket list before and after date selection', () => {
  it('retains Gregorian card dates after filtering offers for the selected airline', () => {
    states.push(
      [
        {
          id: 'saved',
          version: 1,
          branchId: 'test',
          originId: 'a',
          destinationId: 'b',
          departureAt: '2026-09-10T20:00:00Z',
          arrivalAt: '2026-09-10T23:15:00Z',
          carrierName: 'Selected Air',
          serviceNumber: 'TEST-1',
          cabinClassCode: 'ECONOMY',
          totalCapacity: 20,
          remainingCapacity: 12,
          status: 'ACTIVE',
        },
      ],
      { filters: '', page: 1 },
      false,
      false,
      '',
    );
    const html = renderToStaticMarkup(
      <TicketOfferPicker
        query={{
          originId: 'a',
          destinationId: 'b',
          departureFrom: '2026-09-10',
        }}
        carrierName="Selected Air"
        calendarSystem="gregorian"
        emptyMessage="Saved ticket retained"
        selectedId="saved"
        requiredSeats={1}
        onSelect={vi.fn()}
      />,
    );
    expect(html).toContain('Selected Air');
    expect(html).toContain('۲۰۲۶');
    expect(html).not.toContain('۱۴۰۵');
    expect(html).not.toContain('Saved ticket retained');
  });

  it('explains an empty replacement search without reporting the saved ticket as missing', () => {
    states.push([], { filters: '', page: 1 }, false, false, '');
    const html = renderToStaticMarkup(
      <TicketOfferPicker
        query={{
          originId: 'a',
          destinationId: 'b',
          departureFrom: '2026-10-03',
        }}
        selectedId="old"
        requiredSeats={1}
        onSelect={vi.fn()}
        emptyMessage="بلیت فعلی قرارداد حفظ شده است."
      />,
    );
    expect(html).toContain('بلیت فعلی قرارداد حفظ شده است.');
    expect(html).not.toContain('بلیطی برای این مسیر و تاریخ پیدا نشد.');
  });
  it('keeps real search failures visible even if a saved ticket exists', () => {
    states.push([], { filters: '', page: 1 }, false, false, 'Network failure');
    const html = renderToStaticMarkup(
      <TicketOfferPicker
        query={{
          originId: 'a',
          destinationId: 'b',
          departureFrom: '2026-10-03',
        }}
        selectedId="old"
        requiredSeats={1}
        onSelect={vi.fn()}
        emptyMessage="Saved ticket retained"
      />,
    );
    expect(html).toContain('Network failure');
    expect(html).not.toContain('Saved ticket retained');
  });
  it('shows an empty result when the airline filter excludes every returned ticket', () => {
    states.push(
      [{ id: 'other', carrierName: 'Other Air' }],
      { filters: '', page: 1 },
      false,
      false,
      '',
    );
    const html = renderToStaticMarkup(
      <TicketOfferPicker
        query={{
          originId: 'a',
          destinationId: 'b',
          departureFrom: '2026-10-03',
        }}
        carrierName="Selected Air"
        selectedId=""
        requiredSeats={1}
        onSelect={vi.fn()}
      />,
    );
    expect(html).toContain('بلیطی برای این مسیر و تاریخ پیدا نشد.');
  });
  it('reuses the exact prepared first-page request instead of waiting for a second network request', async () => {
    const query = {
      originId: 'origin',
      destinationId: 'destination',
      departureFrom: '2026-10-01',
      departureTo: '2026-10-08',
      page: 1,
    };
    const prepared = prepareTicketSearch(query, new AbortController().signal);
    renderToStaticMarkup(
      <TicketOfferPicker
        query={query}
        prepared={prepared}
        selectedId=""
        requiredSeats={1}
        onSelect={vi.fn()}
      />,
    );
    const cleanup = effects.map((effect) => effect());
    await vi.runAllTimersAsync();
    expect(fetcher).toHaveBeenCalledTimes(1);
    cleanup.forEach((cancel) => cancel?.());
  });
  it('retries a failed speculative search when entering the ticket page', async () => {
    const query = {
      originId: 'origin',
      destinationId: 'destination',
      departureFrom: '2026-10-01',
      page: 1,
    };
    fetcher.mockRejectedValueOnce(new TypeError('temporary network error'));
    const prepared = prepareTicketSearch(query, new AbortController().signal);
    renderToStaticMarkup(
      <TicketOfferPicker
        query={query}
        prepared={prepared}
        selectedId=""
        requiredSeats={1}
        onSelect={vi.fn()}
      />,
    );
    const cleanup = effects.map((effect) => effect());
    await vi.runAllTimersAsync();
    expect(fetcher).toHaveBeenCalledTimes(2);
    cleanup.forEach((cancel) => cancel?.());
  });
  it('shows only a date prompt and sends no request while search is disabled', async () => {
    const html = renderToStaticMarkup(
      <TicketOfferPicker
        enabled={false}
        query={{
          originId: 'origin',
          destinationId: 'destination',
          departureFrom: '2026-10-01',
        }}
        selectedId=""
        requiredSeats={1}
        onSelect={vi.fn()}
      />,
    );
    const cleanup = effects.map((effect) => effect());
    await vi.runAllTimersAsync();
    expect(fetcher).not.toHaveBeenCalled();
    expect(html).toContain('ابتدا تاریخ بلیط را انتخاب');
    expect(html).not.toContain('در حال دریافت');
    cleanup.forEach((cancel) => cancel?.());
  });
  it('requests tickets only with the confirmed date bounds when enabled', async () => {
    renderToStaticMarkup(
      <TicketOfferPicker
        enabled
        query={{
          originId: 'origin',
          destinationId: 'destination',
          departureFrom: '2026-10-01',
          departureTo: '2026-10-08',
        }}
        selectedId=""
        requiredSeats={1}
        onSelect={vi.fn()}
      />,
    );
    const cleanup = effects.map((effect) => effect());
    await vi.runAllTimersAsync();
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = new URL(fetcher.mock.calls[0]![0]);
    expect(url.searchParams.get('departureFrom')).toBe('2026-10-01');
    expect(url.searchParams.get('departureTo')).toBe('2026-10-08');
    cleanup.forEach((cancel) => cancel?.());
  });
});
