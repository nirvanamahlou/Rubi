import { beforeEach, expect, it, vi } from 'vitest';
import type * as ReactModule from 'react';
import type { ReactElement, ReactNode } from 'react';
import { canonicalTestTree } from '@/i18n/test-tree';
const h = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  index: 0,
  ref: 0,
  saved: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const i = h.index++;
    if (!(i in h.states))
      h.states[i] = typeof initial === 'function' ? initial() : initial;
    return [
      h.states[i],
      (next: unknown) => {
        h.states[i] = typeof next === 'function' ? next(h.states[i]) : next;
      },
    ];
  },
  useRef: (value: unknown) => (h.refs[h.ref++] ??= { current: value }),
  useEffect: vi.fn(),
  useCallback: (fn: unknown) => fn,
}));
vi.mock('@/modules/iam/access-context', () => ({
  useAccessPermissions: () => [],
}));
vi.mock('./reservation-currencies', () => ({
  useReservationCurrencies: () => ({
    currencies: [
      { code: 'EUR', name: 'EUR' },
      { code: 'IRR', name: 'IRR' },
    ],
    loading: false,
    error: '',
  }),
  ReservationCurrencySelect: () => null,
}));
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'https://api.test/api/v1',
}));
import { HotelStayPurchase, HotelStayPurchases } from './hotel-stay-purchase';
import {
  ReservationHotelPurchase,
  LegacyReservationHotelPurchase,
} from './reservation-hotel-purchase';
import { HotelRoomQuotationEditor } from './hotel-room-quotation-editor';
import { Button } from '@/components/ui/button';
import { defaultVoucherSettings } from '../model/voucher-settings';
import type { ReservationFormIntake } from '../model/reservation-form';
const request = {
  id: 'test',
  purchaseVersion: 0,
  snapshot: {
    passengerIds: [],
    serviceSelections: [{ clientKey: 'h', kind: 'HOTEL' }],
    hotelSelection: {
      serviceClientKey: 'h',
      hotelId: 'hotel',
      hotelNameSnapshot: 'TEST HOTEL',
      checkInDate: '2026-11-01',
      checkOutDate: '2026-11-04',
      rooms: [
        { ordinal: 1, roomTypeNameSnapshot: 'DBL', adults: 2, childAges: [] },
      ],
    },
  },
  workflow: {
    version: 8,
    roomOrder: [],
    ageOverrides: {},
    note: '',
    supplierStatus: 'NEW',
  },
} as unknown as ReservationFormIntake;
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  tree = canonicalTestTree(tree);
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as ReactElement<Record<string, unknown>>;
  return [node, ...nodes(node.props.children as ReactNode)];
}
function render(input = request) {
  h.index = 0;
  h.ref = 0;
  return nodes(
    HotelStayPurchase({ request: input, stayKey: 'h', onSaved: h.saved }),
  );
}
beforeEach(() => {
  h.states = [];
  h.refs = [];
  h.saved.mockReset();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true })),
  );
  const settings = defaultVoucherSettings(request, {});
  settings.brokerId = '11111111-1111-4111-8111-111111111111';
  settings.text.broker = 'BROKER';
  settings.hotelRoomPrices = {
    currencyCode: 'EUR',
    rooms: [{ roomOrdinal: 1, baseAmount: '90', factor: '2' }],
  };
  settings.hotelTransferCounts = { outbound: 0, returning: 0 };
  settings.supplierFormPrices = {
    transferPp: { amount: '0', currencyCode: 'IRR' },
  };
  request.workflow.supplierFormSettings = settings;
});
it('prefills the supplier proposal and makes no request until explicit purchase registration, allowing price correction first', async () => {
  let tree = render();
  const editor = tree.find((node) => node.type === HotelRoomQuotationEditor)!;
  const draft = editor.props.draft as ReturnType<typeof defaultVoucherSettings>;
  expect(draft.hotelRoomPrices!.rooms[0]!.baseAmount).toBe('90');
  expect(fetch).not.toHaveBeenCalled();
  (editor.props.update as (next: typeof draft) => void)({
    ...draft,
    hotelRoomPrices: {
      currencyCode: 'EUR',
      rooms: [{ roomOrdinal: 1, baseAmount: '100', factor: '2' }],
    },
  });
  tree = render();
  expect(fetch).not.toHaveBeenCalled();
  const save = tree.find(
    (node) =>
      node.type === Button &&
      node.props.children === 'ثبت خرید این هتل و ترانسفر',
  )!;
  (save.props.onClick as () => void)();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  const [, options] = vi.mocked(fetch).mock.calls[0]!;
  const body = JSON.parse(String(options!.body));
  expect(body).toMatchObject({
    hotelStayKey: 'h',
    supplierFormVersion: 8,
    hotelTransferCounts: { outbound: 0, returning: 0 },
  });
  expect(body.purchases[0]).toMatchObject({
    amount: '600',
    currencyCode: 'EUR',
  });
  expect(body.purchases[1]).toMatchObject({ amount: '0', currencyCode: 'IRR' });
  expect(
    request.workflow.supplierFormSettings!.hotelRoomPrices!.rooms[0]!
      .baseAmount,
  ).toBe('90');
});

