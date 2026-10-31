import { beforeEach, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import type * as ReactModule from 'react';
import type { TicketOfferV1 } from '@nora/contracts';
import { canonicalTestTree } from '@/i18n/test-tree';
import { FlightLoadGrid } from './flight-load-grid';
import styles from './flight-load-grid.module.css';
import { searchOptions } from '@/components/ui/search-combobox';

const hooks = vi.hoisted(() => ({ states: [] as unknown[], index: 0 }));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useEffect: () => undefined,
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
const flight = (id: string, day: number, back = false): TicketOfferV1 => ({
  id,
  version: 1,
  branchId: 'branch',
  originId: back ? 'b' : 'a',
  destinationId: back ? 'a' : 'b',
  departureAt: `2099-10-${day}T10:00:00Z`,
  arrivalAt: `2099-10-${day}T12:00:00Z`,
  carrierName: 'Synthetic airline',
  serviceNumber: id,
  cabinClassCode: 'ECONOMY',
  totalCapacity: 50,
  remainingCapacity: 50,
  status: 'ACTIVE',
  supplyType: 'COMPANY',
  returnMinDays: 1,
  returnMaxDays: 3,
});
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const n = tree as ReactElement<Record<string, unknown>>;
  return [n, ...nodes(n.props.children as ReactNode)];
}
function render() {
  hooks.index = 0;
  return nodes(
    canonicalTestTree(
      FlightLoadGrid({
        offers: [
          {
            ...flight('out-a', 10),
            saleRoutes: [
              'bodrum',
              'izmir',
              'kusadasi',
              'istanbul',
              'ankara',
            ].map((destinationId) => ({ originId: 'a', destinationId })),
          },
          flight('out-b', 20),
          flight('return-a', 12, true),
        ],
        references: [{ kind: 'city', id: 'a', name: 'تهران', active: true }],
        cityName: (id) => id,
        refreshing: false,
        onRefresh: vi.fn(),
        renderActions: () => <button>action</button>,
      }),
    ),
  );
}
function click(label: string) {
  const button = render().find(
    (n) => n.props.children === label && typeof n.props.onClick === 'function',
  );
  expect(button).toBeDefined();
  (button!.props.onClick as () => void)();
}
function select(id: string) {
  const radio = render().find(
    (n) =>
      n.type === 'input' && String(n.props['aria-label']).includes(` ${id} `),
  );
  expect(radio).toBeDefined();
  (radio!.props.onChange as () => void)();
}
const tables = () =>
  render().filter((n) => n.props.className === styles.scroller);
function route() {
  for (const [id, value] of [
    ['load-origin', 'a'],
    ['load-destination', 'b'],
  ]) {
    const field = render().find(
      (n) => n.props.id === id && typeof n.props.onChange === 'function',
    );
    expect(field).toBeDefined();
    (field!.props.onChange as (event: unknown) => void)({ target: { value } });
  }
}
beforeEach(() => {
  hooks.states = [];
  hooks.index = 0;
});
it('keeps both result viewports mounted while changed filters clear stale selectable rows', () => {
  expect(tables()).toHaveLength(0);
  route();
  click('جست‌وجو');
  expect(tables()).toHaveLength(2);
  const input = render().find(
    (n) =>
      n.props.id === 'load-number' && typeof n.props.onChange === 'function',
  );
  expect(input).toBeDefined();
  (input!.props.onChange as (event: unknown) => void)({
    target: { value: 'changed' },
  });
  expect(tables()).toHaveLength(2);
  expect(
    render().filter((n) => n.type === 'input' && n.props.type === 'radio'),
  ).toHaveLength(0);
  expect(render().some((n) => n.props.className === styles.details)).toBe(true);
});
it('keeps result and detail regions when a new outbound removes the previously selected return', () => {
  route();
  click('جست‌وجو');
  select('out-a');
  select('return-a');
  select('out-b');
  expect(tables()).toHaveLength(2);
  expect(
    render().filter(
      (n) => n.type === 'input' && n.props.checked && n.props.type === 'radio',
    ),
  ).toHaveLength(1);
  const back = render().find(
    (n) => n.props['aria-label'] === 'بلیت برگشت انتخاب‌شده',
  );
  expect(back).toBeDefined();
  expect(nodes(back).some((n) => n.props.children === 'action')).toBe(false);
});

it('hides both load tables when either endpoint is cleared after searching', () => {
  route();
  click('جست‌وجو');
  expect(tables()).toHaveLength(2);
  const field = render().find(
    (n) =>
      n.props.id === 'load-origin' && typeof n.props.onChange === 'function',
  );
  (field!.props.onChange as (event: unknown) => void)({
    target: { value: '' },
  });
  expect(tables()).toHaveLength(0);
});

it('defaults and resets the origin to Tehran but preserves a manual city choice', () => {
  const field = () =>
    render().find(
      (n) =>
        n.props.id === 'load-origin' && typeof n.props.onChange === 'function',
    )!;
  expect(field().props.value).toBe('a');
  (field().props.onChange as (event: unknown) => void)({
    target: { value: 'b' },
  });
  expect(field().props.value).toBe('b');
  click('پاک‌کردن فیلترها');
  expect(field().props.value).toBe('a');
  expect(render().some((n) => n.props.id === 'load-origin-country')).toBe(
    false,
  );
});

it('shows all primary and alternate charter destinations, including Bodrum and Izmir, without the shared five-option truncation', () => {
  const field = render().find(
    (n) =>
      n.props.id === 'load-destination' &&
      typeof n.props.onChange === 'function',
  )!;
  const options = nodes(field.props.children as ReactNode)
    .filter((n) => n.type === 'option')
    .map((n) => ({
      value: String(n.props.value),
      label: n.props.children as ReactNode,
    }));
  expect(options.map((o) => o.value)).toEqual([
    '',
    'b',
    'bodrum',
    'izmir',
    'kusadasi',
    'istanbul',
    'ankara',
  ]);
  expect(
    searchOptions(options, '', field.props.optionLimit as number).map(
      (o) => o.value,
    ),
  ).toEqual(options.map((o) => o.value));
  (field.props.onChange as (event: unknown) => void)({
    target: { value: 'izmir' },
  });
  click('جست‌وجو');
  expect(
    render().some(
      (n) =>
        n.type === 'input' && String(n.props['aria-label']).includes(' out-a '),
    ),
  ).toBe(true);
});
