import type * as ReactModule from 'react';
import type { ReactNode, ReactElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  summary: {
    canPrepare: true,
    selected: true,
    sandbox: true,
    total: 1,
    ready: false,
    policies: [
      {
        id: null as string | null,
        customerId: 'passenger',
        passengerName: 'Synthetic',
        automatic: false,
        ready: false,
        policyNumber: null,
        status: 'PENDING',
        error: 'Pending',
        sandbox: true,
      },
    ],
  },
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useEffect: () => undefined,
  useState: (initial: unknown) => [
    initial === undefined ? state.summary : initial,
    vi.fn(),
  ],
}));
vi.mock('@/lib/environment', () => ({ getPublicApiBaseUrl: () => '/api/v1' }));
vi.mock('@/lib/auth-session', () => ({
  refreshAuthenticatedSession: vi.fn(async () => false),
}));
import { ReservationInsuranceDocuments } from './reservation-insurance-documents';
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as ReactElement<Record<string, unknown>>;
  return [node, ...nodes(node.props.children as ReactNode)];
}
afterEach(() => {
  vi.unstubAllGlobals();
  state.summary.canPrepare = true;
  state.summary.policies[0]!.automatic = false;
});
it('sends the protected issuance request directly on opt-in and prevents another toggle after queuing', async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(JSON.stringify(state.summary), {
        headers: { 'content-type': 'application/json' },
      }),
  );
  vi.stubGlobal('fetch', fetcher);
  let tree = nodes(ReservationInsuranceDocuments({ id: 'intake' }));
  const checkbox = tree.find(
    (n) => n.type === 'input' && n.props.type === 'checkbox',
  )!;
  expect(checkbox.props.checked).toBe(false);
  expect(fetcher).not.toHaveBeenCalled();
  (
    checkbox.props.onChange as (event: { target: { checked: boolean } }) => void
  )({ target: { checked: true } });
  await vi.waitFor(() =>
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(
      '/api/v1/reservations/requests/intake/insurance/prepare',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    ),
  );
  state.summary.policies[0]!.automatic = true;
  tree = nodes(ReservationInsuranceDocuments({ id: 'intake' }));
  expect(tree.find((n) => n.type === 'input')?.props).toMatchObject({
    checked: true,
    disabled: true,
  });
  state.summary.canPrepare = false;
  expect(
    nodes(ReservationInsuranceDocuments({ id: 'intake' })).some(
      (n) => n.type === 'input',
    ),
  ).toBe(false);
});
