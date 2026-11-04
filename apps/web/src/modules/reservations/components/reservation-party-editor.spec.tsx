import { beforeEach, expect, it, vi } from 'vitest';
import { isValidElement, type ReactNode, type ReactElement } from 'react';
import type * as ReactModule from 'react';
import type { CustomerSummary, SalesContractDetail } from '@nora/contracts';
import { canonicalTestTree } from '@/i18n/test-tree';
import { ReservationPartyEditor } from './reservation-party-editor';
import { SalesOrganizationCustomer } from '@/modules/sales/components/sales-organization-customer';
import { SalesPersonCreate } from '@/modules/sales/components/sales-person-create';
import { SalesPersonSearch } from '@/modules/sales/components/sales-person-search';
const h = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  index: 0,
  ref: 0,
  effect: false,
  detail: vi.fn(),
  save: vi.fn(),
  saved: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState(initial: unknown) {
    const i = h.index++;
    if (!(i in h.states))
      h.states[i] = typeof initial === 'function' ? initial() : initial;
    return [
      h.states[i],
      (v: unknown) => {
        h.states[i] = typeof v === 'function' ? v(h.states[i]) : v;
      },
    ];
  },
  useRef(initial: unknown) {
    const i = h.ref++;
    return (h.refs[i] ??= { current: initial });
  },
  useEffect(fn: () => unknown) {
    if (!h.effect) {
      h.effect = true;
      fn();
    }
  },
}));
vi.mock('@/modules/customers/api/client', () => ({
  salesPeopleApi: { detail: h.detail },
}));
vi.mock('@/modules/sales/api/client', () => ({
  salesApi: { correctParty: h.save },
}));
const contact = {
  name: 'Synthetic Person',
  phone: '09120000000',
  address: 'Synthetic Address',
  postalCode: '',
};
const contract = {
  id: 'contract',
  version: 3,
  customerId: 'person',
  customerNameSnapshot: contact.name,
  buyerContact: contact,
} as SalesContractDetail;
const person = {
  id: 'person',
  kind: 'person',
  displayName: 'Synthetic Person',
} as CustomerSummary;
const agency = {
  id: 'agency-customer',
  kind: 'organization',
  organizationId: 'organization',
  displayName: 'Synthetic Agency',
} as CustomerSummary;
function render() {
  h.index = 0;
  h.ref = 0;
  return ReservationPartyEditor({ contract, onSaved: h.saved });
}
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  tree = canonicalTestTree(tree);
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(tree)) return [];
  return [tree, ...nodes(tree.props.children as ReactNode)];
}
function radio(kind: 'person' | 'organization') {
  const options = nodes(render()).filter(
    (n) => n.props.name === 'contract-party-kind',
  );
  (options[kind === 'person' ? 0 : 1]!.props.onChange as () => void)();
}
function field(label: string, value: string) {
  const node = nodes(render()).find((n) => n.props['aria-label'] === label)!;
  (node.props.onChange as (e: unknown) => void)({ target: { value } });
}
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}
async function submit() {
  const form = render();
  (form.props.onSubmit as (e: unknown) => void)({ preventDefault: vi.fn() });
  await flush();
}
beforeEach(async () => {
  h.states = [];
  h.refs = [];
  h.index = 0;
  h.ref = 0;
  h.effect = false;
  h.detail.mockReset().mockResolvedValue({ data: person });
  h.save.mockReset().mockResolvedValue({ data: { version: 4 } });
  h.saved.mockReset();
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  render();
  await flush();
});
it('restores the original person and edited contact after switching to agency and back', async () => {
  field('آدرس مشتری', 'Edited Address');
  radio('organization');
  radio('person');
  await submit();
  expect(h.save).toHaveBeenCalledWith(
    'contract',
    expect.objectContaining({
      customerId: 'person',
      buyerContact: { ...contact, address: 'Edited Address' },
    }),
  );
  expect(h.saved).toHaveBeenCalledOnce();
});
it('keeps a selected agency through person/agency toggles and submits its canonical ID', async () => {
  radio('organization');
  const chooser = nodes(render()).find(
    (n) => n.type === SalesOrganizationCustomer,
  )!;
  (chooser.props.onSelected as (p: CustomerSummary) => void)(agency);
  radio('person');
  radio('organization');
  await submit();
  expect(h.save).toHaveBeenCalledWith(
    'contract',
    expect.objectContaining({
      customerId: agency.id,
      buyerContact: null,
      transferFinancialHistory: true,
    }),
  );
});
it('does not silently disable saving a typed label without a selected customer', async () => {
  h.states = [];
  h.refs = [];
  h.effect = false;
  h.detail.mockResolvedValue({ data: agency });
  render();
  await flush();
  radio('person');
  field('نام مشتری', 'Typed Customer');
  const search = nodes(render()).find((n) => n.type === SalesPersonSearch)!;
  expect(search.props.query).toBe('Typed Customer');
  await submit();
  expect(h.save).not.toHaveBeenCalled();
  expect(nodes(render()).some((n) => n.props.role === 'alert')).toBe(true);
});
it('offers inline search and canonical creation, and keeps entered contact after creation', async () => {
  radio('organization');
  radio('person');
  const button = nodes(render()).find(
    (n) => n.props.children === 'افزودن مشتری جدید',
  )!;
  (button.props.onClick as () => void)();
  field('آدرس مشتری', 'New Address');
  const create = nodes(render()).find((n) => n.type === SalesPersonCreate)!;
  (create.props.onCreated as (p: CustomerSummary) => void)({
    ...person,
    id: 'new-person',
  });
  await submit();
  expect(h.save).toHaveBeenCalledWith(
    'contract',
    expect.objectContaining({
      customerId: 'new-person',
      buyerContact: { ...contact, address: 'New Address' },
    }),
  );
  expect(
    nodes(render()).find((n) => n.props['aria-label'] === 'کد پستی مشتری')!
      .props.required,
  ).toBe(false);
});
it('clears a pending agency identity when its selection changes', async () => {
  radio('organization');
  let chooser = nodes(render()).find(
    (n) => n.type === SalesOrganizationCustomer,
  )!;
  (chooser.props.onSelected as (p: CustomerSummary) => void)(agency);
  chooser = nodes(render()).find((n) => n.type === SalesOrganizationCustomer)!;
  (chooser.props.onClear as () => void)();
  await submit();
  expect(h.save).not.toHaveBeenCalled();
});
it('shows request failures and does not report an unsuccessful save as successful', async () => {
  h.save.mockRejectedValue(new Error('Synthetic conflict'));
  await submit();
  expect(h.saved).not.toHaveBeenCalled();
  expect(
    nodes(render()).some((n) => n.props.children === 'Synthetic conflict'),
  ).toBe(true);
});
it('saves an agency-to-person change after inline selection without losing the typed contact', async () => {
  h.states = [];
  h.refs = [];
  h.effect = false;
  h.detail.mockResolvedValue({ data: agency });
  render();
  await flush();
  radio('person');
  field('نام مشتری', 'Typed Customer');
  field('شماره مشتری', '09120000000');
  field('آدرس مشتری', 'Entered Address');
  const search = nodes(render()).find((n) => n.type === SalesPersonSearch)!;
  (search.props.onSelect as (p: CustomerSummary) => void)({
    ...person,
    id: 'selected-person',
  });
  await submit();
  expect(h.save).toHaveBeenCalledWith(
    'contract',
    expect.objectContaining({
      customerId: 'selected-person',
      buyerContact: { ...contact, address: 'Entered Address' },
    }),
  );
});
