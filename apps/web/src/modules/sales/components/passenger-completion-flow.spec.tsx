import { isValidElement, type ReactNode } from 'react';
import type * as ReactModule from 'react';
import type * as SalesClientModule from '../api/client';
import type * as CustomersEntryModule from '@/modules/customers/public/entry';
import { beforeEach, expect, it, vi } from 'vitest';
import { canonicalTestTree } from '@/i18n/test-tree';
import { PassengerCompletion } from './passenger-completion';

const h = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  effectIndex: 0,
  deps: [] as unknown[][],
  effects: [] as (() => unknown)[],
  form: vi.fn(),
  create: vi.fn(),
  complete: vi.fn(),
  lookup: vi.fn(),
  detail: vi.fn(),
  contact: vi.fn(),
  saved: vi.fn(),
  pending: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState(initial: unknown) {
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
  useRef(initial: unknown) {
    const i = h.index++;
    if (!(i in h.states)) h.states[i] = { current: initial };
    return h.states[i];
  },
  useEffect(effect: () => unknown, deps: unknown[]) {
    const i = h.effectIndex++,
      before = h.deps[i];
    if (!before || deps.some((v, j) => v !== before[j])) {
      h.effects.push(effect);
      h.deps[i] = deps;
    }
  },
}));
vi.mock('../api/client', async (original) => ({
  ...(await original<typeof SalesClientModule>()),
  salesApi: {
    passengerCompletionForm: h.form,
    createCompletionPerson: h.create,
    completePassengers: h.complete,
  },
}));
vi.mock('@/modules/customers/public/entry', async (original) => ({
  ...(await original<typeof CustomersEntryModule>()),
  salesPeopleApi: {
    registrationLookup: h.lookup,
    detail: h.detail,
    addContact: h.contact,
  },
}));
function nodes(node: ReactNode): Record<string, unknown>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node.props, ...nodes(node.props.children as ReactNode)];
}
function render() {
  h.index = 0;
  h.effectIndex = 0;
  const result = nodes(
    canonicalTestTree(
      PassengerCompletion({
        contractId: 'contract',
        onSaved: h.saved,
        onPending: h.pending,
      }),
    ),
  );
  h.effects.splice(0).forEach((run) => run());
  return result;
}
const button = (label: string) => render().find((p) => p.children === label)!;
type Entry = {
  values: Record<string, string>;
  onChange: (field: string, value: string) => void;
};
function entries() {
  return render().find((p) => p.optionalFields)?.rows as Entry[];
}
function edit(index: number, field: string, value: string) {
  entries()[index]!.onChange(field, value);
}
async function open() {
  render();
  await vi.waitFor(() => expect(button('افزودن مسافر').disabled).toBe(false));
  (button('افزودن مسافر').onClick as () => void)();
  for (let i = 0; i < 2; i++) {
    for (const field of [
      'nationalityCode',
      'passportIssuingCountryCode',
      'birthCountryCode',
    ])
      edit(i, field, '');
    edit(i, 'passportFirstName', i ? 'Second' : 'First');
    edit(i, 'passportLastName', 'Traveler');
  }
}
const save = () =>
  (button('ثبت مسافران و به‌روزرسانی رزرواسیون').onClick as () => void)();
