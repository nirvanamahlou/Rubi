import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SalesContractForm } from './sales-contract-form';
const fixture = vi.hoisted(() => ({
  route: true,
  dates: true,
  flight: true,
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
      };
    if (value && typeof value === 'object' && 'from' in value && 'to' in value)
      value = fixture.dates ? { from: '2099-10-01', to: '2099-10-10' } : value;
    return [value, vi.fn()];
  },
}));
const fetcher = vi.fn();
beforeEach(() => {
  fixture.effects = [];
  fixture.route = fixture.dates = fixture.flight = true;
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
it('starts first-page tickets while still in the route step, and aborts obsolete work on cleanup', async () => {
  const html = renderToStaticMarkup(<SalesContractForm />);
  expect(html).toContain('تعداد مسافران');
  expect(html).not.toContain('بلیط رفت');
  const cleanup = fixture.effects[0]!();
  await vi.runAllTimersAsync();
  expect(fetcher).toHaveBeenCalledTimes(1);
  const params = new URL(fetcher.mock.calls[0]![0]).searchParams;
  expect(params.get('departureFrom')).toBe('2099-10-01');
  expect(params.get('departureTo')).toBe('2099-10-10');
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
