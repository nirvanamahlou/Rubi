import { ReservationCurrencySelect } from './reservation-currencies';
import type { ReservationPurchaseBatchInputV1 } from '@nora/contracts';
import { ReservationPurchaseBrokerLookup } from './reservation-purchase-broker-lookup';
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
import { MoneyInput } from '@/components/ui/money-input';
import { defaultVoucherSettings } from '../model/voucher-settings';
import type { ReservationFormIntake } from '../model/reservation-form';

it('defaults new room ratios to two and persists editable overrides without resetting saved ratios', () => {
  const draft = defaultVoucherSettings(request, {});
  delete draft.hotelRoomPrices;
  const update = vi.fn();
  const props = {
    draft,
    requestId: 'test',
    update,
    currencies: [],
    busy: false,
    nights: 3,
  };
  const tree = nodes(HotelRoomQuotationEditor(props));
  const ratio = tree.find(
    (node) =>
      node.type === MoneyInput && node.props['aria-label'] === 'Ratio اتاق 1',
  )!;
  expect(ratio.props.value).toBe('2');
  (ratio.props.onValueChange as (value: string) => void)('1.5');
  const saved = update.mock.calls.at(-1)![0];
  expect(saved.hotelRoomPrices.rooms[0].factor).toBe('1.5');
  const reopened = nodes(HotelRoomQuotationEditor({ ...props, draft: saved }));
  expect(
    reopened.find(
      (node) =>
        node.type === MoneyInput && node.props['aria-label'] === 'Ratio اتاق 1',
    )!.props.value,
  ).toBe('1.5');
});

it('clears transfer-only broker and split state when separate mode is switched off', () => {
  const draft = defaultVoucherSettings(request, {});
  Object.assign(draft, {
    hotelTransferSeparate: true,
    hotelTransferSplit: true,
    transferBrokerId: 'other',
    transferBrokerName: 'OTHER',
    hotelTransferReturn: { amount: '10', currencyCode: 'EUR' },
  });
  const update = vi.fn();
  const tree = nodes(
    HotelRoomQuotationEditor({
      draft,
      requestId: 'test',
      update,
      currencies: [],
      busy: false,
      nights: 3,
    }),
  );
  const toggle = tree.find(
    (node) => node.type === 'input' && node.props.type === 'checkbox',
  )!;
  (toggle.props.onChange as (event: unknown) => void)({
    target: { checked: false },
  });
  const next = update.mock.calls.at(-1)![0];
  expect(next.hotelTransferSeparate).toBe(false);
  expect(next.hotelTransferSplit).toBe(false);
  expect(next.transferBrokerId).toBeUndefined();
  expect(next.transferBrokerName).toBeUndefined();
  expect(next.hotelTransferReturn).toBeUndefined();
});
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
function render(
  input = request,
  purchaseRoot?: string,
  onStage?: (body: ReservationPurchaseBatchInputV1) => void,
) {
  h.index = 0;
  h.ref = 0;
  return nodes(
    HotelStayPurchase({
      request: input,
      stayKey: 'h',
      onSaved: h.saved,
      purchaseRoot,
      ...(onStage ? { onStage } : {}),
    }),
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

it('uses the hotel broker in combined mode even when an old separate broker remains in the draft', async () => {
  let tree = render();
  const editor = tree.find((node) => node.type === HotelRoomQuotationEditor)!;
  const draft = editor.props.draft as ReturnType<typeof defaultVoucherSettings>;
  (editor.props.update as (next: typeof draft) => void)({
    ...draft,
    hotelTransferSeparate: false,
    transferBrokerId: '22222222-2222-4222-8222-222222222222',
    transferBrokerName: 'OLD',
    hotelTransferCounts: { outbound: 2, returning: 1 },
    supplierFormPrices: { transferPp: { amount: '10', currencyCode: 'IRR' } },
  });
  tree = render();
  const save = tree.find(
    (node) =>
      node.type === Button &&
      node.props.children === 'ثبت خرید این هتل و ترانسفر',
  )!;
  await (save.props.onClick as () => Promise<void>)();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]![1]!.body));
  expect(body.purchases).toHaveLength(2);
  expect(body.purchases[1].supplierOrganizationId).toBe(
    body.purchases[0].supplierOrganizationId,
  );
  expect(body.purchases[1].supplierOrganizationId).not.toBe(
    draft.transferBrokerId,
  );
});

