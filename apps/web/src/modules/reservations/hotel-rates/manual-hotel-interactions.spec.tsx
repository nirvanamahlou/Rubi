import { beforeEach, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import type * as ReactModule from 'react';
import { canonicalTestTree } from '@/i18n/test-tree';
import { Choice } from './controls';
import {
  HotelCoefficients,
  ManualHotelSelector,
  type ManualHotelRow,
} from './manual-hotel-panel';

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  events: [] as (() => void)[],
  effects: [] as (readonly unknown[])[],
  queued: [] as (() => void)[],
  stateIndex: 0,
  eventIndex: 0,
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
  useEffectEvent: (callback: () => void) => {
    const i = hooks.eventIndex++;
    hooks.events[i] = callback;
    return () => hooks.events[i]!();
  },
  useEffect: (callback: () => void, deps: readonly unknown[]) => {
    const i = hooks.effectIndex++;
    if (hooks.effects[i]?.every((v, j) => Object.is(v, deps[j]))) return;
    hooks.effects[i] = deps;
    hooks.queued.push(callback);
  },
}));
let row: ManualHotelRow;
let checkIn: string, checkOut: string;
const valid = vi.fn();
function render() {
  hooks.stateIndex = hooks.eventIndex = hooks.effectIndex = 0;
  const tree = HotelCoefficients({
    row,
    checkIn,
    checkOut,
    onValidityChange: valid,
    onChange: (patch) => {
      row = { ...row, ...patch };
    },
  });
  hooks.queued.splice(0).forEach((effect) => effect());
  return tree;
}
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  tree = canonicalTestTree(tree);
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as ReactElement<Record<string, unknown>>;
  return [node, ...nodes(node.props.children as ReactNode)];
}
function input(label: string, value: string, index = 0) {
  const node = nodes(render()).filter(
    (n) => n.type === 'input' && n.props['aria-label'] === label,
  )[index]!;
  (node.props.onChange as (e: unknown) => void)({ target: { value } });
}
function choose(label: string, value: string, index = 0) {
  const node = nodes(render()).filter(
    (n) => n.type === Choice && n.props.label === label,
  )[index]!;
  (node.props.onChange as (v: string) => void)(value);
}

const prices = () =>
  row.roomRates.map((r) =>
    r.occupancyRates!.map((rate) => [rate.amount, rate.saleAmount]),
  );
