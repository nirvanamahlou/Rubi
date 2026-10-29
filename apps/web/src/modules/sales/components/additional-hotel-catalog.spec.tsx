import { isValidElement, type ReactNode } from 'react';
import type * as ReactModule from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { canonicalTestTree } from '@/i18n/test-tree';
import { AdditionalHotelStays } from './additional-hotel-stays';
import { emptySalesForm } from '../model/sales-form';
import type { MasterDataRecord } from '@nora/contracts';
const h = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  loaded: vi.fn(),
  patch: vi.fn(),
}));
vi.mock('../api/hotel-catalog', () => ({ loadContractHotels: h.loaded }));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState(initial: unknown) {
    const i = h.index++;
    if (!(i in h.states)) h.states[i] = initial;
    return [
      h.states[i],
      (value: unknown) => {
        h.states[i] = typeof value === 'function' ? value(h.states[i]) : value;
      },
    ];
  },
  useRef(initial: unknown) {
    const i = h.index++;
    if (!(i in h.states)) h.states[i] = { current: initial };
    return h.states[i];
  },
  useEffect: () => undefined,
}));
const hotel = (id: string) =>
  ({
    id,
    resource: 'hotels',
    name: id,
    code: id,
    status: 'active',
    version: 1,
    createdAt: '',
    updatedAt: '',
    attributes: {
      cityId: id === 'Other city' ? 'bodrum' : 'kusadasi',
    },
  }) as MasterDataRecord;
const initial = [hotel('Old option')];
const state = {
  ...emptySalesForm,
  serviceKinds: ['HOTEL' as const],
  hotel: {
    ...emptySalesForm.hotel,
    multiHotel: true,
    additionalStays: [
      {
        hotelId: '',
        cityId: 'kusadasi',
        hotelNameSnapshot: '',
        checkInDate: '2026-11-01',
        checkOutDate: '2026-11-03',
      },
    ],
  },
};
function nodes(node: ReactNode): Record<string, unknown>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node.props, ...nodes(node.props.children as ReactNode)];
}
function render() {
  h.index = 0;
  return nodes(
    canonicalTestTree(
      AdditionalHotelStays({
        state,
        patch: h.patch,
        hotels: initial,
        roomTypes: [],
      }),
    ),
  );
}
const picker = () => render().find((n) => n.label === 'هتل')!;
const close = () => (picker().onOpenChange as (value: boolean) => void)(false);
const open = () => (picker().onOpenChange as (value: boolean) => void)(true);
beforeEach(() => {
  h.states = [];
  h.index = 0;
  vi.resetAllMocks();
});
it('refreshes an incomplete initial list and selects registered Ramada/city without changing entered dates', async () => {
  h.loaded.mockResolvedValue([
    hotel('Other city'),
    hotel('RAMADA RESORT & GOLF'),
  ]);
  expect((picker().options as MasterDataRecord[]).map((x) => x.name)).toEqual([
    'Old option',
  ]);
  open();
  await vi.waitFor(() =>
    expect(
      (picker().options as MasterDataRecord[]).map((x) => x.name),
    ).toContain('RAMADA RESORT & GOLF'),
  );
  expect(picker().loading).toBe(false);
  expect((picker().options as MasterDataRecord[]).map((x) => x.name)).toContain(
    'Other city',
  );
  expect(h.patch).not.toHaveBeenCalled();
  (picker().onChange as (id: string) => void)('RAMADA RESORT & GOLF');
  expect(h.patch.mock.calls[0]![0].hotel.additionalStays[0]).toMatchObject({
    hotelId: 'RAMADA RESORT & GOLF',
    cityId: 'kusadasi',
    hotelNameSnapshot: 'RAMADA RESORT & GOLF',
    checkInDate: '2026-11-01',
    checkOutDate: '2026-11-03',
    rooms: [],
  });
});
it('retains the last complete list with an error/retry after a failed refresh', async () => {
  h.loaded
    .mockResolvedValueOnce([hotel('RAMADA RESORT & GOLF')])
    .mockRejectedValueOnce(Error('offline'));
  open();
  await vi.waitFor(() =>
    expect((picker().options as MasterDataRecord[])[0]?.name).toBe(
      'RAMADA RESORT & GOLF',
    ),
  );
  close();
  open();
  await vi.waitFor(() =>
    expect(render().some((n) => n.children === 'offline')).toBe(true),
  );
  expect((picker().options as MasterDataRecord[])[0]?.name).toBe(
    'RAMADA RESORT & GOLF',
  );
  expect(h.patch).not.toHaveBeenCalled();
});
it('ignores a superseded slow response', async () => {
  let finish!: (value: MasterDataRecord[]) => void;
  h.loaded
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    )
    .mockResolvedValueOnce([hotel('RAMADA RESORT & GOLF')]);
  open();
  close();
  open();
  await vi.waitFor(() =>
    expect((picker().options as MasterDataRecord[])[0]?.name).toBe(
      'RAMADA RESORT & GOLF',
    ),
  );
  finish([hotel('Stale')]);
  await Promise.resolve();
  expect((picker().options as MasterDataRecord[])[0]?.name).toBe(
    'RAMADA RESORT & GOLF',
  );
});

it('fetches once per opening rather than again on every typed character or arrow key', async () => {
  h.loaded.mockResolvedValue([hotel('RAMADA RESORT & GOLF')]);
  open();
  open();
  open();
  expect(picker().loading).toBe(true);
  await vi.waitFor(() =>
    expect((picker().options as MasterDataRecord[])[0]?.name).toBe(
      'RAMADA RESORT & GOLF',
    ),
  );
  expect(h.loaded).toHaveBeenCalledTimes(1);
  close();
  open();
  await vi.waitFor(() => expect(h.loaded).toHaveBeenCalledTimes(2));
});
