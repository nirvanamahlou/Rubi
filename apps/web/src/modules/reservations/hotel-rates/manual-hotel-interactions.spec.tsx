import { beforeEach, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import type * as ReactModule from 'react';
import { canonicalTestTree } from '@/i18n/test-tree';
import { Choice } from './controls';
import { HotelCoefficients, type ManualHotelRow } from './manual-hotel-panel';

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
function click(label: string) {
  const node = nodes(render()).find(
    (n) => n.type === 'button' && n.props.children === label,
  )!;
  (node.props.onClick as () => void)();
}
const prices = () =>
  row.roomRates.map((r) =>
    r.occupancyRates!.map((rate) => [rate.amount, rate.saleAmount]),
  );
const saleLabel = (room: string) => `قیمت فروش ${room} دبل`;
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
it('applies selected sale adjustment once against purchase across rooms and reprices each base independently', () => {
  input('قیمت پایه Land', '100');
  input('قیمت پایه Sea', '200');
  click('انتخاب همهٔ ترکیب‌های قیمت‌دار');
  input('مقدار تغییر قیمت فروش', '10');
  click('اعمال روی ترکیب‌های منتخب');
  expect(prices()).toEqual([[['200.00', '220.00']], [['400.00', '440.00']]]);
  click('اعمال روی ترکیب‌های منتخب');
  expect(prices()).toEqual([[['200.00', '220.00']], [['400.00', '440.00']]]);
  input('قیمت پایه Land', '200');
  expect(prices()).toEqual([[['400.00', '440.00']], [['400.00', '440.00']]]);
  click('لغو انتخاب‌ها');
  const checkbox = nodes(render()).find(
    (n) => n.type === 'input' && n.props.type === 'checkbox',
  )!;
  (checkbox.props.onChange as (e: unknown) => void)({
    target: { checked: true },
  });
  choose('نوع تغییر قیمت فروش', 'AMOUNT');
  choose('افزایش یا کاهش', 'decrease');
  input('مقدار تغییر قیمت فروش', '5');
  click('اعمال روی ترکیب‌های منتخب');
  expect(prices()).toEqual([[['400.00', '395.00']], [['400.00', '440.00']]]);
});
it('rejects negative group sale atomically and does not change any purchase or prior sale', () => {
  input('قیمت پایه Land', '100');
  input('قیمت پایه Sea', '200');
  click('انتخاب همهٔ ترکیب‌های قیمت‌دار');
  choose('نوع تغییر قیمت فروش', 'AMOUNT');
  choose('افزایش یا کاهش', 'decrease');
  input('مقدار تغییر قیمت فروش', '250');
  click('اعمال روی ترکیب‌های منتخب');
  expect(prices()).toEqual([[['200.00', '200.00']], [['400.00', '400.00']]]);
  expect(nodes(render()).some((n) => n.props.role === 'alert')).toBe(true);
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
it('edits one sale cell without changing purchase or other rooms and preserves it on reopening', () => {
  input('قیمت پایه Land', '100');
  input('قیمت پایه Sea', '200');
  input(saleLabel('Land'), '235.20');
  expect(prices()).toEqual([[['200.00', '235.20']], [['400.00', '400.00']]]);
  hooks.states = [];
  hooks.effects = [];
  render();
  expect(prices()).toEqual([[['200.00', '235.20']], [['400.00', '400.00']]]);
  input('قیمت پایه Land', '150');
  expect(prices()).toEqual([[['300.00', '235.20']], [['400.00', '400.00']]]);
});
it('keeps raw sale text while typing so intermediate keystrokes do not rewrite the number', () => {
  input('قیمت پایه Land', '100');
  for (const value of ['2', '23', '235', '235.', '235.2']) {
    input(saleLabel('Land'), value);
    expect(
      nodes(render()).find((n) => n.props['aria-label'] === saleLabel('Land'))
        ?.props.value,
    ).toBe(value);
  }
  expect(valid).toHaveBeenLastCalledWith(true);
  expect(prices()).toEqual([[['200.00', '235.20']]]);
});
it('does not silently save an unfinished sale edit and recovers when it is corrected', async () => {
  input('قیمت پایه Land', '100');
  input(saleLabel('Land'), '');
  expect(valid).toHaveBeenLastCalledWith(false);
  expect(
    nodes(render()).find((n) => n.props['aria-label'] === saleLabel('Land'))
      ?.props.value,
  ).toBe('');
  input('قیمت پایه Land', '150');
  expect(valid).toHaveBeenLastCalledWith(false);
  checkOut = '2026-12-01';
  render();
  await Promise.resolve();
  expect(valid).toHaveBeenLastCalledWith(false);
  input(saleLabel('Land'), '320');
  expect(valid).toHaveBeenLastCalledWith(true);
  expect(prices()).toEqual([[['300.00', '320.00']]]);
});
it('selects a row by clicking the table and replaces an invalid sale draft with a group adjustment', () => {
  input('قیمت پایه Land', '100');
  input('قیمت پایه Sea', '200');
  input(saleLabel('Land'), '-1');
  click('لغو انتخاب‌ها');
  const tableRow = nodes(render()).find(
    (n) => n.type === 'tr' && typeof n.props.onClick === 'function',
  )!;
  (tableRow.props.onClick as () => void)();
  input('مقدار تغییر قیمت فروش', '10');
  click('اعمال روی ترکیب‌های منتخب');
  expect(valid).toHaveBeenLastCalledWith(true);
  expect(prices()).toEqual([[['200.00', '220.00']], [['400.00', '400.00']]]);
});
it('shares adult/child age compositions and coefficients across every room type', () => {
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
    [
      ['400.00', '400.00'],
      ['500.00', '500.00'],
    ],
  ]);
  row.roomRates.forEach((room) => {
    expect(room.occupancyRates![1]).toMatchObject({
      adults: 2,
      childAges: [{ min: 4, maxExclusive: 15 }],
    });
  });
});

it('selects priced rows automatically and preserves explicit deselection', () => {
  const checks = () =>
    nodes(render()).filter(
      (n) => n.type === 'input' && n.props.type === 'checkbox',
    );
  expect(checks().every((n) => !n.props.checked)).toBe(true);
  input('قیمت پایه Land', '100');
  expect(checks().filter((n) => n.props.checked)).toHaveLength(1);
  input('قیمت پایه Sea', '200');
  expect(checks().filter((n) => n.props.checked)).toHaveLength(2);
  const selected = checks().find((n) => n.props.checked)!;
  (selected.props.onChange as () => void)();
  expect(checks().filter((n) => n.props.checked)).toHaveLength(1);
  input('قیمت پایه Land', '150');
  expect(checks().filter((n) => n.props.checked)).toHaveLength(1);
  click('لغو انتخاب‌ها');
  expect(checks().every((n) => !n.props.checked)).toBe(true);
  click('انتخاب همهٔ ترکیب‌های قیمت‌دار');
  expect(checks().filter((n) => n.props.checked)).toHaveLength(2);
});
