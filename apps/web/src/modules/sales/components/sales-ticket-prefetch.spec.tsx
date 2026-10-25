import type { DatePickerProps } from '@/components/ui/date-picker';
import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SalesContractForm } from './sales-contract-form';
const fixture = vi.hoisted(() => ({
  route: true,
  dates: true,
  flight: true,
  returnOnly: false,
  emptyStateCount: 0,
  effects: [] as (() => void | (() => void))[],
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'https://synthetic.invalid/api/v1',
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useEffect: (effect: () => void | (() => void)) =>
    fixture.effects.push(effect),
  useState: (initial: unknown) => {
    let value =
      typeof initial === 'function' ? (initial as () => unknown)() : initial;
    if (value && typeof value === 'object' && 'serviceKinds' in value)
      value = {
        ...value,
        originId: fixture.route ? 'origin' : '',
        destinationId: 'destination',
        serviceKinds: fixture.flight ? ['FLIGHT'] : ['HOTEL'],
        serviceDirections: {
          FLIGHT: fixture.returnOnly ? ['RETURN'] : ['OUTBOUND'],
        },
      };
    if (value && typeof value === 'object' && 'from' in value && 'to' in value)
      value = fixture.dates ? { from: '2099-10-01', to: '2099-10-10' } : value;
    if (value === '') {
      const index = fixture.emptyStateCount++;
      const route = JSON.stringify([
        'origin',
        'destination',
        [fixture.returnOnly ? 'RETURN' : 'OUTBOUND'],
      ]);
      if (index === 0) value = route;
    }
    return [value, vi.fn()];
  },
}));
vi.mock('@/components/ui/date-picker', () => ({
  DatePicker: (props: DatePickerProps) => (
    <button type="button" aria-label={props['aria-label']}>
      {props.value}
    </button>
  ),
}));
const fetcher = vi.fn();
beforeEach(() => {
  fixture.effects = [];
  fixture.emptyStateCount = 0;
  fixture.route = fixture.dates = fixture.flight = true;
  fixture.returnOnly = false;
  vi.useFakeTimers();
  fetcher.mockReset().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data: [], hasMore: false }),
  });
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('automatically starts first-page tickets for selected dates and aborts obsolete work on cleanup', async () => {
  const html = renderToStaticMarkup(<SalesContractForm />);
  expect(html).toContain('تعداد مسافران');
  expect(html).toContain('تاریخ بلیط رفت');
  expect(html).not.toContain('جست‌وجوی بلیط‌ها');
  const cleanup = fixture.effects[0]!();
  await vi.runAllTimersAsync();
  expect(fetcher).toHaveBeenCalledTimes(1);
  const params = new URL(fetcher.mock.calls[0]![0]).searchParams;
  expect(params.get('departureFrom')).toBe('2099-10-01T00:00:00+03:30');
  expect(params.get('departureTo')).toBe('2099-10-01');
  expect(params.get('page')).toBe('1');
  cleanup?.();
  expect(fetcher.mock.calls[0]![1].signal.aborted).toBe(true);
});
it.each(['route', 'dates', 'flight'] as const)(
  'does not preload before %s is ready',
  async (key) => {
    fixture[key] = false;
    renderToStaticMarkup(<SalesContractForm />);
    const cleanup = fixture.effects[0]!();
    await vi.runAllTimersAsync();
    expect(fetcher).not.toHaveBeenCalled();
    cleanup?.();
  },
);

it('does not preload forward-route offers for a return-only contract', async () => {
  fixture.returnOnly = true;
  renderToStaticMarkup(<SalesContractForm />);
  const cleanup = fixture.effects[0]!();
  await vi.runAllTimersAsync();
  expect(fetcher).not.toHaveBeenCalled();
  cleanup?.();
});