it('submits distinct transfer brokers and prices per direction in the same atomic hotel batch', async () => {
  let tree = render();
  const editor = tree.find((node) => node.type === HotelRoomQuotationEditor)!;
  const draft = editor.props.draft as ReturnType<typeof defaultVoucherSettings>;
  (editor.props.update as (next: typeof draft) => void)({
    ...draft,
    hotelTransferSeparate: true,
    hotelTransferSplit: true,
    hotelTransferRoundTrip: false,
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
      hotelTransferRoundTrip: false,
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

it('registers one combined round-trip price without doubling the passenger count', async () => {
  let tree = render();
  const editor = tree.find((n) => n.type === HotelRoomQuotationEditor)!;
  const draft = editor.props.draft as ReturnType<typeof defaultVoucherSettings>;
  (editor.props.update as (next: typeof draft) => void)({
    ...draft,
    hotelTransferRoundTrip: true,
    hotelTransferSplit: false,
    hotelTransferCounts: { outbound: 2, returning: 2 },
    supplierFormPrices: { transferPp: { amount: '20', currencyCode: 'IRR' } },
  });
  tree = render();
  await (
    tree.find(
      (n) =>
        n.type === Button && n.props.children === 'ثبت خرید این هتل و ترانسفر',
    )!.props.onClick as () => Promise<void>
  )();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]![1]!.body));
  expect(body).toMatchObject({
    hotelTransferRoundTrip: true,
    hotelTransferCounts: { outbound: 2, returning: 2 },
  });
  expect(body.purchases[1]).toMatchObject({
    amount: '40',
    pricingCalculation: { chargeablePassengerCount: 2 },
  });
});
it('round-trip checkbox uses one population input and disables split pricing', () => {
  const draft = defaultVoucherSettings(request, {});
  draft.hotelTransferCounts = { outbound: 2, returning: 1 };
  draft.hotelTransferSplit = true;
  const update = vi.fn();
  const renderEditor = () =>
    nodes(
      HotelRoomQuotationEditor({
        draft,
        requestId: 'test',
        update,
        currencies: [],
        busy: false,
        nights: 3,
      }),
    );
  const checkbox = renderEditor().filter(
    (n) => n.type === 'input' && n.props.type === 'checkbox',
  )[1]!;
  (checkbox.props.onChange as (event: unknown) => void)({
    target: { checked: false },
  });
  Object.assign(draft, update.mock.calls[0]![0]);
  expect(draft).toMatchObject({
    hotelTransferRoundTrip: true,
    hotelTransferSplit: false,
    hotelTransferCounts: { outbound: 2, returning: 2 },
  });
  expect(renderEditor().filter((n) => n.props.type === 'number')).toHaveLength(
    1,
  );
});

it.each([
  { roundTrip: true, split: false, outbound: 2, returning: 2, expected: '40' },
  { roundTrip: false, split: false, outbound: 2, returning: 2, expected: '80' },
  { roundTrip: false, split: false, outbound: 2, returning: 0, expected: '40' },
  { roundTrip: false, split: true, outbound: 2, returning: 2, expected: '40' },
  { roundTrip: true, split: false, outbound: 0, returning: 0, expected: '0' },
])(
  'displays the same chargeable transfer population as purchase registration: $roundTrip/$split/$outbound/$returning',
  ({ roundTrip, split, outbound, returning, expected }) => {
    const draft = defaultVoucherSettings(request, {});
    draft.hotelTransferRoundTrip = roundTrip;
    draft.hotelTransferSplit = split;
    draft.hotelTransferCounts = { outbound, returning };
    draft.supplierFormPrices = {
      transferPp: { amount: '20', currencyCode: 'IRR' },
    };
    const tree = nodes(
      HotelRoomQuotationEditor({
        draft,
        requestId: 'test',
        update: vi.fn(),
        currencies: [],
        busy: false,
        nights: 6,
      }),
    );
    const summary = tree.find(
      (node) =>
        node.type === 'p' &&
        JSON.stringify(node.props.children).includes(
          split ? 'جمع ترانسفر رفت:' : 'جمع ترانسفر:',
        ),
    )!;
    const amount = nodes(summary.props.children as ReactNode).find(
      (node) => node.type === 'bdi',
    )!.props.children as ReactNode[];
    expect(amount[0]).toBe(expected);
  },
);

it('uses identical room purchase arithmetic from Sales payments with contract-scoped agency and currency routes', async () => {
  const root = 'sales/contracts/contract/purchases';
  let tree = render(request, root);
  const broker = tree.find((n) => n.type === ReservationPurchaseBrokerLookup)!;
  expect(broker.props.purchaseRoot).toBe(root);
  (broker.props.onChange as (v: unknown) => void)({
    id: 'agency',
    name: 'Agency',
  });
  tree = render(request, root);
  const editor = tree.find((n) => n.type === HotelRoomQuotationEditor)!;
  expect(editor.props.purchaseRoot).toBe(root);
  await (
    tree.find(
      (n) =>
        n.type === Button && n.props.children === 'ثبت خرید این هتل و ترانسفر',
    )!.props.onClick as () => Promise<void>
  )();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  const [url, options] = vi.mocked(fetch).mock.calls[0]!;
  expect(url).toBe('https://api.test/api/v1/' + root + '/purchase-batches');
  expect(JSON.parse(String(options!.body)).purchases[0]).toMatchObject({
    amount: '540',
    supplierOrganizationId: 'agency',
  });
});

it('stages the exact calculated hotel batch without posting a purchase before contract creation', async () => {
  const staged = vi.fn();
  const tree = render(request, undefined, staged);
  const save = tree.find(
    (node) =>
      node.type === Button &&
      node.props.children === 'ثبت خرید این هتل و ترانسفر',
  )!;
  (save.props.onClick as () => void)();
  await vi.waitFor(() => expect(staged).toHaveBeenCalledTimes(1));
  expect(fetch).not.toHaveBeenCalled();
  expect(staged.mock.calls[0]![0]).toMatchObject({
    hotelStayKey: 'h',
    purchases: expect.arrayContaining([
      expect.objectContaining({ amount: '540', currencyCode: 'EUR' }),
    ]),
  });
});

it.each([undefined, 'sales/contracts/contract/purchases'])(
  'requires explicit separate mode before showing the transfer broker: %s',
  (purchaseRoot) => {
    const draft = defaultVoucherSettings(request, {});
    const update = vi.fn();
    const tree = nodes(
      HotelRoomQuotationEditor({
        draft,
        requestId: request.id,
        purchaseRoot,
        hotelBroker: { id: 'hotel-broker', name: 'HOTEL' },
        update,
        currencies: [],
        busy: false,
        nights: 6,
      }),
    );
    const copy = JSON.stringify(tree.map((n) => n.props.children));
    expect(copy).toContain('کارگزار ترانسفر جدا از هتل');
    expect(draft.hotelTransferSeparate).not.toBe(true);
    expect(tree.some((n) => n.type === ReservationPurchaseBrokerLookup)).toBe(
      false,
    );
    const toggle = tree.find(
      (n) => n.type === 'input' && n.props.type === 'checkbox',
    )!;
    (toggle.props.onChange as (event: unknown) => void)({
      target: { checked: true },
    });
    const next = update.mock.calls.at(-1)![0];
    const separateTree = nodes(
      HotelRoomQuotationEditor({
        draft: next,
        requestId: request.id,
        purchaseRoot,
        hotelBroker: { id: 'hotel-broker', name: 'HOTEL' },
        update,
        currencies: [],
        busy: false,
        nights: 6,
      }),
    );
    const lookup = separateTree.find(
      (n) => n.type === ReservationPurchaseBrokerLookup,
    )!;
    (lookup.props.onChange as (value: { id: string; name: string }) => void)({
      id: 'other',
      name: 'OTHER',
    });
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        transferBrokerId: 'other',
        hotelTransferSeparate: true,
      }),
    );
  },
);

