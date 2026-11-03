import { beforeEach, expect, it, vi } from 'vitest';
import type * as React from 'react';
import type { ReactNode, ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { canonicalTestTree } from '@/i18n/test-tree';
import { MoneyInput } from '@/components/ui/money-input';
import {
  emptySalesForm,
  contractSaleComponents,
  salesPayload,
  type SalesFormState,
} from '../model/sales-form';
import { PublishedPackagePrices } from './published-package-prices';
import { ContractTotalPrices } from './contract-total-prices';
const h = vi.hoisted(() => ({ states: [] as unknown[], index: 0 }));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
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
}));
let state: SalesFormState;
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  tree = canonicalTestTree(tree);
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const n = tree as ReactElement<Record<string, unknown>>;
  return [n, ...nodes(n.props.children as ReactNode)];
}
const onChange = (
  contractPrices: NonNullable<SalesFormState['contractPrices']>,
) => {
  state = { ...state, contractPrices };
};
function render() {
  h.index = 0;
  return nodes(PublishedPackagePrices({ state, onChange }));
}
beforeEach(() => {
  h.states = [];
  state = {
    ...emptySalesForm,
    serviceKinds: ['HOTEL'],
    automaticComponentPricing: false,
    packageSaleAvailable: true,
    packageSaleQuote: {
      tourDepartureId: 'tour',
      selectionKey: 'exact',
      items: [],
      prices: [
        { currencyCode: 'EUR', amount: '123.45' },
        { currencyCode: 'IRR', amount: '1000000' },
      ],
    },
    contractPrices: [
      { currencyCode: 'EUR', amount: '123.45' },
      { currencyCode: 'IRR', amount: '1000000' },
    ],
    hotel: {
      ...emptySalesForm.hotel,
      rooms: [
        {
          ordinal: 1,
          roomTypeId: '11111111-1111-4111-8111-111111111111',
          roomTypeNameSnapshot: 'Room',
          adults: 2,
          childAges: [],
          agreedPrice: { currencyCode: 'EUR', amount: '123.45' },
        },
      ],
    },
  };
});
it('shows fixed published prices with only manual discount inputs, and preserves exact currency totals and room prices', () => {
  const html = renderToStaticMarkup(
    <ContractTotalPrices state={state} currencies={[]} onChange={onChange} />,
  );
  expect(html).toContain('123.45');
  expect(html).not.toContain('مبلغ کل قرارداد EUR');
  expect(html).not.toContain('کمیسیون');
  h.states = [];
  const inputs = render().filter((n) => n.type === MoneyInput);
  expect(inputs).toHaveLength(2);
  const euro = inputs.find(
    (n) => n.props['aria-label'] === 'تخفیف فروشنده EUR',
  )!;
  (euro.props.onValueChange as (v: string) => void)('13.25');
  expect(state.contractPrices).toEqual([
    { currencyCode: 'EUR', amount: '110.2' },
    { currencyCode: 'IRR', amount: '1000000' },
  ]);
  expect(contractSaleComponents(state)).toContainEqual({
    type: 'DISCOUNT',
    title: 'تخفیف فروشنده',
    currencyCode: 'EUR',
    amount: '13.25',
  });
  expect(state.hotel.rooms![0]!.agreedPrice!.amount).toBe('123.45');
});
it('blocks an excessive discount rather than retaining a silently valid previous total', () => {
  const euro = render().find(
    (n) =>
      n.type === MoneyInput && n.props['aria-label'] === 'تخفیف فروشنده EUR',
  )!;
  (euro.props.onValueChange as (v: string) => void)('999');
  expect(state.contractPrices![0]!.amount).toBe('');
  expect(() => contractSaleComponents(state)).toThrow();
  expect(render().some((n) => n.props.role === 'alert')).toBe(true);
});

it('keeps stale manual passenger fares and commissions out of the published-package payload', () => {
  state = {
    ...state,
    serviceKinds: ['FLIGHT', 'HOTEL'],
    tripType: 'ONE_WAY',
    priceEntryMode: 'CONTRACT_TOTAL',
    passengerTotalPricing: false,
    passengerFlightPrices: { stale: [{ currencyCode: 'EUR', amount: '999' }] },
    passengerDeductions: {
      stale: { commission: { currencyCode: 'EUR', amount: '99' } },
    },
  };
  const payload = salesPayload(state);
  expect(payload.priceComponents).toContainEqual({
    type: 'BASE',
    title: 'مبلغ کل قرارداد',
    currencyCode: 'EUR',
    amount: '123.45',
  });
  expect(JSON.stringify(payload.services)).not.toContain(
    'passengerFlightPricesV1',
  );
  expect(JSON.stringify(payload.services)).not.toContain(
    'passengerDeductionsV1',
  );
  expect(JSON.stringify(payload.services)).not.toContain('999');
});
