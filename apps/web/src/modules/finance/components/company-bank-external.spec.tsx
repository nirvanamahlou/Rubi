import type * as ReactModule from 'react';
import type { ReactElement } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
const hooks = vi.hoisted(() => ({
  index: 0,
  refIndex: 0,
  states: [] as unknown[],
  refs: [] as { current: unknown }[],
  create: vi.fn(),
  list: vi.fn(),
  options: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useEffect: () => undefined,
  useCallback: <T,>(fn: T) => fn,
  useRef: <T,>(value: T) =>
    hooks.refs[hooks.refIndex++] ??
    (hooks.refs[hooks.refIndex - 1] = { current: value }),
  useState: <T,>(value: T) => {
    const index = hooks.index++;
    if (!(index in hooks.states)) hooks.states[index] = value;
    return [
      hooks.states[index],
      (next: T) => {
        hooks.states[index] =
          typeof next === 'function'
            ? (next as (previous: unknown) => T)(hooks.states[index])
            : next;
      },
    ];
  },
}));
vi.mock('../api/bank-accounts-api', () => ({
  bankAccountsApi: {
    create: hooks.create,
    list: hooks.list,
    options: hooks.options,
  },
}));
import { CompanyBankAccounts } from './company-bank-accounts';
function nodes(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!node || typeof node !== 'object' || !('props' in node)) return [];
  const element = node as ReactElement<Record<string, unknown>>;
  return [element, ...nodes(element.props.children)];
}
function render() {
  hooks.index = 0;
  hooks.refIndex = 0;
  return nodes(CompanyBankAccounts({ bankId: 'bank' }));
}
function open() {
  const button = render().find(
    (node) => typeof node.props.onClick === 'function',
  )!;
  (button.props.onClick as () => void)();
}
function changeExternal(checked: boolean) {
  const checkbox = render().find((node) => node.props.type === 'checkbox')!;
  (checkbox.props.onChange as (event: unknown) => void)({
    target: { checked },
  });
}
beforeEach(() => {
  hooks.states = [];
  hooks.refs = [];
  hooks.states[1] = {
    canManage: true,
    branches: [{ id: 'branch', name: 'Branch' }],
    currencies: [{ code: 'IRR', name: 'Rial' }],
  };
  hooks.states[4] = false;
  hooks.create.mockReset().mockResolvedValue({});
  hooks.list.mockReset().mockResolvedValue({ items: [], hasMore: false });
  hooks.options.mockReset().mockResolvedValue(hooks.states[1]);
});
it('removes required markers, allows explicit empty branch/currency and submits null without account numbers', async () => {
  open();
  changeExternal(true);
  for (const placeholder of ['انتخاب شعبه', 'انتخاب ارز']) {
    const select = render().find(
      (node) =>
        typeof node.props.onValueChange === 'function' &&
        nodes(node).some((child) => child.props.placeholder === placeholder),
    )!;
    (select.props.onValueChange as (value: string) => void)('__none');
  }
  const tree = render();
  expect(
    tree.find(
      (node) => node.props.id === 'company-bank-title' && node.props.maxLength,
    )?.props.required,
  ).toBe(false);
  expect(
    tree.find((node) => node.props.type === 'submit')?.props.disabled,
  ).toBe(false);
  (
    tree.find((node) => node.type === 'form')!.props.onSubmit as (
      event: unknown,
    ) => void
  )({ preventDefault() {} });
  await vi.waitFor(() => expect(hooks.create).toHaveBeenCalledOnce());
  expect(hooks.create).toHaveBeenCalledWith(
    'bank',
    expect.objectContaining({
      isExternal: true,
      branchId: null,
      currencyCode: null,
      title: '',
      accountNumber: '',
      cardNumber: '',
      iban: '',
    }),
  );
});
it('restores ordinary-account requirements when unchecked and prevents empty identifier submission', () => {
  open();
  changeExternal(true);
  changeExternal(false);
  const tree = render();
  expect(
    tree.find(
      (node) => node.props.id === 'company-bank-title' && node.props.maxLength,
    )?.props.required,
  ).toBe(true);
  (
    tree.find((node) => node.type === 'form')!.props.onSubmit as (
      event: unknown,
    ) => void
  )({ preventDefault() {} });
  expect(hooks.create).not.toHaveBeenCalled();
  expect(hooks.states[8]).toBe(
    'حداقل یکی از شماره حساب، کارت یا شبا را وارد کنید.',
  );
});
