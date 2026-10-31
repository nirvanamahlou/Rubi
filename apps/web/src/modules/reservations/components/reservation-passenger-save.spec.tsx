import { isValidElement, type ReactNode } from 'react';
import type * as ReactModule from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { SalesContractDetail } from '@nora/contracts';
import { canonicalTestTree } from '@/i18n/test-tree';
import { ReservationSalesAmendment } from './reservation-sales-amendment';
import { ReservationPassengers } from '../passenger-files/passengers';
import type { PassengerName } from '../passenger-files/client';

const h = vi.hoisted(() => ({
  scope: 'parent',
  index: 0,
  effectIndex: 0,
  states: {} as Record<string, unknown[]>,
  deps: {} as Record<string, unknown[][]>,
  effects: [] as (() => unknown)[],
  request: vi.fn(),
  amend: vi.fn(),
  saved: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState(initial: unknown) {
    const states = (h.states[h.scope] ??= []),
      i = h.index++;
    if (!(i in states))
      states[i] = typeof initial === 'function' ? initial() : initial;
    return [
      states[i],
      (next: unknown) => {
        states[i] = typeof next === 'function' ? next(states[i]) : next;
      },
    ];
  },
  useRef(initial: unknown) {
    const states = (h.states[h.scope] ??= []),
      i = h.index++;
    if (!(i in states)) states[i] = { current: initial };
    return states[i];
  },
  useEffect(effect: () => unknown, deps: unknown[]) {
    const all = (h.deps[h.scope] ??= []),
      i = h.effectIndex++,
      old = all[i];
    if (!old || deps.some((value, j) => value !== old[j])) {
      all[i] = deps;
      h.effects.push(effect);
    }
  },
  useImperativeHandle(
    ref: { current: unknown } | undefined,
    factory: () => unknown,
  ) {
    if (ref) ref.current = factory();
  },
}));
vi.mock('../passenger-files/client', () => ({
  passengerFilesRequest: h.request,
}));
vi.mock('@/modules/sales/api/client', () => ({ salesApi: { amend: h.amend } }));
vi.mock('@/modules/master-data/api/client', () => ({
  masterDataApi: {
    list: vi.fn(async () => ({ data: [], meta: { total: 0 } })),
  },
}));
const contract = {
  id: 'synthetic-contract',
  version: 2,
  customerId: 'buyer',
  payerCustomerId: 'buyer',
  assignedUserId: null,
  tripType: 'ONE_WAY',
  originId: 'a',
  destinationId: 'b',
  departureDate: '2099-01-01',
  returnNotBefore: null,
  servicesDetail: [
    {
      clientKey: 'flight',
      kind: 'FLIGHT',
      titleSnapshot: 'Synthetic flight',
      metadata: { automaticFlightRoomTotalV1: true },
    },
  ],
  passengersDetail: [
    {
      customerId: 'p1',
      displayNameSnapshot: 'First Traveler',
      birthDate: '',
      ageCategory: 'ADT',
      serviceClientKeys: ['flight'],
    },
    {
      customerId: 'p2',
      displayNameSnapshot: 'Second Traveler',
      birthDate: '',
      ageCategory: 'ADT',
      serviceClientKeys: ['flight'],
    },
  ],
  ticketSelections: [],
  hotelSelection: null,
  priceComponents: [
    { type: 'BASE', title: 'Saved total', amount: '100', currencyCode: 'USD' },
  ],
  paymentTerms: null,
  pricingNotes: null,
  fxSnapshot: null,
} as unknown as SalesContractDetail;
const person = (id: string): PassengerName => ({
  id,
  version: 3,
  firstName: 'First',
  lastName: 'Traveler',
  displayName: 'First Traveler',
  ageCategory: 'ADL',
  gender: null,
  birthDate: null,
  birthDateMasked: false,
  nationalId: null,
  nationalIdMasked: false,
  passportNumber: null,
  passportNumberMasked: false,
  passportFirstName: null,
  passportLastName: null,
  passportExpiryDate: null,
  passportIssuePlace: null,
  nationalityCode: null,
  birthCountryCode: null,
});
function nodes(node: ReactNode): Record<string, unknown>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node.props, ...nodes(node.props.children as ReactNode)];
}
function scope(name: string) {
  h.scope = name;
  h.index = 0;
  h.effectIndex = 0;
}
function finish(node: ReactNode) {
  const result = nodes(canonicalTestTree(node));
  h.effects.splice(0).forEach((run) => run());
  return result;
}
function parent(section: 'CORRECTION' | 'PRICES' = 'CORRECTION') {
  scope('parent');
  return finish(
    ReservationSalesAmendment({
      contract,
      requestId: 'request',
      section,
      onSaved: h.saved,
    }),
  );
}
function rows() {
  const props = parent().find((p) => p.id === 'request' && p.saveRef)!;
  scope('rows');
  return finish(
    ReservationPassengers(
      props as unknown as Parameters<typeof ReservationPassengers>[0],
    ),
  );
}
async function ready() {
  parent();
  rows();
  await vi.waitFor(() =>
    expect(rows().some((p) => p['aria-label'] === 'جنسیت مسافر 1')).toBe(true),
  );
}
function gender(index: number, value: string) {
  (
    rows().find((p) => p['aria-label'] === `جنسیت مسافر ${index}`)!
      .onChange as (e: unknown) => void
  )({ target: { value } });
  rows();
}
function saveMain() {
  (
    parent().find((p) => p.children === 'ثبت اصلاح قرارداد')!
      .onClick as () => void
  )();
}
const writes = () =>
  h.request.mock.calls.filter((call) => call[2]?.method === 'PATCH');
