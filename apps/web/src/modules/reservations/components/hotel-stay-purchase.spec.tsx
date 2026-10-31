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
  request: vi.fn(),
}));
vi.mock('./travel-workflow-form', () => ({ travelRequest: h.request }));
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
  h.request.mockReset();
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

it('submits distinct transfer brokers and prices per direction in the same atomic hotel batch', async () => {
  let tree = render();
  const editor = tree.find((node) => node.type === HotelRoomQuotationEditor)!;
  const draft = editor.props.draft as ReturnType<typeof defaultVoucherSettings>;
  (editor.props.update as (next: typeof draft) => void)({
    ...draft,
    hotelTransferSeparate: true,
    hotelTransferSplit: true,
    transferBrokerId: '22222222-2222-4222-8222-222222222222',
    transferBrokerName: 'OUT',
    hotelTransferCounts: { outbound: 2, returning: 1 },
    supplierFormPrices: { transferPp: { amount: '10', currencyCode: 'IRR' } },
    hotelTransferReturn: {
      amount: '20',
      currencyCode: 'IRR',
      brokerId: '33333333-3333-4333-8333-333333333333',
      brokerName: 'BACK',
    },
  });
  tree = render();
  const save = tree.find(
    (node) =>
      node.type === Button &&
      node.props.children === 'ثبت خرید این هتل و ترانسفر',
  )!;
  await (save.props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  const [, options] = vi.mocked(fetch).mock.calls[0]!;
  const body = JSON.parse(String(options!.body));
  expect(body.purchases).toHaveLength(3);
  expect(body.purchases[1]).toMatchObject({
    amount: '20',
    supplierOrganizationId: '22222222-2222-4222-8222-222222222222',
    pricingCalculation: { chargeablePassengerCount: 2 },
  });
  expect(body.purchases[2]).toMatchObject({
    amount: '20',
    supplierOrganizationId: '33333333-3333-4333-8333-333333333333',
    pricingCalculation: { chargeablePassengerCount: 1 },
  });
  expect(
    new Set(
      body.purchases.flatMap(
        (row: { coveredServiceClientKeys: string[] }) =>
          row.coveredServiceClientKeys,
      ),
    ).size,
  ).toBe(3);
});

it('exposes both transfer checkboxes and enables independent return quotation without changing counts', () => {
  const settings = defaultVoucherSettings(request, {});
  settings.hotelTransferCounts = { outbound: 2, returning: 1 };
  settings.supplierFormPrices = {
    transferPp: { amount: '10', currencyCode: 'IRR' },
  };
  const update = vi.fn();
  const controls = nodes(
    HotelRoomQuotationEditor({
      draft: settings,
      requestId: request.id,
      update,
      currencies: [{ code: 'IRR', name: 'IRR' }],
      busy: false,
      nights: 3,
    }),
  );
  const label = controls.find(
    (node) =>
      node.type === 'label' &&
      Array.isArray(node.props.children) &&
      node.props.children.some(
        (child) =>
          typeof child === 'string' &&
          child.trim() === 'کارگزار رفت و برگشت جدا',
      ),
  )!;
  const input = nodes(label).find((node) => node.type === 'input')!;
  (input.props.onChange as (event: { target: { checked: boolean } }) => void)({
    target: { checked: true },
  });
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({
      hotelTransferSeparate: true,
      hotelTransferSplit: true,
      hotelTransferCounts: { outbound: 2, returning: 1 },
      hotelTransferReturn: { amount: '10', currencyCode: 'IRR' },
    }),
  );
  const next = update.mock.calls[0]![0];
  expect(
    nodes(
      HotelRoomQuotationEditor({
        draft: next,
        requestId: request.id,
        update,
        currencies: [],
        busy: false,
        nights: 3,
      }),
    ).some((node) => node.props.label === 'کارگزار ترانسفر برگشت'),
  ).toBe(true);
});

it('reloads the latest saved stay quote instead of stale page or sent prices, then purchases against that revision', async () => {
  let tree = render();
  const latest = structuredClone(request);
  const settings = structuredClone(latest.workflow.supplierFormSettings!);
  settings.hotelRoomPrices!.rooms[0]!.baseAmount = '150.25';
  settings.hotelRoomPrices!.rooms[0]!.factor = '2';
  settings.text.checkOut = '2026-11-06';
  latest.workflow.version = 12;
  latest.workflow.hotelSupplierForms = { h: { settings, status: 'NEW' } };
  // Older aggregate and sent forms must not win over this stay's latest draft.
  latest.workflow.sentSupplierFormSettings =
    request.workflow.supplierFormSettings!;
  h.request.mockResolvedValue({ data: latest });
  const load = tree.find(
    (n) =>
      n.type === Button && n.props.children === 'بارگذاری قیمت پیشنهادی فرم',
  )!;
  (load.props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(h.request).toHaveBeenCalledWith(
      'reservations/requests/test/workflow',
    ),
  );
  tree = render();
  const editor = tree.find((n) => n.type === HotelRoomQuotationEditor)!;
  expect(
    (editor.props.draft as typeof settings).hotelRoomPrices!.rooms[0]!
      .baseAmount,
  ).toBe('150.25');
  expect(fetch).not.toHaveBeenCalled();
  const save = tree.find(
    (n) =>
      n.type === Button && n.props.children === 'ثبت خرید این هتل و ترانسفر',
  )!;
  (save.props.onClick as () => void)();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]![1]!.body));
  expect(body.supplierFormVersion).toBe(12);
  expect(body.purchases[0].amount).toBe('1502.5');
});

it.each(['missing', 'network'])(
  'retains purchase draft if saved quote loading fails: %s',
  async (failure) => {
    let tree = render();
    const editor = tree.find((n) => n.type === HotelRoomQuotationEditor)!;
    const changed = structuredClone(
      editor.props.draft as ReturnType<typeof defaultVoucherSettings>,
    );
    changed.hotelRoomPrices!.rooms[0]!.baseAmount = '222';
    (editor.props.update as (value: typeof changed) => void)(changed);
    if (failure === 'network')
      h.request.mockRejectedValue(new Error('offline'));
    else {
      const empty = structuredClone(request);
      delete empty.workflow.supplierFormSettings;
      h.request.mockResolvedValue({ data: empty });
    }
    tree = render();
    const load = tree.find(
      (n) =>
        n.type === Button && n.props.children === 'بارگذاری قیمت پیشنهادی فرم',
    )!;
    (load.props.onClick as () => void)();
    await vi.waitFor(() => expect(h.request).toHaveBeenCalledTimes(1));
    tree = render();
    expect(
      (
        tree.find((n) => n.type === HotelRoomQuotationEditor)!.props
          .draft as typeof changed
      ).hotelRoomPrices!.rooms[0]!.baseAmount,
    ).toBe('222');
    expect(
      tree.some(
        (n) =>
          n.props.role === 'status' &&
          n.props.children ===
            (failure === 'network'
              ? 'offline'
              : 'برای این اقامت، قیمت فرم رزرواسیون ذخیره نشده است.'),
      ),
    ).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  },
);