it('does not infer separate supplier forms from existing transfer purchases with different suppliers', () => {
  const input = structuredClone(request);
  input.snapshot.serviceSelections = [
    ...input.snapshot.serviceSelections,
    {
      clientKey: 'out',
      kind: 'TRANSFER',
      titleSnapshot: 'Outbound',
      metadata: { direction: 'OUTBOUND' },
    } as never,
  ];
  input.servicePurchases = [
    {
      serviceClientKey: 'out',
      supplierOrganizationId: 'other',
      supplierName: 'OTHER',
      finance: { status: 'UNPAID' },
      amount: '20',
      currencyCode: 'IRR',
      pricingCalculation: {
        baseAmount: '10',
        factor: '2',
        chargeablePassengerCount: 2,
      },
    },
  ] as never;
  delete input.workflow.supplierFormSettings!.hotelTransferSeparate;
  const editor = render(input).find(
    (node) => node.type === HotelRoomQuotationEditor,
  )!;
  expect(
    (editor.props.draft as ReturnType<typeof defaultVoucherSettings>)
      .hotelTransferSeparate,
  ).toBe(false);
  expect(
    (editor.props.draft as ReturnType<typeof defaultVoucherSettings>)
      .hotelTransferSplit,
  ).toBe(false);
});

it('preserves an explicit combined mode saved by a legacy supplier form', () => {
  const input = structuredClone(request);
  input.workflow.supplierFormSettings!.hotelTransferSeparate = false;
  const editor = render(input).find(
    (node) => node.type === HotelRoomQuotationEditor,
  )!;
  expect(
    (editor.props.draft as ReturnType<typeof defaultVoucherSettings>)
      .hotelTransferSeparate,
  ).toBe(false);
});

