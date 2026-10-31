import { beforeEach, expect, it, vi } from 'vitest';
import type * as React from 'react';
import type { ReactNode, ReactElement } from 'react';
import { canonicalTestTree } from '@/i18n/test-tree';
import { ReservationDeliveryPermit } from './reservation-delivery-permit';
import { financeInboxApi } from '@/modules/finance/api/finance-inbox-api';
const h = vi.hoisted(() => ({
  values: [] as unknown[],
  index: 0,
  effects: [] as (() => unknown)[],
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const i = h.index++;
    if (!(i in h.values)) h.values[i] = initial;
    return [
      h.values[i],
      (v: unknown) => {
        h.values[i] = v;
      },
    ];
  },
  useEffect: (fn: () => unknown) => {
    h.effects.push(fn);
  },
}));
vi.mock('@/modules/finance/api/finance-inbox-api', () => ({
  financeInboxApi: {
    reservationDocumentDelivery: vi.fn(),
    decideReservationDocumentDelivery: vi.fn(),
  },
}));
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  tree = canonicalTestTree(tree);
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const n = tree as ReactElement<Record<string, unknown>>;
  return [n, ...nodes(n.props.children as ReactNode)];
}
function render() {
  h.index = 0;
  return nodes(ReservationDeliveryPermit({ contractId: 'contract' }));
}
async function load(
  approved = false,
  basis:
    'RESERVATION_PERMISSION' | 'FULL_SETTLEMENT' = 'RESERVATION_PERMISSION',
) {
  vi.mocked(financeInboxApi.reservationDocumentDelivery).mockResolvedValue({
    data: {
      version: 2,
      approved,
      basis,
      reason: 'Old recorded evidence',
      exceptionExpiresAt: null,
      updatedAt: null,
      updatedByUserId: null,
    },
  });
  render();
  h.effects[0]!();
  for (let i = 0; i < 4; i++) await Promise.resolve();
}
beforeEach(() => {
  h.values = [];
  h.index = 0;
  h.effects = [];
  vi.clearAllMocks();
});
it('requires a reason and sends only the reservation pathway with the displayed revision', async () => {
  await load();
  let tree = render();
  const form = tree.find((n) => n.type === 'form')!;
  (form.props.onSubmit as (e: unknown) => void)({ preventDefault: vi.fn() });
  expect(
    financeInboxApi.decideReservationDocumentDelivery,
  ).not.toHaveBeenCalled();
  tree = render();
  const input = tree.find((n) => n.props.minLength === 5)!;
  (input.props.onChange as (e: unknown) => void)({
    target: { value: '  Reservation authorization evidence  ' },
  });
  vi.mocked(
    financeInboxApi.decideReservationDocumentDelivery,
  ).mockResolvedValue({
    data: {
      version: 3,
      approved: true,
      basis: 'RESERVATION_PERMISSION',
      reason: 'Reservation authorization evidence',
      exceptionExpiresAt: null,
      updatedAt: null,
      updatedByUserId: 'u',
    },
  });
  tree = render();
  (tree.find((n) => n.type === 'form')!.props.onSubmit as (e: unknown) => void)(
    { preventDefault: vi.fn() },
  );
  for (let i = 0; i < 6; i++) await Promise.resolve();
  expect(
    financeInboxApi.decideReservationDocumentDelivery,
  ).toHaveBeenCalledWith('contract', {
    expectedVersion: 2,
    approved: true,
    basis: 'RESERVATION_PERMISSION',
    reason: 'Reservation authorization evidence',
  });
  expect(h.values[0]).toMatchObject({ version: 3, approved: true });
});
it('does not offer a mutation of another active authorization pathway', async () => {
  await load(true, 'FULL_SETTLEMENT');
  expect(render().find((n) => n.type === 'form')).toBeUndefined();
});