beforeEach(() => {
  h.states = [];
  h.index = 0;
  h.effectIndex = 0;
  h.deps = [];
  h.effects = [];
  for (const mock of [
    h.form,
    h.create,
    h.complete,
    h.lookup,
    h.detail,
    h.contact,
    h.saved,
    h.pending,
  ])
    mock.mockReset();
  h.form.mockResolvedValue({
    version: 3,
    available: true,
    departureDate: '2027-01-01',
    hotel: null,
    services: ['out', 'back'].map((key) => ({
      key,
      title: key,
      kind: 'FLIGHT',
      direction: key === 'out' ? 'OUTBOUND' : 'RETURN',
      party: { adults: 1, children: 1, infants: 0 },
    })),
  });
  h.create.mockImplementation(async (_id, input) => ({
    data: {
      ...input,
      id: `person-${h.create.mock.calls.length}`,
      version: 1,
      contacts: [],
      birthDate: null,
    },
  }));
  h.complete.mockResolvedValue({ version: 4 });
  h.detail.mockRejectedValue(Error('optional contact detail unavailable'));
});
it('registers adult and child names with every optional field empty and refreshes the contract', async () => {
  await open();
  save();
  await vi.waitFor(() => expect(h.complete).toHaveBeenCalledOnce());
  expect(h.create).toHaveBeenCalledTimes(2);
  for (const [, input] of h.create.mock.calls) {
    for (const field of [
      'nationalId',
      'birthDate',
      'passportNumber',
      'passportExpiryDate',
      'gender',
      'nationalityCode',
      'passportIssuingCountryCode',
      'birthCountryCode',
    ])
      expect(input).not.toHaveProperty(field);
  }
  expect(h.lookup).not.toHaveBeenCalled();
  expect(h.detail).not.toHaveBeenCalled();
  expect(h.contact).not.toHaveBeenCalled();
  expect(h.complete).toHaveBeenCalledWith(
    'contract',
    expect.objectContaining({
      expectedVersion: 3,
      passengers: [
        {
          customerId: 'person-1',
          ageCategory: 'ADT',
          serviceClientKeys: ['out', 'back'],
        },
        {
          customerId: 'person-2',
          ageCategory: 'CHD',
          serviceClientKeys: ['out', 'back'],
        },
      ],
    }),
  );
  expect(h.saved).toHaveBeenCalledOnce();
  expect(h.pending).toHaveBeenLastCalledWith(false);
});
it.each([
  ['nationalId', '123'],
  ['birthDate', '1990-01-01'],
  ['passportNumber', '!'],
  ['passportExpiryDate', 'invalid'],
  ['gender', 'invalid'],
  ['nationalityCode', 'invalid'],
  ['phone', '123'],
  ['email', 'invalid'],
])(
  'shows invalid supplied optional %s beside Save before creating anyone',
  async (field, value) => {
    await open();
    edit(field === 'birthDate' ? 1 : 0, field!, value!);
    save();
    await vi.waitFor(() => expect(h.pending).toHaveBeenLastCalledWith(false));
    const controls = render();
    const alert = controls.findIndex((p) => p.role === 'alert');
    const submit = controls.findIndex(
      (p) => p.children === 'ثبت مسافران و به‌روزرسانی رزرواسیون',
    );
    expect(alert).toBeGreaterThan(controls.findIndex((p) => p.optionalFields));
    expect(alert).toBeLessThan(submit);
    expect(controls[alert]?.children).toBeTruthy();
    expect(h.create).not.toHaveBeenCalled();
    expect(h.complete).not.toHaveBeenCalled();
  },
);
it('retains a newly created identity for retry when a supplied contact cannot be saved', async () => {
  await open();
  edit(0, 'phone', '+989001234567');
  save();
  await vi.waitFor(() =>
    expect(render().find((p) => p.role === 'alert')?.children).toBe(
      'optional contact detail unavailable',
    ),
  );
  expect(h.create).toHaveBeenCalledTimes(1);
  expect(h.complete).not.toHaveBeenCalled();
  h.detail.mockResolvedValue({
    data: { id: 'person-1', version: 1, contacts: [] },
  });
  h.contact.mockResolvedValue({
    data: { id: 'person-1', version: 2, contacts: [] },
  });
  save();
  await vi.waitFor(() => expect(h.complete).toHaveBeenCalledOnce());
  expect(h.create).toHaveBeenCalledTimes(2);
  expect(h.contact).toHaveBeenCalledWith(
    'person-1',
    expect.objectContaining({ type: 'phone', value: '+989001234567' }),
  );
  expect(h.saved).toHaveBeenCalledOnce();
});
it('retries an uncertain completion with the same operation without recreating passengers', async () => {
  h.complete.mockRejectedValueOnce(Error('connection lost'));
  await open();
  save();
  await vi.waitFor(() =>
    expect(button('بررسی و ارسال دوباره همان ثبت')).toBeDefined(),
  );
  const first = h.complete.mock.calls[0]![1];
  expect(h.saved).not.toHaveBeenCalled();
  (button('بررسی و ارسال دوباره همان ثبت').onClick as () => void)();
  await vi.waitFor(() => expect(h.saved).toHaveBeenCalledOnce());
  expect(h.complete).toHaveBeenCalledTimes(2);
  expect(h.complete.mock.calls[1]![1]).toEqual(first);
  expect(h.create).toHaveBeenCalledTimes(2);
});