it('fills contract transfer counts despite an old zero supplier draft and preserves subsequent manual edits', () => {
  const input = structuredClone(request);
  input.snapshot.passengerIds = ['a', 'b'];
  input.snapshot.serviceSelections = [
    ...input.snapshot.serviceSelections,
    {
      clientKey: 'out',
      kind: 'TRANSFER',
      titleSnapshot: 'Out',
      metadata: { direction: 'OUTBOUND' },
    },
    {
      clientKey: 'back',
      kind: 'TRANSFER',
      titleSnapshot: 'Return',
      metadata: { direction: 'RETURN' },
    },
  ];
  input.snapshot.passengerAssignments = [
    { customerId: 'a', ageCategory: 'ADT', serviceClientKeys: ['out', 'back'] },
    { customerId: 'b', ageCategory: 'CHD', serviceClientKeys: ['out'] },
  ];
  let editor = render(input).find(
    (node) => node.type === HotelRoomQuotationEditor,
  )!;
  const draft = editor.props.draft as ReturnType<typeof defaultVoucherSettings>;
  expect(draft.hotelTransferCounts).toEqual({ outbound: 2, returning: 1 });
  expect(fetch).not.toHaveBeenCalled();
  (editor.props.update as (next: typeof draft) => void)({
    ...draft,
    hotelTransferCounts: { outbound: 1, returning: 0 },
  });
  editor = render(input).find(
    (node) => node.type === HotelRoomQuotationEditor,
  )!;
  expect((editor.props.draft as typeof draft).hotelTransferCounts).toEqual({
    outbound: 1,
    returning: 0,
  });
  expect(input.workflow.supplierFormSettings!.hotelTransferCounts).toEqual({
    outbound: 0,
    returning: 0,
  });
});

it('preserves a previously registered explicit zero transfer quantity', () => {
  const input = structuredClone(request);
  input.snapshot.serviceSelections = [
    ...input.snapshot.serviceSelections,
    {
      clientKey: 'out',
      kind: 'TRANSFER',
      titleSnapshot: 'Out',
      metadata: { direction: 'OUTBOUND', passengerCount: 4 },
    },
  ];
  input.servicePurchases = [
    {
      serviceClientKey: 'out',
      serviceKind: 'TRANSFER',
      supplierOrganizationId: 'broker',
      supplierName: 'BROKER',
      amount: '0',
      currencyCode: 'EUR',
      finance: { status: 'PENDING' },
      hotelTransferCounts: { outbound: 0, returning: 0 },
    },
  ] as never;
  const editor = render(input).find(
    (node) => node.type === HotelRoomQuotationEditor,
  )!;
  expect(
    (editor.props.draft as ReturnType<typeof defaultVoucherSettings>)
      .hotelTransferCounts,
  ).toEqual({ outbound: 0, returning: 0 });
});

it('routes canonical rooms to hotel purchases and keeps roomless historical purchase editing compatible', () => {
  expect(ReservationHotelPurchase({ request, onSaved: h.saved }).type).toBe(
    HotelStayPurchases,
  );
  const legacy = {
    ...request,
    snapshot: {
      ...request.snapshot,
      hotelSelection: { ...request.snapshot.hotelSelection!, rooms: [] },
    },
    workflow: { ...request.workflow, supplierFormSettings: undefined },
  } as unknown as ReservationFormIntake;
  expect(
    ReservationHotelPurchase({ request: legacy, onSaved: h.saved }).type,
  ).toBe(LegacyReservationHotelPurchase);
});
