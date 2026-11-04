vi.mock('../api/payment-receipts', () => ({
  paymentReceiptsApi: { entries: vi.fn(async () => ({ data: [] })) },
}));
import { beforeEach, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import type * as ReactModule from 'react';
import { canonicalTestTree } from '@/i18n/test-tree';
import {
  ContractPayments,
  ContractPaymentAccountSelect,
  ContractPaymentCurrencySelect,
} from './contract-payments';
import { Dialog } from '@/components/ui/overlays';
import { MoneyInput } from '@/components/ui/money-input';
import { SalesDatePicker } from './sales-date-picker';
import { printFixture } from '../model/contract-print.fixture';

const h = vi.hoisted(() => ({
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  effects: [] as (() => unknown)[],
  si: 0,
  ri: 0,
  detail: vi.fn(),
  accounts: vi.fn(),
  add: vi.fn(),
  currencies: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const i = h.si++;
    if (!(i in h.states))
      h.states[i] = typeof initial === 'function' ? initial() : initial;
    return [
      h.states[i],
      (value: unknown) => {
        h.states[i] = typeof value === 'function' ? value(h.states[i]) : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const i = h.ri++;
    return (h.refs[i] ??= { current: initial });
  },
  useEffect: (effect: () => unknown) => {
    h.effects.push(effect);
  },
}));
vi.mock('@/modules/iam/access-context', () => ({ useAccessActor: () => null }));
vi.mock('../api/client', () => ({
  salesApi: {
    detail: h.detail,
    listReferences: async () => ({ data: [] }),
    paymentAccounts: h.accounts,
    addPayment: h.add,
  },
}));
vi.mock('../api/payment-currencies', () => ({
  loadPaymentCurrencies: h.currencies,
}));
function render() {
  h.si = 0;
  h.ri = 0;
  h.effects = [];
  return ContractPayments({
    id: 'contract',
    onClose: vi.fn(),
    onSaved: vi.fn(),
    onSearchContracts: vi.fn(),
  });
}
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  tree = canonicalTestTree(tree);
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as ReactElement<Record<string, unknown>>;
  return [node, ...nodes(node.props.children as ReactNode)];
}
async function effects() {
  h.effects.forEach((effect) => effect());
  for (let i = 0; i < 6; i++) await Promise.resolve();
}
function change(type: unknown, value: string, prop = 'onChange') {
  const node = nodes(render()).find((node) => node.type === type)!;
  (node.props[prop] as (value: string) => void)(value);
}
beforeEach(() => {
  h.states = [];
  h.refs = [];
  vi.clearAllMocks();
  h.detail.mockResolvedValue({
    data: { ...printFixture.contract, payments: [] },
  });
  h.accounts.mockResolvedValue({
    data: [
      {
        id: 'account',
        title: 'Company',
        currencyCode: 'IRR',
        kind: 'BANK',
        maskedIdentifier: null,
      },
    ],
  });
  h.currencies.mockResolvedValue([
    { code: 'IRR', name: 'ریال', status: 'active' },
    { code: 'USD', name: 'دلار', status: 'active' },
  ]);
  h.add.mockResolvedValue({
    data: {
      ...printFixture.contract,
      payments: [
        {
          id: 'payment',
          destinationAccountId: 'account',
          destinationAccountTitle: 'Company',
        },
      ],
    },
  });
});
it('saves the selected account with the payment and keeps receipt continuation available', async () => {
  render();
  await effects();
  const dialogs = nodes(render()).filter((node) => node.type === Dialog);
  (dialogs[1]!.props.onOpenChange as (open: boolean) => void)(true);
  render();
  await effects();
  change(MoneyInput, '100', 'onValueChange');
  change(SalesDatePicker, '2026-10-27');
  change(ContractPaymentAccountSelect, 'account');
  const form = nodes(render())
    .filter((node) => node.type === 'form')
    .at(-1)!;
  await (
    form.props.onSubmit as (event: {
      preventDefault: () => void;
    }) => Promise<void>
  )({ preventDefault: vi.fn() });
  expect(h.add).toHaveBeenCalledWith(
    'contract',
    expect.objectContaining({
      destinationAccountId: 'account',
      currencyCode: 'IRR',
      amount: '100',
    }),
    expect.any(String),
  );
  expect(
    nodes(render()).some((node) => node.props.paymentId === 'payment'),
  ).toBe(true);
});
it('clears a selected account after currency changes and blocks submitting without a compatible destination', async () => {
  render();
  await effects();
  const dialogs = nodes(render()).filter((node) => node.type === Dialog);
  (dialogs[1]!.props.onOpenChange as (open: boolean) => void)(true);
  render();
  await effects();
  change(ContractPaymentAccountSelect, 'account');
  change(ContractPaymentCurrencySelect, 'USD');
  expect(
    nodes(render()).find((node) => node.type === ContractPaymentAccountSelect)!
      .props.value,
  ).toBe('');
  const form = nodes(render())
    .filter((node) => node.type === 'form')
    .at(-1)!;
  await (
    form.props.onSubmit as (event: {
      preventDefault: () => void;
    }) => Promise<void>
  )({ preventDefault: vi.fn() });
  expect(h.add).not.toHaveBeenCalled();
});