it.each([null, { id: 'shared', name: 'HOTEL' }])(
  'clears split-only settings when the transfer broker returns to the hotel default: %j',
  (value) => {
    const draft = defaultVoucherSettings(request, {});
    Object.assign(draft, {
      brokerId: 'shared',
      transferBrokerId: 'other',
      hotelTransferSeparate: true,
      hotelTransferSplit: true,
      hotelTransferReturn: {
        amount: '20',
        currencyCode: 'IRR',
        brokerId: 'return',
      },
      supplierFormPrices: { transferPp: { amount: '10', currencyCode: 'IRR' } },
    });
    const before = structuredClone(draft);
    const update = vi.fn();
    const lookup = nodes(
      HotelRoomQuotationEditor({
        draft,
        requestId: request.id,
        update,
        currencies: [],
        busy: false,
        nights: 6,
        hotelBroker: { id: 'shared', name: 'HOTEL' },
      }),
    ).find((node) => node.type === ReservationPurchaseBrokerLookup)!;
    (lookup.props.onChange as (value: unknown) => void)(value);
    const next = update.mock.calls[0]![0];
    expect(next.hotelTransferSeparate).toBe(false);
    expect(next.hotelTransferSplit).toBe(false);
    expect(next.hotelTransferReturn).toBeUndefined();
    expect(next.supplierFormPrices).toEqual(before.supplierFormPrices);
    expect(draft).toEqual(before);
  },
);

it('inherits hotel currency until the transfer currency is manually selected', () => {
  let draft = defaultVoucherSettings(request, {});
  h.ref = 0;
  const renderEditor = () => {
    h.ref = 0;
    return nodes(
      HotelRoomQuotationEditor({
        draft,
        requestId: request.id,
        update: (next) => {
          draft = next;
        },
        currencies: [],
        busy: false,
        nights: 3,
      }),
    );
  };
  const changeCurrency = (label: string, value: string) => {
    const control = renderEditor().find(
      (n) => n.type === ReservationCurrencySelect && n.props.label === label,
    )!;
    (control.props.onChange as (value: string) => void)(value);
  };
  changeCurrency('ارز خرید هتل', 'EUR');
  expect(draft.supplierFormPrices?.transferPp?.currencyCode).toBe('EUR');
  changeCurrency('ارز خرید هتل', 'USD');
  expect(draft.supplierFormPrices?.transferPp?.currencyCode).toBe('USD');
  changeCurrency('ارز ترانسفر', 'IRR');
  changeCurrency('ارز خرید هتل', 'EUR');
  expect(draft.supplierFormPrices?.transferPp?.currencyCode).toBe('IRR');
  const checkbox = renderEditor().filter(
    (n) => n.type === 'input' && n.props.type === 'checkbox',
  )[1]!;
  expect(checkbox.props.checked).toBe(false);
  (checkbox.props.onChange as (event: unknown) => void)({
    target: { checked: true },
  });
  expect(draft.hotelTransferRoundTrip).toBe(false);
});
