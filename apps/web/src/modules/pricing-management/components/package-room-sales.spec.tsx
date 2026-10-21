import { it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode, ReactElement } from 'react';
import type * as ReactModule from 'react';
import { canonicalTestTree } from '@/i18n/test-tree';
import { PackageRoomSales, type PackageSaleRow } from './package-room-sales';
import type { PackageRoomSaleOverrideV1 } from '@nora/contracts';
const hooks = vi.hoisted(() => ({ states: [] as unknown[], index: 0 }));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const i = hooks.index++;
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
}));
let overrides: PackageRoomSaleOverrideV1[] = [];
const rows: PackageSaleRow[] = ['a', 'b'].map((id) => ({
  id,
  hotelName: id,
  brokerName: 'Broker',
  prices: [
    {
      hotelRateId: id,
      roomCode: 'double',
      roomTypeName: 'Standard',
      board: 'BB',
      currencyCode: 'EUR',
      hotelPurchase: '100',
      hotelSale: '200',
      currencyAmounts: [
        {
          currencyCode: 'EUR',
          purchase: '100',
          sale: '200',
          commission: '0',
          profit: '100',
        },
      ],
    },
  ],
}));
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  tree = canonicalTestTree(tree);
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const n = tree as ReactElement<Record<string, unknown>>;
  return [n, ...nodes(n.props.children as ReactNode)];
}
function render() {
  hooks.index = 0;
  return nodes(
    PackageRoomSales({
      rows,
      overrides,
      onChange: (value) => {
        overrides = value;
      },
    }),
  );
}
function click(text: string) {
  const node = render().find(
    (n) => n.props.children === text && typeof n.props.onClick === 'function',
  )!;
  (node.props.onClick as () => void)();
}
function input(label: string, value: string) {
  const node = render().find((n) => n.props['aria-label'] === label)!;
  (node.props.onChange as (e: unknown) => void)({ target: { value } });
}
beforeEach(() => {
  hooks.states = [];
  overrides = [];
});
it('selects priced cells by default, applies changes repeatedly and restricts explicit selection', () => {
  input('مقدار تغییر قیمت فروش', '10');
  click('اعمال روی ترکیب‌های منتخب');
  expect(overrides.map((item) => item.amount)).toEqual(['220.00', '220.00']);
  click('اعمال روی ترکیب‌های منتخب');
  expect(overrides.map((item) => item.amount)).toEqual(['242.00', '242.00']);
  click('لغو انتخاب‌ها');
  const box = render().find((n) => n.props.type === 'checkbox')!;
  (box.props.onChange as (e: unknown) => void)({ target: { checked: true } });
  click('اعمال روی ترکیب‌های منتخب');
  expect(overrides.map((item) => item.amount)).toEqual(['266.20', '242.00']);
  expect(rows[0]?.prices[0]?.hotelPurchase).toBe('100');
});
it('retains raw manual text and rejects an invalid bulk update atomically', () => {
  input('قیمت فروش a دبل · هر نفر EUR', '235.');
  expect(overrides[0]?.amount).toBe('235.');
  input('مقدار تغییر قیمت فروش', '10');
  click('اعمال روی ترکیب‌های منتخب');
  expect(overrides).toHaveLength(1);
  expect(render().some((n) => n.props.role === 'alert')).toBe(true);
  input('قیمت فروش a دبل · هر نفر EUR', '235.20');
  click('اعمال روی ترکیب‌های منتخب');
  expect(overrides.map((item) => item.amount)).toEqual(['258.72', '220.00']);
});
