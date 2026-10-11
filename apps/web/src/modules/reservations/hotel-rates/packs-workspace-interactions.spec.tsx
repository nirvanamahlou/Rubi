import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import type * as ReactModule from 'react';
import { canonicalTestTree } from '@/i18n/test-tree';
import { HotelRatePacksWorkspace } from './packs-workspace';
import { ManualHotelPanel, ManualHotelSelector } from './manual-hotel-panel';

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  deps: [] as (readonly unknown[])[],
  effects: [] as (() => unknown)[],
  stateIndex: 0,
  refIndex: 0,
  effectIndex: 0,
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const i = hooks.stateIndex++;
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
  useRef: (initial: unknown) =>
    (hooks.refs[hooks.refIndex++] ??= { current: initial }),
  useEffect: (callback: () => unknown, deps: readonly unknown[]) => {
    const i = hooks.effectIndex++;
    if (hooks.deps[i]?.every((value, j) => Object.is(value, deps[j]))) return;
    hooks.deps[i] = deps;
    hooks.effects.push(callback);
  },
}));
vi.mock('@/lib/auth-session', () => ({
  refreshAuthenticatedSession: async () => ({
    user: {
      permissions: ['reservations.read', 'reservations.hotel_purchase.write'],
      branches: [{ id: 'branch', name: 'Synthetic' }],
    },
  }),
}));
vi.mock('./controls', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  rateRequest: async (path: string) => {
    const kind = new URL(path, 'http://test').searchParams.get('kind');
    const data =
      kind === 'countries'
        ? [{ id: 'country', name: 'ترکیه' }]
        : kind === 'cities'
          ? [{ id: 'city', name: 'آنتالیا', countryId: 'country' }]
          : kind === 'hotels'
            ? [
                {
                  id: 'hotel',
                  name: 'Synthetic hotel',
                  roomTypes: [{ id: 'room', name: 'Land' }],
                },
              ]
            : [];
    return { data, meta: { total: data.length } };
  },
}));
function render() {
  hooks.stateIndex = hooks.refIndex = hooks.effectIndex = 0;
  const tree = HotelRatePacksWorkspace();
  hooks.effects.splice(0).forEach((effect) => effect());
  return tree;
}
function nodes(
  tree: ReactNode,
  canonical = true,
): ReactElement<Record<string, unknown>>[] {
  if (canonical) tree = canonicalTestTree(tree);
  if (Array.isArray(tree)) return tree.flatMap((child) => nodes(child, false));
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as ReactElement<Record<string, unknown>>;
  return [node, ...nodes(node.props.children as ReactNode, false)];
}
async function settle() {
  for (let i = 0; i < 6; i++) {
    render();
    await vi.advanceTimersByTimeAsync(250);
  }
  return nodes(render());
}
function click(label: string) {
  const node = nodes(render()).find(
    (n) => n.type === 'button' && n.props.children === label,
  )!;
  expect(node.props.disabled).not.toBe(true);
  (node.props.onClick as () => void)();
}
beforeEach(() => {
  vi.useFakeTimers();
  hooks.states = [];
  hooks.refs = [];
  hooks.deps = [];
  hooks.effects = [];
});
afterEach(() => vi.useRealTimers());
it('starts with the manual editor visible above the collapsed saved-pack browser', async () => {
  const tree = await settle();
  expect(
    tree.some((n) => n.props['aria-label'] === 'ویرایش دستی بستهٔ نرخ'),
  ).toBe(true);
  const editor = tree.findIndex(
    (n) => n.props['aria-label'] === 'ویرایش دستی بستهٔ نرخ',
  );
  const details = tree.findIndex((n) => n.type === 'details');
  expect(editor).toBeLessThan(details);
  expect(tree[details]!.props.open).not.toBe(true);
  expect(tree.some((n) => n.type === ManualHotelSelector)).toBe(true);
  expect(tree.some((n) => n.type === ManualHotelPanel)).toBe(true);
  expect(
    tree.some(
      (n) =>
        n.type === 'h2' && n.props.children === 'ورودی اکسل نرخ ترکیبی هتل',
    ),
  ).toBe(false);
});
it('new package resets selected hotels and changes the panel mount key even while already in new mode', async () => {
  await settle();
  const selector = nodes(render()).find((n) => n.type === ManualHotelSelector)!;
  (selector.props.onChoose as (id: string) => void)('hotel');
  const oldPanel = nodes(render(), false).find(
    (n) => n.type === ManualHotelPanel,
  )!;
  expect(oldPanel.props.hotelId).toBe('hotel');
  click('+ بستهٔ جدید');
  const nextTree = await settle();
  const nextPanel = nodes(render(), false).find(
    (n) => n.type === ManualHotelPanel,
  )!;
  expect(nextPanel.key).not.toBe(oldPanel.key);
  expect(nextPanel.props.hotelId).toBe('');
  expect(
    (nextPanel.props.rows as { selected: boolean }[]).some(
      (row) => row.selected,
    ),
  ).toBe(false);
  expect(
    nextTree.some((n) => n.props['aria-label'] === 'ویرایش دستی بستهٔ نرخ'),
  ).toBe(true);
});
it('close then new package restores the editor rather than leaving it collapsed', async () => {
  await settle();
  click('بستن جدول ویرایش');
  expect(
    nodes(render()).some(
      (n) => n.props['aria-label'] === 'ویرایش دستی بستهٔ نرخ',
    ),
  ).toBe(false);
  click('+ بستهٔ جدید');
  expect(
    (await settle()).some(
      (n) => n.props['aria-label'] === 'ویرایش دستی بستهٔ نرخ',
    ),
  ).toBe(true);
});