function selectRoom(name: string, checked = true) {
  const node = nodes(render()).find(
    (n) =>
      n.type === 'input' && n.props['aria-label'] === `انتخاب نوع اتاق ${name}`,
  )!;
  (node.props.onChange as (event: unknown) => void)({ target: { checked } });
}
beforeEach(() => {
  hooks.states = [];
  hooks.events = [];
  hooks.effects = [];
  hooks.queued = [];
  valid.mockClear();
  checkIn = '2026-10-01';
  checkOut = '2026-11-01';
  row = {
    hotel: {
      id: 'hotel',
      name: 'Synthetic',
      roomTypes: [
        { id: 'land', name: 'Land' },
        { id: 'sea', name: 'Sea' },
      ],
    },
    selected: true,
    broker: null,
    base: '1',
    currency: 'EUR',
    inCityList: true,
    roomRates: [],
  };
});
it('selects only the first room by default even when lookup initializes all empty room rows', () => {
  row.roomRates = row.hotel.roomTypes!.map((room) => ({
    roomTypeId: room.id,
    roomTypeName: room.name,
    factor: '1',
    maxAdults: '2',
    maxChildren2To6: '0',
    maxChildren6To12: '0',
    maxInfants: '0',
  }));
  input('قیمت پایه Land', '100');
  expect(row.roomRates.map((room) => room.roomTypeId)).toEqual(['land']);
  selectRoom('Sea');
  expect(valid).toHaveBeenLastCalledWith(false);
  input('قیمت پایه Sea', '200');
  expect(valid).toHaveBeenLastCalledWith(true);
  selectRoom('Land', false);
  expect(row.roomRates.map((room) => room.roomTypeId)).toEqual(['sea']);
  selectRoom('Land');
  expect(prices()).toEqual([[['200.00', '200.00']], [['400.00', '400.00']]]);
});
it('keeps saved room choices after reopening instead of reverting to the first room', () => {
  selectRoom('Sea');
  input('قیمت پایه Sea', '200');
  selectRoom('Land', false);
  hooks.states = [];
  hooks.effects = [];
  const tree = nodes(render());
  expect(
    tree.find((n) => n.props['aria-label'] === 'انتخاب نوع اتاق Sea')?.props
      .checked,
  ).toBe(true);
  expect(
    tree.find((n) => n.props['aria-label'] === 'انتخاب نوع اتاق Land')?.props
      .checked,
  ).toBe(false);
  expect(row.roomRates.map((room) => room.roomTypeId)).toEqual(['sea']);
});
it('searches hotels without losing selected rows and supports checkbox removal', () => {
  const choose = vi.fn();
  const remove = vi.fn();
  const rows = [
    row,
    {
      ...row,
      selected: false,
      hotel: { ...row.hotel, id: 'other', name: 'Other hotel' },
    },
  ];
  function selector() {
    hooks.stateIndex = 0;
    return nodes(
      ManualHotelSelector({
        rows,
        hotelId: '',
        onChoose: choose,
        onRemove: remove,
      }),
    );
  }
  let tree = selector();
  const checks = tree.filter(
    (n) => n.type === 'input' && n.props.type === 'checkbox',
  );
  (checks[1]!.props.onChange as (event: unknown) => void)({
    target: { checked: true },
  });
  expect(choose).toHaveBeenCalledWith('other');
  (checks[0]!.props.onChange as (event: unknown) => void)({
    target: { checked: false },
  });
  expect(remove).toHaveBeenCalledWith('hotel');
  (
    tree.find((n) => n.props['aria-label'] === 'جست‌وجوی هتل‌های شهر')!.props
      .onChange as (event: unknown) => void
  )({ target: { value: 'other' } });
  tree = selector();
  expect(
    tree.filter((n) => n.type === 'input' && n.props.type === 'checkbox'),
  ).toHaveLength(1);
  expect(
    tree.some((n) => n.type === 'td' && n.props.children === 'Synthetic'),
  ).toBe(true);
});
it('marks duplicate composition or invalid child range unsavable instead of keeping stale prices', () => {
  input('قیمت پایه Land', '100');
  input('ضریب ترکیب اتاق', '1.5', 1);
  choose('تعداد بزرگسال ترکیب', '2', 1);
  expect(valid).toHaveBeenLastCalledWith(false);
  expect(row.roomRates).toHaveLength(0);
  choose('تعداد بزرگسال ترکیب', '1', 1);
  input('ضریب ترکیب اتاق', '2.5', 2);
  expect(valid).toHaveBeenLastCalledWith(true);
  choose('حداقل سن کودک', '14');
  choose('حد بالای سن کودک', '14');
  expect(valid).toHaveBeenLastCalledWith(false);
  expect(row.roomRates).toHaveLength(0);
});
it('retains local inputs and synchronizes new dates and currency with valid metadata', async () => {
  input('قیمت پایه Land', '100');
  checkIn = '2026-11-01';
  checkOut = '2026-12-01';
  render();
  await Promise.resolve();
  expect(row.roomRates[0]?.occupancyRates?.[0]?.startsOn).toBe(checkIn);
  choose('ارز نرخ هتل', 'IRR');
  render();
  await Promise.resolve();
  expect(row.roomRates[0]?.occupancyRates?.[0]).toMatchObject({
    amount: '200',
    saleAmount: '200',
    currencyCode: 'IRR',
  });
  input('قیمت پایه Land', '');
  expect(valid).toHaveBeenLastCalledWith(false);
  expect(row.roomRates).toHaveLength(0);
});
it('edits each room coefficient and child composition independently', () => {
  selectRoom('Sea');
  input('قیمت پایه Land', '100');
  input('قیمت پایه Sea', '200');
  input('ضریب ترکیب اتاق', '2.5', 2);
  choose('حداقل سن کودک', '4');
  choose('حد بالای سن کودک', '15');
  expect(prices()).toEqual([
    [
      ['200.00', '200.00'],
      ['250.00', '250.00'],
    ],
    [['400.00', '400.00']],
  ]);
  expect(row.roomRates[0]!.occupancyRates![1]).toMatchObject({
    adults: 2,
    childAges: [{ min: 4, maxExclusive: 15 }],
  });
  expect(row.roomRates[1]!.occupancyRates).toHaveLength(1);
  input('ضریب ترکیب اتاق', '3', 3);
  expect(prices()[0]).toEqual([
    ['200.00', '200.00'],
    ['250.00', '250.00'],
  ]);
  expect(prices()[1]).toEqual([['600.00', '600.00']]);
});