beforeEach(() => {
  vi.clearAllMocks();
  h.states = {};
  h.deps = {};
  h.effects = [];
  vi.stubGlobal('window', new EventTarget());
  h.request.mockImplementation(async (_id, path, init) =>
    init?.method === 'PATCH'
      ? { data: { ...person(path.split('/')[1]), version: 4 } }
      : { data: [person('p1')], canEdit: true, canEditIdentity: true },
  );
  h.amend.mockResolvedValue({});
});
it('saves gender through the main action with blank optional identity and missing historical flight prices', async () => {
  await ready();
  gender(1, 'F');
  const reason = parent().find((p) => p.maxLength === 500)!;
  (reason.onChange as (e: unknown) => void)({
    target: { value: 'Synthetic identity correction' },
  });
  const before = structuredClone(contract);
  saveMain();
  await vi.waitFor(() => expect(h.saved).toHaveBeenCalledOnce());
  expect(writes()).toHaveLength(1);
  expect(writes()[0]!.slice(0, 2)).toEqual([
    'request',
    'passengers/p1/identity',
  ]);
  expect(JSON.parse(writes()[0]![2].body)).toMatchObject({
    gender: 'F',
    version: 3,
    birthDate: '',
    nationalId: '',
    passportNumber: '',
    passportExpiryDate: '',
  });
  expect(h.amend).not.toHaveBeenCalled();
  expect(contract).toEqual(before);
});
it('keeps save errors visible and does not report success or amend prices after an identity conflict', async () => {
  await ready();
  gender(1, 'M');
  h.request.mockRejectedValueOnce(Error('Synthetic stale passenger version'));
  saveMain();
  await vi.waitFor(() =>
    expect(
      rows().some((p) => p.children === 'Synthetic stale passenger version'),
    ).toBe(true),
  );
  expect(h.saved).not.toHaveBeenCalled();
  expect(h.amend).not.toHaveBeenCalled();
});
it('retains other unsaved rows after an individual save', async () => {
  h.request.mockResolvedValueOnce({
    data: [person('p1'), person('p2')],
    canEdit: true,
    canEditIdentity: true,
  });
  await ready();
  gender(1, 'M');
  gender(2, 'F');
  const form = rows().find((p) => p.id === 'passenger-p1')!;
  (form.onSubmit as (e: unknown) => void)({ preventDefault: vi.fn() });
  await vi.waitFor(() => expect(writes()).toHaveLength(1));
  await vi.waitFor(() =>
    expect(rows().find((p) => p['aria-label'] === 'جنسیت مسافر 2')?.value).toBe(
      'F',
    ),
  );
  saveMain();
  await vi.waitFor(() => expect(h.saved).toHaveBeenCalledOnce());
  expect(writes().map((call) => call[1])).toEqual([
    'passengers/p1/identity',
    'passengers/p2/identity',
  ]);
});
it('keeps the commercial amendment and its server validation in the price section', async () => {
  h.amend.mockRejectedValueOnce(Error('Synthetic flight price required'));
  const tree = parent('PRICES');
  (
    tree.find((p) => p.children === 'ثبت اصلاح قرارداد')!.onClick as () => void
  )();
  await vi.waitFor(() =>
    expect(parent('PRICES').some((p) => p.role === 'alert')).toBe(true),
  );
  expect(h.amend).toHaveBeenCalledOnce();
  expect(writes()).toHaveLength(0);
  expect(h.saved).not.toHaveBeenCalled();
});

