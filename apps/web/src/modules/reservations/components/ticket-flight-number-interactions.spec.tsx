import { beforeEach, it, expect, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import type * as ReactModule from 'react';
import { canonicalTestTree } from '@/i18n/test-tree';
import { Input } from '@/components/ui/form-controls';
import { Button } from '@/components/ui/button';
import { TicketFlightNumberEditor } from './ticket-flight-number-editor';
import { travelRequest } from './travel-workflow-form';
const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  effect: undefined as undefined | (() => void),
  permissions: ['reservations.documents.manage'],
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const i = hooks.index++;
    if (!(i in hooks.states)) hooks.states[i] = initial;
    return [
      hooks.states[i],
      (value: unknown) => {
        hooks.states[i] =
          typeof value === 'function' ? value(hooks.states[i]) : value;
      },
    ];
  },
  useEffect: (callback: () => void) => {
    hooks.effect ??= callback;
  },
}));
vi.mock('@/modules/iam/access-context', () => ({
  useAccessPermissions: () => hooks.permissions,
}));
vi.mock('./travel-workflow-form', () => ({ travelRequest: vi.fn() }));
const onSaved = vi.fn(),
  onDirty = vi.fn();
const flights = [
  { id: 'out-offer', serviceNumber: '4512', direction: 'OUTBOUND' as const },
  { id: 'back-offer', serviceNumber: '7410', direction: 'RETURN' as const },
];
function render() {
  hooks.index = 0;
  return TicketFlightNumberEditor({
    requestId: 'request',
    flights,
    onSaved,
    onDirty,
  });
}
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  tree = canonicalTestTree(tree);
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as ReactElement<Record<string, unknown>>;
  return [node, ...nodes(node.props.children as ReactNode)];
}
beforeEach(() => {
  hooks.states = [];
  hooks.index = 0;
  hooks.effect = undefined;
  hooks.permissions = ['reservations.documents.manage'];
  vi.clearAllMocks();
  vi.mocked(travelRequest).mockImplementation(
    async (_path: string, body?: unknown) =>
      body
        ? ({
            data: {
              version: 4,
              ticketFlightNumbers: (
                body as { ticketFlightNumbers: Record<string, string> }
              ).ticketFlightNumbers,
            },
          } as never)
        : ({
            data: { workflow: { version: 3, ticketFlightNumbers: {} } },
          } as never),
  );
});
it('prefills automatic numbers, saves only the edited leg and publishes the persisted state', async () => {
  render();
  hooks.effect!();
  await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith({}));
  const inputs = nodes(render()).filter((n) => n.type === Input);
  expect(inputs.map((n) => n.props.value)).toEqual(['4512', '7410']);
  (inputs[1]!.props.onChange as (e: unknown) => void)({
    target: { value: 'b9 7411' },
  });
  expect(onDirty).toHaveBeenLastCalledWith(true);
  const save = nodes(render()).find(
    (n) => n.type === Button && n.props.children === 'ذخیره شماره‌های پرواز',
  )!;
  (save.props.onClick as () => void)();
  await vi.waitFor(() =>
    expect(onSaved).toHaveBeenLastCalledWith({ 'back-offer': 'B9 7411' }),
  );
  expect(travelRequest).toHaveBeenLastCalledWith(
    'reservations/requests/request/workflow',
    expect.objectContaining({
      action: 'TICKET_FLIGHT_NUMBERS',
      expectedVersion: 3,
      ticketFlightNumbers: { 'back-offer': 'B9 7411' },
    }),
  );
  expect(onDirty).toHaveBeenLastCalledWith(false);
});
it('does not expose editing controls without document-management permission', () => {
  hooks.permissions = [];
  expect(render()).toBeNull();
});
