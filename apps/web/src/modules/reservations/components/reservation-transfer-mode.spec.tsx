import { isValidElement, type ReactNode } from 'react';
import type * as ReactModule from 'react';
import type { ReservationIntakeV1 } from '@nora/contracts';
import { beforeEach, expect, it, vi } from 'vitest';
import { canonicalTestTree } from '@/i18n/test-tree';
import { ReservationHotelPurchase } from './reservation-hotel-purchase';
const state = vi.hoisted(() => ({
  index: 0,
  values: [] as unknown[],
  refs: [] as unknown[],
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState(initial: unknown) {
    const index = state.index++;
    if (!(index in state.values))
      state.values[index] = typeof initial === 'function' ? initial() : initial;
    return [
      state.values[index],
      (next: unknown) => {
        state.values[index] =
          typeof next === 'function' ? next(state.values[index]) : next;
      },
    ];
  },
  useRef(initial: unknown) {
    const index = state.index++;
    if (!(index in state.values)) state.values[index] = { current: initial };
    return state.values[index];
  },
}));
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://test-api',
}));
const request = {
  id: 'request',
  purchaseVersion: 4,
  snapshot: {
    passengerIds: ['one', 'two'],
    serviceSelections: [
      { clientKey: 'out', kind: 'TRANSFER', titleSnapshot: 'Outbound' },
      { clientKey: 'back', kind: 'TRANSFER', titleSnapshot: 'Return' },
    ],
  },
  servicePurchases: [],
} as unknown as ReservationIntakeV1;
function nodes(node: ReactNode): Record<string, unknown>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node.props, ...nodes(node.props.children as ReactNode)];
}
function render() {
  state.index = 0;
  return nodes(
    canonicalTestTree(ReservationHotelPurchase({ request, onSaved: vi.fn() })),
  );
}
function change(label: string, value: unknown) {
  const control =
    render().find(
      (p) => p.label === label && typeof p.onChange === 'function',
    ) ?? render().find((p) => p['aria-label'] === label);
  const handler = control?.onChange ?? control?.onValueChange;
  expect(handler).toBeTypeOf('function');
  (handler as (v: unknown) => void)(value);
}
beforeEach(() => {
  state.index = 0;
  state.values = [];
  vi.restoreAllMocks();
});
it('defaults to one transfer purchase and toggles independent suppliers without dropping either leg', async () => {
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue({ ok: true, status: 200 } as Response);
  change('ترانسفر رفت‌وبرگشت · کارگزار ترانسفر', {
    id: 'broker-a',
    name: 'Broker A',
  });
  change('ترانسفر رفت‌وبرگشت · ارز خرید ترانسفر', { id: 'USD', name: 'USD' });
  change('ترانسفر رفت‌وبرگشت · قیمت ترانسفر هر نفر', '20');
  const save = async () => {
    const button = render().find(
      (p) => p.children === 'ثبت درخواست خرید و ارسال به مالی',
    );
    expect(button?.onClick).toBeTypeOf('function');
    await (button!.onClick as () => Promise<void>)();
    return JSON.parse(
      (fetch.mock.calls.at(-1)![1] as RequestInit).body as string,
    );
  };
  expect((await save()).purchases).toEqual([
    expect.objectContaining({
      coveredServiceClientKeys: ['out', 'back'],
      supplierOrganizationId: 'broker-a',
      amount: '40',
    }),
  ]);
  const checkbox = render().find((p) => p.type === 'checkbox');
  expect(checkbox?.checked).toBe(false);
  (checkbox!.onChange as (v: unknown) => void)({ target: { checked: true } });
  change('Return · کارگزار ترانسفر', { id: 'broker-b', name: 'Broker B' });
  change('Outbound · قیمت ترانسفر هر نفر', '10');
  change('Return · قیمت ترانسفر هر نفر', '15');
  const payload = await save();
  expect(payload.expectedVersion).toBe(4);
  expect(payload.purchases).toEqual([
    expect.objectContaining({
      coveredServiceClientKeys: ['out'],
      supplierOrganizationId: 'broker-a',
      amount: '20',
      currencyCode: 'USD',
    }),
    expect.objectContaining({
      coveredServiceClientKeys: ['back'],
      supplierOrganizationId: 'broker-b',
      amount: '30',
      currencyCode: 'USD',
    }),
  ]);
  const check = render().find((p) => p.type === 'checkbox');
  (check!.onChange as (v: unknown) => void)({ target: { checked: false } });
  expect((await save()).purchases).toHaveLength(1);
});
