import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type * as ReactModule from 'react';
import type { ReactNode, ReactElement } from 'react';
import { canonicalTestTree } from '@/i18n/test-tree';
const h = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  request: vi.fn(),
  send: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useEffect: vi.fn(),
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
}));
vi.mock('./travel-workflow-form', () => ({ travelRequest: h.request }));
vi.mock('./reservation-currencies', () => ({
  useReservationCurrencies: () => ({
    currencies: [{ code: 'EUR', name: 'Euro' }],
    loading: false,
    error: '',
  }),
  ReservationCurrencySelect: () => null,
}));
import { ReservationSettingsForm } from './reservation-settings';
import { MoneyInput } from '@/components/ui/money-input';
import { Button } from '@/components/ui/button';
import { defaultSupplierFormSettings } from '../model/voucher-settings';
import type { ReservationFormIntake } from '../model/reservation-form';
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  tree = canonicalTestTree(tree);
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as ReactElement<Record<string, unknown>>;
  return [node, ...nodes(node.props.children as ReactNode)];
}
beforeEach(() => {
  h.states = [];
  h.index = 0;
  h.request.mockReset();
  h.send.mockReset();
  vi.stubGlobal('fetch', h.send);
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());
it.each(['NEW', 'REQUESTED', 'CONFIRMED'] as const)(
  'saves prices for %s without sending email or replacing the last sent form',
  async (status) => {
    const intake = {
      id: 'request',
      receivedAt: '2026-11-07T00:00:00Z',
      snapshot: {
        contractNumber: 'SYNTHETIC',
        passengerIds: ['p'],
        passengerAssignments: [
          {
            customerId: 'p',
            displayNameSnapshot: 'TEST',
            ageCategory: 'ADT',
            serviceClientKeys: ['h', 't'],
          },
        ],
        serviceSelections: [
          { clientKey: 'h', kind: 'HOTEL' },
          { clientKey: 't', kind: 'TRANSFER' },
        ],
        hotelSelection: {
          serviceClientKey: 'h',
          hotelNameSnapshot: 'SAVED HOTEL',
          checkInDate: '2026-11-10',
          checkOutDate: '2026-11-13',
        },
      },
      workflow: {
        version: 6,
        supplierStatus: status,
        branding: {
          kind: 'OWN',
          companyCode: 'NIYAYESH_SEIR_SAHAR',
          name: 'TEST',
        },
        roomOrder: [],
        ageOverrides: {},
        note: '',
      },
    } as unknown as ReservationFormIntake;
    const settings = defaultSupplierFormSettings(intake, {});
    settings.brokerId = 'broker';
    settings.text.broker = 'SAVED SUPPLIER';
    settings.supplierFormPrices = {
      pp: { amount: '0', currencyCode: 'EUR' },
      ratio: { amount: '0' },
    };
    intake.workflow.supplierFormSettings = settings;
    intake.workflow.sentSupplierFormSettings = structuredClone(settings);
    let saved = intake.workflow;
    h.request.mockImplementation(async (_path, command) => {
      saved = {
        ...saved,
        version: saved.version + 1,
        ...(command.action === 'SUPPLIER_FORM_SETTINGS'
          ? { supplierFormSettings: command.voucherSettings }
          : {
              sentSupplierFormSettings: saved.supplierFormSettings!,
              sentSupplierFormVersion: saved.version + 1,
            }),
      };
      return { data: saved };
    });
    const onSaved = vi.fn();
    const render = () => {
      h.index = 0;
      return nodes(
        ReservationSettingsForm({
          intake,
          refs: {},
          onSaved,
          onDirty: vi.fn(),
          showDocument: true,
        }),
      );
    };
    for (const [label, value] of [
      ['مبلغ Hotel P.P', '123.50'],
      ['مبلغ Ratio', '2'],
    ]) {
      const field = render().find(
        (n) => n.type === MoneyInput && n.props['aria-label'] === label,
      )!;
      expect(field).toBeDefined();
      (field.props.onValueChange as (value: string) => void)(value!);
    }
    const save = render().find(
      (n) => n.type === Button && n.props.children === 'ذخیره',
    )!;
    expect(save.props.disabled).toBe(false);
    (save.props.onClick as () => void)();
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(h.request).toHaveBeenCalledTimes(1);
    expect(h.send).not.toHaveBeenCalled();
    expect(
      h.request.mock.calls[0]![1].voucherSettings.supplierFormPrices,
    ).toEqual({
      pp: { amount: '123.50', currencyCode: 'EUR' },
      ratio: { amount: '2' },
    });
    expect(h.request.mock.calls[0]![1]).toMatchObject({
      action: 'SUPPLIER_FORM_SETTINGS',
      expectedVersion: 6,
    });
    expect(saved.supplierFormSettings?.supplierFormPrices?.pp?.amount).toBe(
      '123.50',
    );
    expect(saved.sentSupplierFormSettings).toEqual(settings);
    expect(saved.sentSupplierFormSettings?.supplierFormPrices?.pp?.amount).toBe(
      '0',
    );
    expect(onSaved).toHaveBeenCalledWith(saved);
  },
);
