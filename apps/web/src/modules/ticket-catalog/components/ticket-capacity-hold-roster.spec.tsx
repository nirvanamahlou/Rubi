import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { canonicalTestTree } from '@/i18n/test-tree';
import { TicketCapacityHoldRoster } from './ticket-capacity-hold-roster';
import type { CapacityHoldRow } from '../model/capacity-hold-roster';
const f = vi.hoisted(() => ({
  state: [] as unknown[],
  refs: [] as { current: unknown }[],
  cursor: 0,
  refCursor: 0,
  effects: [] as (() => unknown)[],
  mounted: false,
  now: 0,
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const i = f.cursor++;
    if (!(i in f.state)) f.state[i] = initial;
    return [
      f.state[i],
      (v: unknown) => {
        f.state[i] =
          typeof v === 'function'
            ? (v as (old: unknown) => unknown)(f.state[i])
            : v;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const i = f.refCursor++;
    return f.refs[i] ?? (f.refs[i] = { current: initial });
  },
  useEffect: (effect: () => unknown) => {
    if (!f.mounted) f.effects.push(effect);
  },
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children, ...props }: React.ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
}));
const stamp = '2030-01-01T00:00:00Z';
const hold: CapacityHoldRow = {
  id: 'hold',
  quantity: 2,
  siteCode: 'nss',
  externalId: 'SYNTHETIC-42',
  expiresAt: '2030-01-01T00:00:02Z',
  paymentPendingAt: null,
  createdAt: stamp,
  remainingSeconds: 2,
};
const page = (data = [hold]) => ({
  data,
  serverNow: stamp,
  hasMore: false,
  nextCursor: null,
});
let cleanups: (() => void)[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  f.state = [];
  f.refs = [];
  f.cursor = 0;
  f.refCursor = 0;
  f.effects = [];
  f.mounted = false;
  f.now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => f.now);
  cleanups = [];
});
afterEach(() => {
  cleanups.forEach((clean) => clean());
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function tree(
  loadPage: React.ComponentProps<typeof TicketCapacityHoldRoster>['loadPage'],
  onCapacityChange = vi.fn(),
) {
  f.cursor = 0;
  f.refCursor = 0;
  const result = TicketCapacityHoldRoster({
    offerId: 'offer',
    loadPage,
    onCapacityChange,
  });
  if (!f.mounted) {
    f.mounted = true;
    for (const effect of f.effects) {
      const cleanup = effect();
      if (typeof cleanup === 'function') cleanups.push(cleanup as () => void);
    }
  }
  return result;
}
async function settle() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}
function html(
  load: React.ComponentProps<typeof TicketCapacityHoldRoster>['loadPage'],
  notify = vi.fn(),
) {
  return renderToStaticMarkup(tree(load, notify));
}
it('shows each order and seats, then re-reads the backend exactly when an ordinary hold expires', async () => {
  const load = vi
    .fn()
    .mockResolvedValueOnce(page())
    .mockResolvedValue(page([]));
  const notify = vi.fn();
  tree(load, notify);
  await settle();
  let result = canonicalTestTree(html(load, notify));
  expect(result).toContain('SYNTHETIC-42');
  expect(result).toContain('۲');
  expect(result).toContain('۰:۰۲');
  f.now = 1000;
  await vi.advanceTimersByTimeAsync(1000);
  expect(canonicalTestTree(html(load, notify))).toContain('۰:۰۱');
  f.now = 2000;
  await vi.advanceTimersByTimeAsync(1000);
  await settle();
  expect(load).toHaveBeenCalledTimes(2);
  expect(notify).toHaveBeenCalledTimes(2);
  result = canonicalTestTree(html(load, notify));
  expect(result).not.toContain('SYNTHETIC-42');
  expect(result).toContain('رزرو فعالی ثبت نشده است.');
});
it('keeps pending bank holds visible after expiry and never signals capacity release', async () => {
  const load = vi
    .fn()
    .mockResolvedValue(page([{ ...hold, paymentPendingAt: stamp }]));
  const notify = vi.fn();
  tree(load, notify);
  await settle();
  f.now = 600000;
  await vi.advanceTimersByTimeAsync(3000);
  const result = canonicalTestTree(html(load, notify));
  expect(result).toContain('SYNTHETIC-42');
  expect(result).toContain('رزرو مرتبط با پرداخت؛ ظرفیت تا تعیین تکلیف خرید محفوظ است');
  expect(result).not.toContain('۰:۰۰');
  expect(notify).not.toHaveBeenCalled();
});
it('keeps stale rows with an explicit failure instead of claiming inventory is free on network failure', async () => {
  const load = vi
    .fn()
    .mockResolvedValueOnce(page())
    .mockRejectedValue(new Error('Synthetic offline'));
  tree(load);
  await settle();
  f.now = 2000;
  await vi.advanceTimersByTimeAsync(2000);
  await settle();
  const result = canonicalTestTree(html(load));
  expect(result).toContain('SYNTHETIC-42');
  expect(result).toContain('Synthetic offline');
  expect(result).toContain('وضعیت رزروها به‌روز نیست.');
  expect(result).not.toContain('رزرو فعالی ثبت نشده است.');
});
it('aborts reads and removes both timers when the offer dialog closes', async () => {
  let resolve!: (value: ReturnType<typeof page>) => void;
  const load = vi.fn().mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  tree(load);
  const signal = load.mock.calls[0]![2] as AbortSignal;
  cleanups.forEach((clean) => clean());
  cleanups = [];
  expect(signal.aborted).toBe(true);
  resolve(page());
  await settle();
  await vi.advanceTimersByTimeAsync(30000);
  expect(load).toHaveBeenCalledOnce();
  expect(f.state[0]).toBeNull();
});
