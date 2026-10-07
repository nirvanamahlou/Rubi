import { beforeEach, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import type * as ReactModule from 'react';
import { SearchCombobox } from '@/components/ui/search-combobox';
import {
  ExistingPacksBrowser,
  SavedPackHotelPrices,
} from './existing-packs-browser';
import { savedPack } from './existing-packs.fixture';

const harness = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  dependencies: [] as (readonly unknown[] | undefined)[],
  cleanups: [] as (() => void)[],
  queued: [] as (() => void)[],
  stateIndex: 0,
  refIndex: 0,
  effectIndex: 0,
  request: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const index = harness.stateIndex++;
    if (!(index in harness.states))
      harness.states[index] =
        typeof initial === 'function' ? initial() : initial;
    return [
      harness.states[index],
      (value: unknown) => {
        harness.states[index] =
          typeof value === 'function' ? value(harness.states[index]) : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const index = harness.refIndex++;
    return harness.refs[index] ?? (harness.refs[index] = { current: initial });
  },
  useEffect: (callback: () => unknown, dependencies: readonly unknown[]) => {
    const index = harness.effectIndex++;
    const previous = harness.dependencies[index];
    if (
      previous &&
      previous.length === dependencies.length &&
      previous.every((value, i) => Object.is(value, dependencies[i]))
    )
      return;
    harness.dependencies[index] = dependencies;
    harness.queued.push(() => {
      harness.cleanups[index]?.();
      const cleanup = callback();
      harness.cleanups[index] =
        typeof cleanup === 'function' ? (cleanup as () => void) : () => {};
    });
  },
}));
vi.mock('./controls', () => ({ rateRequest: harness.request }));

const callbacks = { onSaved: vi.fn(), onLockChange: vi.fn() };
function render() {
  harness.stateIndex = 0;
  harness.refIndex = 0;
  harness.effectIndex = 0;
  const tree = ExistingPacksBrowser({
    branchId: 'branch-1',
    revision: 0,
    canWrite: true,
    ...callbacks,
  });
  harness.queued.splice(0).forEach((effect) => effect());
  return tree;
}
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as ReactElement<Record<string, unknown>>;
  return [node, ...nodes(node.props.children as ReactNode)];
}
function choose(label: string, value: string) {
  const node = nodes(render()).find(
    (item) => item.type === SearchCombobox && item.props.label === label,
  )!;
  (node.props.onValueChange as (id: string) => void)(value);
  render();
}
function prices() {
  return nodes(render()).find((item) => item.type === SavedPackHotelPrices);
}
function button(label: string) {
  return nodes(render()).find(
    (item) => item.type === 'button' && item.props.children === label,
  )!;
}
async function open() {
  render();
  await vi.waitFor(() =>
    expect(harness.request).toHaveBeenCalledWith(
      expect.stringContaining('/packs?'),
    ),
  );
  await vi.waitFor(() => expect(harness.states[5]).toBe(false));
  choose('شهر بسته‌های موجود', 'city-1');
  choose('تاریخ بسته‌های شهر', 'pack-1');
  await vi.waitFor(() =>
    expect(prices()?.props.pack).toMatchObject({ id: 'pack-1' }),
  );
}
beforeEach(() => {
  harness.cleanups.forEach((cleanup) => cleanup());
  harness.states = [];
  harness.refs = [];
  harness.dependencies = [];
  harness.cleanups = [];
  harness.queued = [];
  harness.request.mockReset();
  callbacks.onSaved.mockClear();
  callbacks.onLockChange.mockClear();
  harness.request.mockImplementation(async (path: string) =>
    path.startsWith('/packs?')
      ? {
          data: [
            { ...savedPack(), hotelCount: 2 },
            { ...savedPack(), id: 'pack-2', hotelCount: 2 },
          ],
          total: 2,
        }
      : savedPack(),
  );
});

it('guards unsaved city/date navigation, preserves the draft and supports explicit discard', async () => {
  await open();
  const pack = savedPack();
  pack.rows[1]!.base = '99.99';
  (prices()!.props.onChange as (value: typeof pack) => void)(pack);
  expect(callbacks.onLockChange).toHaveBeenLastCalledWith(true);
  choose('تاریخ بسته‌های شهر', 'pack-2');
  expect(prices()?.props.pack).toMatchObject({
    id: 'pack-1',
    rows: [{}, { base: '99.99' }],
  });
  (button('کنارگذاشتن تغییرات ذخیره‌نشده').props.onClick as () => void)();
  expect(prices()?.props.pack).toMatchObject({
    rows: [{}, { base: '20.1234' }],
  });
  expect(callbacks.onLockChange).toHaveBeenLastCalledWith(false);
});

it('ignores an old detail response after selecting a different date pack', async () => {
  let resolveOld!: (value: ReturnType<typeof savedPack>) => void;
  let resolveNew!: (value: ReturnType<typeof savedPack>) => void;
  harness.request.mockImplementation((path: string) => {
    if (path.startsWith('/packs?'))
      return Promise.resolve({
        data: [
          { ...savedPack(), hotelCount: 2 },
          { ...savedPack(), id: 'pack-2', hotelCount: 2 },
        ],
        total: 2,
      });
    return new Promise((resolve) => {
      if (path.endsWith('pack-1')) resolveOld = resolve;
      else resolveNew = resolve;
    });
  });
  render();
  await vi.waitFor(() => expect(harness.states[5]).toBe(false));
  choose('شهر بسته‌های موجود', 'city-1');
  choose('تاریخ بسته‌های شهر', 'pack-1');
  await vi.waitFor(() => expect(resolveOld).toBeTypeOf('function'));
  choose('تاریخ بسته‌های شهر', 'pack-2');
  await vi.waitFor(() => expect(resolveNew).toBeTypeOf('function'));
  resolveNew({ ...savedPack(), id: 'pack-2' });
  await vi.waitFor(() =>
    expect(prices()?.props.pack).toMatchObject({ id: 'pack-2' }),
  );
  resolveOld(savedPack());
  await Promise.resolve();
  await Promise.resolve();
  expect(prices()?.props.pack).toMatchObject({ id: 'pack-2' });
});

it('retains an offline draft and retries the same whole-pack operation key before accepting a new version', async () => {
  await open();
  const pack = savedPack();
  pack.rows[1]!.base = '55.55';
  (prices()!.props.onChange as (value: typeof pack) => void)(pack);
  harness.request.mockRejectedValueOnce(new Error('offline'));
  (button('ثبت تغییرات قیمت · نسخهٔ جدید').props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(button('ثبت تغییرات قیمت · نسخهٔ جدید').props.disabled).toBe(false),
  );
  expect(prices()?.props.pack).toMatchObject({ version: 3 });
  expect(callbacks.onSaved).not.toHaveBeenCalled();
  const first = harness.request.mock.calls.at(-1)?.[1];
  harness.request.mockResolvedValueOnce({ id: 'pack-1', version: 4 });
  (button('ثبت تغییرات قیمت · نسخهٔ جدید').props.onClick as () => void)();
  await vi.waitFor(() => expect(callbacks.onSaved).toHaveBeenCalledTimes(1));
  expect(harness.request.mock.calls.at(-1)?.[1]).toEqual(first);
  expect(JSON.parse(first.body).rows).toHaveLength(2);
  expect(prices()?.props.pack).toMatchObject({
    version: 4,
    rows: [{}, { base: '55.55' }],
  });
  expect(callbacks.onLockChange).toHaveBeenLastCalledWith(false);
});
