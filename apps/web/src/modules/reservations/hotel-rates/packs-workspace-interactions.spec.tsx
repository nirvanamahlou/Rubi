import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import type * as ReactModule from 'react';
import { canonicalTestTree } from '@/i18n/test-tree';
import { HotelRatePacksWorkspace } from './packs-workspace';
import styles from './rates.module.css';
import { OccupancyBulkPanel } from './occupancy-bulk-panel';
import { ManualHotelPanel, ManualHotelSelector } from './manual-hotel-panel';
import { buildManualRates, defaultCombinations } from './manual-coefficients';

const savedRequests = vi.hoisted(() => [] as RequestInit[]);

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
  rateRequest: async (path: string, init?: RequestInit) => {
    if (path === '/packs' && init?.method === 'POST') {
      savedRequests.push(init);
      return { id: 'saved-pack', version: 1, batchId: 'saved-batch' };
    }
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
                {
                  id: 'second',
                  name: 'Second hotel',
                  roomTypes: [{ id: 'sea', name: 'Sea' }],
                },
              ]
            : [];
    return { data, meta: { total: data.length } };
  },
}));
let initialMode: 'manual' | 'excel' | 'existing' = 'manual';
function render() {
  hooks.stateIndex = hooks.refIndex = hooks.effectIndex = 0;
  const tree = HotelRatePacksWorkspace({ initialMode });
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
  initialMode = 'manual';
  vi.stubGlobal('window', {
    confirm: vi.fn(() => true),
    location: { hostname: 'test', origin: 'http://test' },
  });
  vi.useFakeTimers();
  hooks.states = [];
  hooks.refs = [];
  hooks.deps = [];
  hooks.effects = [];
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('starts with only the manual workflow without the saved-pack browser', async () => {
  const tree = await settle();
  expect(
    tree.some((n) => n.props['aria-label'] === 'ویرایش دستی بستهٔ نرخ'),
  ).toBe(true);
  expect(tree.some((n) => n.props.className === styles.savedPackages)).toBe(
    false,
  );
  expect(tree.some((n) => n.props.className === styles.periodDisclosure)).toBe(
    false,
  );
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

it('opens the existing-pack directory without starting an empty draft', async () => {
  initialMode = 'existing';
  const tree = await settle();
  expect(
    tree.find(
      (n) => n.type === 'details' && n.props.className === styles.savedPackages,
    )?.props.open,
  ).toBe(true);
  expect(
    tree.some((n) => n.props['aria-label'] === 'ویرایش دستی بستهٔ نرخ'),
  ).toBe(false);
});
it('opens Excel import directly from its hub card', async () => {
  initialMode = 'excel';
  const tree = await settle();
  expect(tree.some((n) => n.type === OccupancyBulkPanel)).toBe(true);
  expect(tree.some((n) => n.type === ManualHotelPanel)).toBe(false);
  expect(tree.some((n) => n.props.className === styles.savedPackages)).toBe(
    false,
  );
  expect(
    tree.some(
      (n) => n.type === 'button' && n.props.children === '+ بستهٔ جدید',
    ),
  ).toBe(false);
});

it('keeps Excel import enabled after switching branch', async () => {
  initialMode = 'excel';
  await settle();
  const branch = nodes(render()).find(
    (n) => n.props.label === 'شعبهٔ جدول نرخ هتل',
  )!;
  (branch.props.onChange as (value: string) => void)('other-branch');
  const tree = await settle();
  const importer = tree.find((n) => n.type === OccupancyBulkPanel)!;
  expect(importer.props.branchId).toBe('other-branch');
  expect(importer.props.disabled).toBe(false);
});
it('keeps selected draft when discarding is declined', async () => {
  await settle();
  const selector = nodes(render()).find((n) => n.type === ManualHotelSelector)!;
  (selector.props.onChoose as (id: string) => void)('hotel');
  vi.mocked(window.confirm).mockReturnValue(false);
  click('+ بستهٔ جدید');
  expect(
    nodes(render()).find((n) => n.type === ManualHotelPanel)?.props.hotelId,
  ).toBe('hotel');
});

it('saves all selected hotel panels together and links the saved batch to package management', async () => {
  await settle();
  savedRequests.length = 0;
  const selector = nodes(render()).find((n) => n.type === ManualHotelSelector)!;
  const choose = selector.props.onChoose as (id: string) => void;
  choose('hotel');
  choose('second');
  const date = nodes(render()).find((n) => n.props.name === 'checkIn')!;
  (date.props.onChange as (value: string) => void)('2026-10-01');
  const nights = nodes(render()).find(
    (n) => n.props['aria-label'] === 'تعداد شب اقامت',
  )!;
  (nights.props.onChange as (event: unknown) => void)({
    target: { value: '5' },
  });
  const panel = nodes(render()).find((n) => n.type === ManualHotelPanel)!;
  for (const [id, roomTypeId, amount] of [
    ['hotel', 'room', '100'],
    ['second', 'sea', '200'],
  ]) {
    (panel.props.onChange as (id: string, patch: unknown) => void)(id!, {
      broker: { id: 'broker', name: 'Synthetic broker' },
      base: '1',
      roomRates: [
        {
          roomTypeId,
          roomTypeName: roomTypeId,
          factor: '1',
          maxAdults: '2',
          maxChildren2To6: '0',
          maxChildren6To12: '0',
          maxInfants: '0',
          occupancyRates: buildManualRates(
            defaultCombinations(),
            amount!,
            'EUR',
            '2026-10-01',
            '2026-10-06',
          ),
        },
      ],
    });
    (panel.props.onValidityChange as (id: string, valid: boolean) => void)(
      id!,
      true,
    );
  }
  const form = nodes(render()).find((n) => n.type === 'form')!;
  await (form.props.onSubmit as (event: unknown) => Promise<void>)({
    preventDefault() {},
  });
  expect(savedRequests).toHaveLength(1);
  const payload = JSON.parse(savedRequests[0]!.body as string);
  expect(payload.rows.map((row: { hotelId: string }) => row.hotelId)).toEqual([
    'hotel',
    'second',
  ]);
  expect(
    payload.rows.map(
      (row: { roomRates: { occupancyRates: { amount: string }[] }[] }) =>
        row.roomRates[0]!.occupancyRates[0]!.amount,
    ),
  ).toEqual(['200.00', '400.00']);
  expect(
    nodes(render()).some((n) =>
      String(n.props.href ?? '').includes('batch=saved-batch'),
    ),
  ).toBe(true);
});

it('preserves saved room rates absent from refreshed hotel master links', async () => {
  await settle();
  const selector = nodes(render()).find((n) => n.type === ManualHotelSelector)!;
  (selector.props.onChoose as (id: string) => void)('hotel');
  const panel = nodes(render()).find((n) => n.type === ManualHotelPanel)!;
  const room = {
    roomTypeId: 'historic-room',
    roomTypeName: 'Historic room',
    factor: '1',
    maxAdults: '3',
    maxChildren2To6: '0',
    maxChildren6To12: '0',
    maxInfants: '0',
    occupancyRates: [],
  };
  (panel.props.onChange as (id: string, patch: unknown) => void)('hotel', {
    roomRates: [room],
  });
  const currency = nodes(render()).find(
    (n) => n.props.label === 'ارز پیش‌فرض ردیف جدید',
  )!;
  (currency.props.onChange as (value: string) => void)('USD');
  const tree = await settle();
  const rows = tree.find((n) => n.type === ManualHotelPanel)!.props.rows as {
    hotel: { id: string; roomTypes: { id: string }[] };
    roomRates: unknown[];
  }[];
  const hotel = rows.find((r) => r.hotel.id === 'hotel')!;
  expect(hotel.roomRates).toContainEqual(room);
  expect(hotel.hotel.roomTypes.some((r) => r.id === 'historic-room')).toBe(
    true,
  );
});

it('requires confirmation before changing destination with an Excel file pending', async () => {
  initialMode = 'excel';
  await settle();
  const importer = nodes(render()).find((n) => n.type === OccupancyBulkPanel)!;
  (importer.props.onDirtyChange as (dirty: boolean) => void)(true);
  const fields = nodes(render()).find(
    (n) => typeof n.props.onCountryChange === 'function',
  )!;
  (fields.props.onCountryChange as (id: string) => void)('other-country');
  const tree = nodes(render());
  expect(
    tree.find((n) => typeof n.props.onCountryChange === 'function')!.props
      .countryId,
  ).toBe('country');
  expect(
    tree.some(
      (n) => n.props.children === 'تأیید تغییر مقصد و پاک‌کردن پیش‌نویس',
    ),
  ).toBe(true);
});