it('has no sale controls and preserves historical sale metadata when editing purchase bases', () => {
  input('قیمت پایه Land', '100');
  const rate = row.roomRates[0]!.occupancyRates![0]!;
  rate.manualPricing!.adjustment = { kind: 'SET', value: '235.20' };
  rate.saleAmount = '235.20';
  hooks.states = [];
  hooks.effects = [];
  render();
  input('قیمت پایه Land', '150');
  expect(prices()).toEqual([[['300.00', '235.20']]]);
  expect(
    nodes(render()).some((n) =>
      String(n.props['aria-label'] ?? '').includes('فروش'),
    ),
  ).toBe(false);
});

it('restores different coefficients per room and keeps both after save/reopen', () => {
  selectRoom('Sea');
  input('قیمت پایه Land', '100');
  input('قیمت پایه Sea', '200');
  input('ضریب ترکیب اتاق', '3', 3);
  const saved = structuredClone(row.roomRates);
  hooks.states = [];
  hooks.effects = [];
  render();
  input('قیمت پایه Land', '150');
  expect(prices()).toEqual([[['300.00', '300.00']], [['600.00', '600.00']]]);
  expect(row.roomRates[1]!.occupancyRates).toEqual(saved[1]!.occupancyRates);
  expect(row.roomRates[1]!.occupancyRates![0]!.manualPricing!.coefficient).toBe(
    '3',
  );
});
it('adds and removes compositions only in the associated room, including newly linked room types', () => {
  selectRoom('Sea');
  input('قیمت پایه Land', '100');
  input('قیمت پایه Sea', '200');
  const click = (roomId: string, text: string) => {
    const section = nodes(render()).find(
      (n) => n.props['data-room-type'] === roomId,
    )!;
    const button = nodes(section).find(
      (n) => n.type === 'button' && n.props.children === text,
    )!;
    (button.props.onClick as () => void)();
  };
  click('land', 'افزودن ردیف');
  expect(
    nodes(render()).filter(
      (n) => n.type === 'input' && n.props['aria-label'] === 'ضریب ترکیب اتاق',
    ),
  ).toHaveLength(7);
  click('land', 'حذف ردیف');
  expect(prices()).toEqual([[['400.00', '400.00']]]);
  expect(row.roomRates[0]!.roomTypeId).toBe('sea');
  row = {
    ...row,
    hotel: {
      ...row.hotel,
      roomTypes: [...row.hotel.roomTypes!, { id: 'suite', name: 'Suite' }],
    },
  };
  selectRoom('Suite');
  input('قیمت پایه Suite', '300');
  expect(
    row.roomRates.find((r) => r.roomTypeId === 'suite')!.occupancyRates![0]!
      .amount,
  ).toBe('600.00');
  expect(
    row.roomRates.find((r) => r.roomTypeId === 'sea')!.occupancyRates![0]!
      .amount,
  ).toBe('400.00');
});
