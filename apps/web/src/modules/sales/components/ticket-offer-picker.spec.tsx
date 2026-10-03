import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketOfferPicker } from './ticket-offer-picker';

const effects = vi.hoisted(() => [] as (() => void | (() => void))[]);
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useEffect: (effect: () => void | (() => void)) => effects.push(effect),
}));
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'https://synthetic.invalid/api/v1',
}));
const fetcher = vi.fn();
beforeEach(() => {
  effects.length = 0;
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
    expect(html).toContain('ابتدا بازه تاریخ را انتخاب');
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
