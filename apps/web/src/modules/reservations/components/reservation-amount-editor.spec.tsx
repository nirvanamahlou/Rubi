import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type * as ReactModule from 'react';
import type { ReactNode, ReactElement } from 'react';
import { canonicalTestTree } from '@/i18n/test-tree';
import { MoneyInput, formatSalesMoney } from '@/components/ui/money-input';
import { Button } from '@/components/ui/button';
import { ReservationSettingsForm } from './reservation-settings';
import type {
  ReservationFormIntake,
  ReservationFormReferences,
} from '../model/reservation-form';
const h = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  request: vi.fn(),
  draft: {} as Record<string, unknown>,
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const index = h.index++;
    if (!(index in h.states)) {
      let value = typeof initial === 'function' ? initial() : initial;
      if (
        value &&
        typeof value === 'object' &&
        'options' in value &&
        'key' in value
      )
        value = {
          key: 'hotels',
          options: { hotels: [] },
          loading: false,
          error: '',
        };
      h.states[index] = value;
    }
    return [
      h.states[index],
      (next: unknown) => {
        h.states[index] =
          typeof next === 'function' ? next(h.states[index]) : next;
      },
    ];
  },
  useRef: (current: unknown) => ({ current }),
  useEffect: vi.fn(),
}));
vi.mock('./travel-workflow-form', () => ({ travelRequest: h.request }));
vi.mock('./reservation-currencies', () => ({
  useReservationCurrencies: () => ({
    currencies: [{ code: 'IRR', name: 'Rial' }],
    loading: false,
    error: '',
  }),
  ReservationCurrencySelect: () => null,
}));
vi.mock('../model/voucher-settings', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  defaultVoucherSettings: () => structuredClone(h.draft),
}));
const intake = {
  id: 'request',
  snapshot: {},
  workflow: { version: 5, supplierStatus: 'DRAFT' },
} as unknown as ReservationFormIntake;
const saved = vi.fn();
function render(cancelled = false, section: 'HOTEL' | 'ALL' = 'HOTEL') {
  h.index = 0;
  return ReservationSettingsForm({
    intake: cancelled
      ? {
          ...intake,
          workflow: { ...intake.workflow, supplierStatus: 'CANCELLED' },
        }
      : intake,
    refs: {} as ReservationFormReferences,
    showDocument: true,
    section,
    onSaved: saved,
    onDirty: vi.fn(),
  });
}
function elements(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  tree = canonicalTestTree(tree);
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as ReactElement<Record<string, unknown>>;
  return [node, ...elements(node.props.children as ReactNode)];
}
beforeEach(() => {
  h.states = [];
  h.index = 0;
  saved.mockReset();
  h.request.mockReset();
  h.draft = {
    version: 1,
    text: {},
    flags: {},
    numbers: { singleRooms: 0, doubleRooms: 1, customRooms: 0 },
    rooms: [],
    passengers: [{ id: 'p', selected: true, age: 'ADL' }],
    hotelPurchasePrices: [{ amount: '1250000.50', currencyCode: 'IRR' }],
    supplierFormPrices: { pp: { amount: '1250000.50', currencyCode: 'IRR' } },
  };
  h.request.mockResolvedValue({ data: { version: 6 } });
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());
it('offers a direct save-only action without requiring or sending to a broker', async () => {
  const controls = elements(render());
  const action = controls.find(
    (n) => n.type === Button && n.props.children === 'ذخیره',
  );
  expect(action?.props.disabled).toBe(false);
  (action!.props.onClick as () => void)();
  for (let i = 0; i < 8; i++) await Promise.resolve();
  expect(h.request).toHaveBeenCalledTimes(1);
  expect(h.request).toHaveBeenCalledWith(
    'reservations/requests/request/workflow',
    expect.objectContaining({
      action: 'SUPPLIER_FORM_SETTINGS',
      expectedVersion: 5,
      applyToContractAndVoucher: false,
      voucherSettings: expect.objectContaining({
        supplierFormPrices: {
          pp: { amount: '1250000.50', currencyCode: 'IRR' },
        },
        hotelPurchasePrices: [{ amount: '1250000.50', currencyCode: 'IRR' }],
      }),
    }),
  );
  expect(saved).toHaveBeenCalledWith({ version: 6 });
});
it('uses grouped money input while preserving the canonical decimal string', () => {
  const amount = elements(render()).find((n) => n.type === MoneyInput)!;
  expect(formatSalesMoney(amount.props.value as string)).toBe('1,250,000.50');
  (amount.props.onValueChange as (value: string) => void)('2500000.75');
  expect(
    elements(render()).find((n) => n.type === MoneyInput)?.props.value,
  ).toBe('2500000.75');
});

it('keeps amount saving disabled for cancelled requests', async () => {
  const action = elements(render(true)).find(
    (n) => n.type === Button && n.props.children === 'ذخیره',
  );
  expect(action?.props.disabled).toBe(true);
  (action!.props.onClick as () => void)();
  await Promise.resolve();
  expect(h.request).not.toHaveBeenCalled();
});

it('preserves entered amount and currency when choosing a broker after the amount', () => {
  render(false, 'ALL');
  const index = h.states.findIndex(
    (v) => v && typeof v === 'object' && 'options' in v,
  );
  h.states[index] = {
    key: 'airlines,hotels,brokers',
    options: {
      hotels: [],
      airlines: [],
      brokers: [
        {
          id: 'broker',
          label: 'Supplier',
          searchText: 'Supplier',
          aliases: ['Supplier'],
        },
      ],
    },
    loading: false,
    error: '',
  };
  const picker = elements(render(false, 'ALL')).find(
    (n) =>
      n.props.label === 'کارگزار' &&
      typeof n.props.onValueChange === 'function',
  );
  expect(picker).toBeDefined();
  (picker!.props.onValueChange as (id: string) => void)('broker');
  expect(
    (h.states[0] as { hotelPurchasePrices: unknown }).hotelPurchasePrices,
  ).toEqual([{ amount: '1250000.50', currencyCode: 'IRR' }]);
});

it('shows Hotel P.P and never offers a currency for Ratio', () => {
  const nodes = elements(render());
  expect(nodes.some((n) => n.props.children === 'Hotel P.P')).toBe(true);
  expect(nodes.some((n) => n.props.label === 'ارز Ratio')).toBe(false);
  expect(nodes.some((n) => n.props['aria-label'] === 'مبلغ Ratio')).toBe(true);
});
