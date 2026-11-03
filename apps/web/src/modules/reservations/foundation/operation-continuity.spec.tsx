import type * as ReactModule from 'react';
import type { ReactNode, ReactElement } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ states: [] as unknown[], index: 0 }));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const n = h.index++;
    if (!(n in h.states))
      h.states[n] = typeof initial === 'function' ? initial() : initial;
    return [
      h.states[n],
      (v: unknown) => {
        h.states[n] = typeof v === 'function' ? v(h.states[n]) : v;
      },
    ];
  },
}));
vi.mock('./queue-names', () => ({
  useQueueNames: (rows: unknown[]) => ({ rows, ready: true }),
}));
vi.mock('./use-purchase-completion', () => ({
  usePurchaseCompletion: () => false,
}));
import { ContractActionPanel, ContractActionContent } from './action-panel';
import { ReservationOperationsWorkspace } from './workspace';
import { Dialog } from '@/components/ui/overlays';
import type { RequestView } from './model';
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as ReactElement<Record<string, unknown>>;
  return [node, ...nodes(node.props.children as ReactNode)];
}
const row = (id: string): RequestView => ({
  id,
  contractId: id,
  contractNumber: id,
  branchId: 'branch',
  branchName: 'Branch',
  customerName: 'Synthetic',
  issuerName: 'Issuer',
  salesCounter: 'Seller',
  assignee: null,
  passengerNames: [],
  services: ['HOTEL'],
  priority: 'NORMAL',
  deadline: null,
  createdAt: '2026-11-02T09:00:00Z',
  status: 'NEW',
  issues: [],
});
beforeEach(() => {
  h.states = [];
  h.index = 0;
});
it('keeps the opening request and form identity until deliberate close, even if the queue selection changes', () => {
  const first = row('one'),
    second = row('two');
  const render = (request: RequestView) => {
    h.index = 0;
    return nodes(ContractActionPanel({ request }));
  };
  let tree = render(first);
  const dialog = tree.find((n) => n.type === Dialog && n.key === 'خرید')!;
  (dialog.props.onOpenChange as (open: boolean) => void)(true);
  tree = render(second);
  expect(
    tree
      .filter((n) => n.type === ContractActionContent)
      .every((n) => n.props.request === first),
  ).toBe(true);
  const changed = tree.find((n) => n.type === Dialog && n.key === 'خرید')!;
  (changed.props.onOpenChange as (open: boolean) => void)(false);
  tree = render(second);
  expect(
    tree
      .filter((n) => n.type === ContractActionContent)
      .every((n) => n.props.request === second),
  ).toBe(true);
});
it('pins initial selection across new arrivals and keeps the action panel mounted within its access scope', () => {
  const access = {
    authenticated: true,
    permissions: ['reservations.read'],
    branchIds: ['branch'],
  };
  const render = (rows: RequestView[], scope = access) => {
    h.index = 0;
    return nodes(
      ReservationOperationsWorkspace({
        state: 'SUCCESS',
        rows,
        access: scope,
        initialSection: 'inbox',
        now: '2026-11-02T10:00:00Z',
      }),
    );
  };
  render([row('100')]);
  let tree = render([row('100')]);
  const panel = tree.find((n) => n.type === ContractActionPanel)!;
  tree = render([row('1'), row('100')]);
  const refreshed = tree.find((n) => n.type === ContractActionPanel)!;
  expect((refreshed.props.request as RequestView).id).toBe('100');
  expect(refreshed.key).toBe(panel.key);
  tree = render([row('200')]);
  expect(tree.find((n) => n.type === ContractActionPanel)!.key).toBe(panel.key);
  tree = render([row('200')], { ...access, branchIds: ['other'] });
  expect(tree.find((n) => n.type === ContractActionPanel)!.key).not.toBe(
    panel.key,
  );
});
