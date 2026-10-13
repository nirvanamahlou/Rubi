import { beforeEach, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import type * as ReactModule from 'react';
import { canonicalTestTree } from '@/i18n/test-tree';
import { DatePicker } from '@/components/ui/date-picker';
import { HotelPeriodsPanel } from './hotel-periods-panel';

const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  index: 0,
  refIndex: 0,
  mounted: false,
  queued: [] as (() => void)[],
}));
const request = vi.hoisted(() => vi.fn());
vi.mock('./controls', () => ({ rateRequest: request }));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.states))
      hooks.states[index] = typeof initial === 'function' ? initial() : initial;
    return [
      hooks.states[index],
      (next: unknown) => {
        hooks.states[index] =
          typeof next === 'function' ? next(hooks.states[index]) : next;
      },
    ];
  },
  useRef: (initial: unknown) =>
    hooks.refs[hooks.refIndex++] ??
    (hooks.refs[hooks.refIndex - 1] = { current: initial }),
  useEffect: (callback: () => void) => {
    if (!hooks.mounted) hooks.queued.push(callback);
  },
}));
const props = {
  branchId: 'branch',
  cityId: 'city',
  hotelId: 'A',
  revision: 0,
  disabled: false,
  canWrite: true,
  onEdit: vi.fn(),
  onSaved: vi.fn(),
};
const source = (hotelId: string, from: string, to: string) => ({
  id: hotelId + '-pack',
  batchId: hotelId + '-batch',
  version: 2,
  checkIn: from,
  checkOut: to,
  method: 'STAY',
  rows: [
    {
      hotelId,
      hotelName: hotelId,
      brokerId: 'broker',
      brokerName: 'Broker',
      currency: 'EUR',
      roomRates: [
        {
          roomTypeId: 'room',
          roomTypeName: 'Land',
          factor: '1',
          maxAdults: 2,
          maxChildren: 0,
          occupancyRates: [
            {
              adults: 2,
              childAges: [],
              composition: 'DBL',
              amount: '100',
              startsOn: from,
              endsOnExclusive: to,
              currencyCode: 'EUR',
              board: 'BB',
            },
          ],
        },
      ],
    },
  ],
});
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  tree = canonicalTestTree(tree);
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const item = tree as ReactElement<Record<string, unknown>>;
  return [item, ...nodes(item.props.children as ReactNode)];
}
function render() {
  hooks.index = hooks.refIndex = 0;
  const tree = HotelPeriodsPanel(props);
  hooks.mounted = true;
  hooks.queued.splice(0).forEach((effect) => effect());
  return nodes(tree);
}
const flush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};
function date(label: string, value: string) {
  const field = render().find(
    (item) => item.type === DatePicker && item.props['aria-label'] === label,
  )!;
  (field.props.onChange as (value: string) => void)(value);
}
function button(label: string) {
  return render().find(
    (item) => item.type === 'button' && item.props.children === label,
  )!;
}
beforeEach(() => {
  hooks.states = [];
  hooks.refs = [];
  hooks.index = hooks.refIndex = 0;
  hooks.mounted = false;
  hooks.queued = [];
  props.canWrite = true;
  props.onEdit.mockClear();
  props.onSaved.mockClear();
  request.mockReset();
  request.mockImplementation(async (path: string) =>
    path.startsWith('/periods')
      ? [
          source('A', '2027-04-01', '2027-05-01'),
          source('B', '2027-04-18', '2027-05-20'),
        ]
      : { batchId: 'shared-batch' },
  );
});
it('opens the exact selected hotel period, with date filters visible outside the collapsed selection', async () => {
  render();
  await flush();
  (button('ویرایش').props.onClick as () => void)();
  expect(props.onEdit).toHaveBeenCalledWith('A-pack', 'A');
  expect(render().filter((item) => item.type === DatePicker)).toHaveLength(2);
  date('شروع بازهٔ مشترک', '2027-05-02');
  expect(
    render().some(
      (item) => item.type === 'button' && item.props.children === 'ویرایش',
    ),
  ).toBe(false);
});
it('selects city hotels across independent periods and hands their source versions to package creation once', async () => {
  render();
  await flush();
  date('شروع بازهٔ مشترک', '2027-04-20');
  date('پایان بازهٔ مشترک', '2027-04-25');
  const checks = render().filter(
    (item) => item.type === 'input' && item.props.type === 'checkbox',
  );
  expect(checks).toHaveLength(3);
  (checks[0]!.props.onChange as (e: unknown) => void)({
    target: { checked: true },
  });
  const save = button('ثبت بازهٔ مشترک').props.onClick as () => void;
  save();
  save();
  await flush();
  const calls = request.mock.calls.filter(
    ([path]) => path === '/shared-periods',
  );
  expect(calls).toHaveLength(1);
  expect(JSON.parse(calls[0]![1].body).selections).toEqual([
    { key: 'A:broker:EUR', sourceBatchIds: ['A-batch'] },
    { key: 'B:broker:EUR', sourceBatchIds: ['B-batch'] },
  ]);
  expect(
    render().some((item) =>
      String(item.props.href).includes('batch=shared-batch'),
    ),
  ).toBe(true);
});
it('clears hotel selection when the stay changes and prevents writes for read-only users', async () => {
  render();
  await flush();
  date('شروع بازهٔ مشترک', '2027-04-20');
  date('پایان بازهٔ مشترک', '2027-04-25');
  const check = render().find((item) => item.type === 'input')!;
  (check.props.onChange as (e: unknown) => void)({ target: { checked: true } });
  date('پایان بازهٔ مشترک', '2027-04-26');
  expect(button('ثبت بازهٔ مشترک').props.disabled).toBe(true);
  props.canWrite = false;
  expect(button('ویرایش').props.disabled).toBe(true);
  expect(
    render()
      .filter((item) => item.type === 'input')
      .every((item) => item.props.disabled),
  ).toBe(true);
});
