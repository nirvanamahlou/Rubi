import type * as React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { FinanceDeliveryPanel } from './finance-delivery-panel';
import { financeInboxApi } from '../api/finance-inbox-api';

const hooks = vi.hoisted(() => ({
  values: [] as unknown[],
  index: 0,
  effects: [] as Array<() => unknown>,
  reference: { current: 0 },
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [
      hooks.values[index],
      (value: unknown) => {
        hooks.values[index] = value;
      },
    ];
  },
  useRef: () => hooks.reference,
  useEffect: (effect: () => unknown) => {
    hooks.effects.push(effect);
  },
}));
vi.mock('../api/finance-inbox-api', () => ({
  financeInboxApi: { customerDocumentDeliveries: vi.fn() },
}));

type Element = {
  type: unknown;
  props: Record<string, unknown> & { children?: unknown };
};
function find(
  tree: unknown,
  predicate: (element: Element) => boolean,
): Element | undefined {
  if (Array.isArray(tree))
    return tree.map((child) => find(child, predicate)).find(Boolean);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return undefined;
  const element = tree as Element;
  return predicate(element) ? element : find(element.props.children, predicate);
}
function render() {
  hooks.index = 0;
  return FinanceDeliveryPanel();
}
function setSearch(value: string) {
  const input = find(
    render(),
    (element) => element.props['aria-label'] === 'شماره قرارداد',
  )!;
  (input.props.onChange as (event: unknown) => void)({ target: { value } });
}
function submit() {
  const form = find(render(), (element) => element.type === 'form')!;
  (form.props.onSubmit as (event: unknown) => void)({
    preventDefault: vi.fn(),
  });
}
beforeEach(() => {
  hooks.values = [];
  hooks.index = 0;
  hooks.effects = [];
  hooks.reference.current = 0;
  vi.mocked(financeInboxApi.customerDocumentDeliveries).mockReset();
});
it('does not request recent contracts on mount or when submitting an empty search', () => {
  render();
  for (const effect of hooks.effects) effect();
  submit();
  setSearch('   ');
  submit();
  expect(financeInboxApi.customerDocumentDeliveries).not.toHaveBeenCalled();
});
it('requests only the explicitly submitted trimmed contract search', async () => {
  vi.mocked(financeInboxApi.customerDocumentDeliveries).mockResolvedValue([]);
  setSearch(' SC-2026-00001 ');
  expect(financeInboxApi.customerDocumentDeliveries).not.toHaveBeenCalled();
  submit();
  await Promise.resolve();
  expect(
    financeInboxApi.customerDocumentDeliveries,
  ).toHaveBeenCalledExactlyOnceWith('SC-2026-00001');
});
it('ignores a late search response after clearing the search box', async () => {
  let complete!: (rows: never[]) => void;
  vi.mocked(financeInboxApi.customerDocumentDeliveries).mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  setSearch('SC-old');
  submit();
  setSearch('');
  complete([{ contractId: 'old' } as never]);
  await Promise.resolve();
  expect(hooks.values[0]).toEqual([]);
  expect(hooks.values[2]).toBe(false);
});

it('shows the authorization basis and recorded reason on the actual contract card', () => {
  hooks.values[0] = [
    {
      contractId: 'c',
      contractNumber: 'SYNTHETIC',
      customerNameSnapshot: 'Test',
      settlementStatus: 'UNPAID',
      hasConfirmedPayment: false,
      delivery: {
        version: 1,
        approved: true,
        basis: 'RESERVATION_PERMISSION',
        reason: 'Supplier authorization evidence',
      },
    },
  ];
  const card = find(render(), (e) => e.type === 'article');
  expect(JSON.stringify(card)).toContain('با مجوز رزرواسیون');
  expect(JSON.stringify(card)).toContain('Supplier authorization evidence');
});
