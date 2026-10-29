import { isValidElement, type ReactNode } from 'react';
import type * as ReactModule from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { canonicalTestTree } from '@/i18n/test-tree';
import { ContractPayments } from './contract-payments';
import { printFixture } from '../model/contract-print.fixture';
import { DocumentsApiError } from '@/modules/documents/api/client';
const h = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  effectIndex: 0,
  deps: [] as unknown[][],
  effects: [] as (() => unknown)[],
  detail: vi.fn(),
  add: vi.fn(),
  options: vi.fn(),
  upload: vi.fn(),
  entries: vi.fn(),
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
      old = h.deps[i];
    if (!old || deps.some((v, j) => v !== old[j])) {
      h.deps[i] = deps;
      h.effects.push(effect);
    }
  },
}));
vi.mock('@/modules/iam/access-context', () => ({
  useAccessActor: () => ({
    userId: 'reader',
    branchIds: ['branch'],
    permissions: ['sales.contracts.read.branch'],
  }),
}));
vi.mock('../api/client', () => ({
  salesApi: {
    detail: h.detail,
    addPayment: h.add,
    listReferences: vi.fn(async () => ({ data: [] })),
    paymentAccounts: vi.fn(async () => ({
      data: [
        {
          id: 'account',
          title: 'Company',
          currencyCode: 'IRR',
          kind: 'BANK',
          maskedIdentifier: null,
        },
      ],
    })),
  },
}));
vi.mock('../api/payment-currencies', () => ({
  loadPaymentCurrencies: vi.fn(async () => [
    { id: 'currency', code: 'IRR', name: 'ریال', status: 'active' },
  ]),
}));
vi.mock('../api/payment-receipts', () => ({
  paymentReceiptsApi: {
    options: h.options,
    upload: h.upload,
    entries: h.entries,
  },
}));
const contract = {
  ...printFixture.contract,
  id: 'contract',
  version: 1,
  payments: [],
  balances: [
    {
      currencyCode: 'IRR',
      amount: '100',
      confirmedPaid: '0',
      pendingFinance: '0',
      remaining: '100',
    },
  ],
};
const newPayment = {
  id: 'payment',
  amount: '10',
  currencyCode: 'IRR',
  method: 'BANK_TRANSFER',
  dueAt: '2099-01-01T00:00:00.000Z',
  createdAt: '2099-01-01T00:00:00.000Z',
  status: 'PENDING_FINANCE_CONFIRMATION',
  financeConfirmedAt: null,
};
function nodes(n: ReactNode): Record<string, unknown>[] {
  if (Array.isArray(n)) return n.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(n)) return [];
  return [n.props, ...nodes(n.props.children as ReactNode)];
}
function render() {
  h.index = 0;
  h.effectIndex = 0;
  const tree = nodes(
    canonicalTestTree(
      ContractPayments({
        id: 'contract',
        onClose: vi.fn(),
        onSaved: h.saved,
        onSearchContracts: vi.fn(),
      }),
    ),
  );
  h.effects.splice(0).forEach((f) => f());
  return tree;
}
function field(label: string) {
  return render().find((p) => p.label === label)!;
}
async function ready() {
  render();
  await vi.waitFor(() => expect(h.detail).toHaveBeenCalledOnce());
  await vi.waitFor(() =>
    expect(render().some((p) => p.balances === contract.balances)).toBe(true),
  );
  const dialog = render().find((p) => p.open === false && p.onOpenChange)!;
  (dialog.onOpenChange as (v: boolean) => void)(true);
  render();
  await vi.waitFor(() =>
    expect(render().some((p) => Array.isArray(p.accounts))).toBe(true),
  );
  const account = render().find((p) => Array.isArray(p.accounts))!;
  (account.onChange as (id: string) => void)('account');
  const amount = field('مبلغ').children as {
    props: { onValueChange: (v: string) => void };
  };
  amount.props.onValueChange('10');
  const due = field('سررسید پرداخت').children as {
    props: { onChange: (v: string) => void };
  };
  due.props.onChange('2099-01-01');
  render();
}
function choose(file: File) {
  (render().find((p) => p.type === 'file')!.onChange as (e: unknown) => void)({
    target: { files: [file], value: '' },
  });
  render();
}
function submit() {
  (
    render().find(
      (p) => p.onSubmit && p.className === 'grid gap-4 md:grid-cols-2',
    )!.onSubmit as (e: unknown) => void
  )({
    preventDefault: vi.fn(),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  h.states = [];
  h.deps = [];
  h.effects = [];
  h.detail.mockResolvedValue({ data: contract });
  h.add.mockResolvedValue({
    data: { ...contract, version: 2, payments: [newPayment] },
  });
  h.entries.mockResolvedValue({ data: [] });
  h.options.mockResolvedValue({
    data: {
      documentTypes: [
        {
          code: 'RECEIPT',
          domain: 'FINANCE',
          requiresExpiry: false,
          allowedMimeTypes: ['application/pdf'],
          maxFileSizeBytes: 10000,
        },
      ],
      uploadPolicy: {
        allowedMimeTypes: ['application/pdf'],
        maxFileSizeBytes: 10000,
      },
    },
  });
  h.upload.mockResolvedValue({ data: { id: 'receipt' } });
});
it('selects a receipt before saving and attaches it only to the newly saved payment', async () => {
  await ready();
  const file = new File(['%PDF-1.4'], 'receipt.pdf', {
    type: 'application/pdf',
  });
  choose(file);
  expect(h.upload).not.toHaveBeenCalled();
  submit();
  await vi.waitFor(() => expect(h.saved).toHaveBeenCalledOnce());
  expect(h.add).toHaveBeenCalledOnce();
  expect(h.upload).toHaveBeenCalledWith(
    'contract',
    'payment',
    expect.any(FormData),
  );
  expect((h.upload.mock.calls[0]![2] as FormData).get('file')).toBe(file);
  expect(h.upload.mock.invocationCallOrder[0]).toBeGreaterThan(
    h.add.mock.invocationCallOrder[0]!,
  );
});
it('keeps an optional receipt optional and never uploads when payment creation fails', async () => {
  await ready();
  h.add.mockRejectedValueOnce(Error('Synthetic payment rejected'));
  choose(new File(['%PDF'], 'receipt.pdf', { type: 'application/pdf' }));
  submit();
  await vi.waitFor(() =>
    expect(render().some((p) => p.title === 'Synthetic payment rejected')).toBe(
      true,
    ),
  );
  expect(h.upload).not.toHaveBeenCalled();
  expect(h.saved).not.toHaveBeenCalled();
});
it('preserves the saved payment and receipt on a definite upload failure without adding the payment again', async () => {
  await ready();
  const file = new File(['%PDF'], 'receipt.pdf', { type: 'application/pdf' });
  choose(file);
  h.upload.mockRejectedValueOnce(
    new DocumentsApiError('Synthetic receipt rejected', 400),
  );
  submit();
  await vi.waitFor(() => expect(h.saved).toHaveBeenCalledOnce());
  const receipt = render().find((p) => p.initialFile === file)!;
  expect(receipt.paymentId).toBe('payment');
  expect(receipt.initialUnknown).toBe(false);
  submit();
  await Promise.resolve();
  expect(h.add).toHaveBeenCalledOnce();
});
it('blocks blind upload retry when the server outcome is unknown', async () => {
  await ready();
  const file = new File(['%PDF'], 'receipt.pdf', { type: 'application/pdf' });
  choose(file);
  h.upload.mockRejectedValueOnce(Error('Synthetic connection lost'));
  submit();
  await vi.waitFor(() => expect(h.saved).toHaveBeenCalledOnce());
  expect(render().find((p) => p.initialFile === file)?.initialUnknown).toBe(
    true,
  );
  expect(h.add).toHaveBeenCalledOnce();
});
it('does not require a file and allows receipt controls for contract viewers without payment history permission', async () => {
  h.entries.mockResolvedValue({
    data: [
      {
        id: 'historical-payment',
        paymentReference: 'SYNTHETIC',
        dueAt: '2099-01-01',
      },
    ],
  });
  await ready();
  expect(render().some((p) => p.paymentId === 'historical-payment')).toBe(true);
  submit();
  await vi.waitFor(() => expect(h.saved).toHaveBeenCalledOnce());
  expect(h.add).toHaveBeenCalledOnce();
  expect(h.upload).not.toHaveBeenCalled();
});