it('retries only unsaved passenger identities after a partial failure', async () => {
  h.request.mockResolvedValueOnce({
    data: [person('p1'), person('p2')],
    canEdit: true,
    canEditIdentity: true,
  });
  await ready();
  gender(1, 'M');
  gender(2, 'F');
  h.request
    .mockResolvedValueOnce({ data: { ...person('p1'), version: 4 } })
    .mockRejectedValueOnce(Error('Synthetic second save failed'));
  saveMain();
  await vi.waitFor(() =>
    expect(
      rows().some((p) => p.children === 'Synthetic second save failed'),
    ).toBe(true),
  );
  expect(h.saved).not.toHaveBeenCalled();
  saveMain();
  await vi.waitFor(() => expect(h.saved).toHaveBeenCalledOnce());
  expect(writes().map((call) => call[1])).toEqual([
    'passengers/p1/identity',
    'passengers/p2/identity',
    'passengers/p2/identity',
  ]);
  expect(h.amend).not.toHaveBeenCalled();
});
it('allows a subsequent gender correction after successful save', async () => {
  await ready();
  gender(1, 'F');
  saveMain();
  await vi.waitFor(() => expect(h.saved).toHaveBeenCalledOnce());
  await vi.waitFor(() =>
    expect(rows().some((p) => p['aria-label'] === 'جنسیت مسافر 1')).toBe(true),
  );
  gender(1, 'M');
  expect(
    parent().find((p) => p.children === 'ثبت اصلاح قرارداد')!.disabled,
  ).toBe(false);
  saveMain();
  await vi.waitFor(() => expect(h.saved).toHaveBeenCalledTimes(2));
  expect(writes()).toHaveLength(2);
  expect(h.amend).not.toHaveBeenCalled();
});

it('removes the selected passenger row without requiring prices and prevents removing the final passenger', async () => {
  h.request.mockResolvedValueOnce({
    data: [person('p1'), person('p2')],
    canEdit: true,
    canEditIdentity: true,
  });
  // The parent fixture already contains both passengers, so the removed identity is
  // filtered before any pending identity save and is never deleted from Customer.
  await ready();
  const remove = rows().filter((p) => p.children === 'حذف مسافر');
  expect(remove).toHaveLength(2);
  (remove[1]!.onClick as () => void)();
  expect(rows().filter((p) => p.children === 'حذف مسافر')).toHaveLength(1);
  expect(rows().find((p) => p.children === 'حذف مسافر')?.disabled).toBe(true);
  saveMain();
  await vi.waitFor(() => expect(h.amend).toHaveBeenCalledOnce());
  const sent = h.amend.mock.calls[0]![1];
  expect(
    sent.passengers.map((p: { customerId: string }) => p.customerId),
  ).toEqual(['p1']);
  expect(sent.priceComponents).toEqual(contract.priceComponents);
  expect(sent.preserveContractPrices).toBe(true);
  expect(writes()).toHaveLength(0);
});
