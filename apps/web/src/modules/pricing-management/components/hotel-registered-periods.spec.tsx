import { beforeEach, it, expect, vi } from 'vitest';
import type { ReactNode, ReactElement } from 'react';
import type * as ReactModule from 'react';
import type { LoginResponse } from '@nora/contracts';
import { canonicalTestTree } from '@/i18n/test-tree';
import { DatePicker } from '@/components/ui/date-picker';
import { HotelRegisteredPeriods } from './hotel-registered-periods';
const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  deps: [] as unknown[][],
  clean: [] as (() => void)[],
  queued: [] as (() => void)[],
  i: 0,
  e: 0,
  request: vi.fn(),
}));
vi.mock('../api/client', () => ({
  packagePricingApi: { hotelRegisteredPeriods: hooks.request },
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const i = hooks.i++;
    if (!(i in hooks.states))
      hooks.states[i] = typeof initial === 'function' ? initial() : initial;
    return [
      hooks.states[i],
      (next: unknown) => {
        hooks.states[i] =
          typeof next === 'function' ? next(hooks.states[i]) : next;
      },
    ];
  },
  useEffect: (callback: () => void | (() => void), deps: unknown[]) => {
    const e = hooks.e++;
    if (hooks.deps[e]?.every((v, i) => Object.is(v, deps[i]))) return;
    hooks.clean[e]?.();
    hooks.deps[e] = deps;
    hooks.queued.push(() => {
      const cleanup = callback();
      if (cleanup) hooks.clean[e] = cleanup;
    });
  },
}));
const session = {
  user: {
    id: 'user',
    branches: [
      { id: 'branch', name: 'Branch', code: 'A' },
      { id: 'other', name: 'Other', code: 'B' },
    ],
    permissions: ['package_pricing.read'],
  },
} as LoginResponse;
const row = {
  hotelRateId: 'rate',
  packId: 'pack',
  batchId: 'batch',
  branchId: 'branch',
  hotelName: 'Royal Wings',
  cityName: 'Antalya',
  brokerName: 'Broker',
  currencyCode: 'EUR',
  checkIn: '2026-10-01',
  checkOut: '2026-10-06',
  version: 3,
};
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  tree = canonicalTestTree(tree);
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const n = tree as ReactElement<Record<string, unknown>>;
  return [n, ...nodes(n.props.children as ReactNode)];
}
function render() {
  hooks.i = hooks.e = 0;
  const tree = nodes(HotelRegisteredPeriods({ session }));
  hooks.queued.splice(0).forEach((callback) => callback());
  return tree;
}
async function settle() {
  for (let i = 0; i < 5; i++) {
    render();
    await Promise.resolve();
  }
  return render();
}
function change(label: string, value: string) {
  const n = render().find((node) => node.props['aria-label'] === label)!;
  (n.props.onChange as (e: unknown) => void)({ target: { value } });
}
function search() {
  const n = render().find((node) => node.type === 'form')!;
  (n.props.onSubmit as (e: unknown) => void)({ preventDefault: vi.fn() });
}
beforeEach(() => {
  hooks.states = [];
  hooks.deps = [];
  hooks.clean = [];
  hooks.queued = [];
  hooks.request.mockReset();
  hooks.request.mockResolvedValue({
    version: 1,
    data: [row],
    total: 51,
    page: 1,
    pageSize: 50,
  });
});
it('loads persisted pack metadata without choosing a tour, uses submitted filters and paginates', async () => {
  let tree = await settle();
  expect(hooks.request).toHaveBeenLastCalledWith(
    { branchId: 'branch', page: 1 },
    session,
  );
  expect(tree.some((n) => n.props.children === 'Royal Wings')).toBe(true);
  change('جست‌وجوی هتل، شهر یا کارگزار', 'Wings');
  expect(hooks.request).toHaveBeenCalledTimes(1);
  search();
  await settle();
  expect(hooks.request).toHaveBeenLastCalledWith(
    { branchId: 'branch', search: 'Wings', page: 1 },
    session,
  );
  tree = render();
  (
    tree.find((n) => n.props.children === 'صفحه بعد')!.props
      .onClick as () => void
  )();
  await settle();
  expect(hooks.request).toHaveBeenLastCalledWith(
    { branchId: 'branch', search: 'Wings', page: 2 },
    session,
  );
});
it('does not display a previous branch while loading and ignores out-of-order responses', async () => {
  let resolveFirst: (value: unknown) => void = () => {};
  hooks.request.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
  );
  render();
  change('شعبهٔ بازه‌های هتل', 'other');
  search();
  await settle();
  resolveFirst({
    data: [{ ...row, hotelName: 'STALE' }],
    total: 1,
    page: 1,
    pageSize: 50,
  });
  await settle();
  expect(render().some((n) => n.props.children === 'STALE')).toBe(false);
  expect(hooks.request).toHaveBeenLastCalledWith(
    { branchId: 'other', page: 1 },
    session,
  );
});
it('blocks reversed dates and exposes errors and empty results without inventing rows', async () => {
  await settle();
  let picker = render().find(
    (n) =>
      n.type === DatePicker &&
      n.props['aria-label'] === 'شروع فیلتر بازه‌های هتل',
  )!;
  (picker.props.onChange as (v: string) => void)('2026-11-01');
  picker = render().find(
    (n) =>
      n.type === DatePicker &&
      n.props['aria-label'] === 'پایان فیلتر بازه‌های هتل',
  )!;
  (picker.props.onChange as (v: string) => void)('2026-10-01');
  search();
  expect(hooks.request).toHaveBeenCalledTimes(1);
  expect(render().some((n) => n.props.role === 'alert')).toBe(true);
  const clear = render().find((n) => n.props.children === 'پاک‌کردن فیلترها')!;
  hooks.request.mockResolvedValue({
    data: [],
    total: 0,
    page: 1,
    pageSize: 50,
  });
  (clear.props.onClick as () => void)();
  await settle();
  expect(
    render().some(
      (n) => n.props.children === 'بازه‌ای مطابق فیلترها ثبت نشده است.',
    ),
  ).toBe(true);
  hooks.request.mockRejectedValue(Error('Unavailable'));
  (
    render().find((n) => n.props.children === 'تازه‌سازی')!.props
      .onClick as () => void
  )();
  await settle();
  expect(
    render().some(
      (n) => n.props.role === 'alert' && n.props.children === 'Unavailable',
    ),
  ).toBe(true);
});
