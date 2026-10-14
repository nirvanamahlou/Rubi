import { beforeEach, it, expect, vi } from 'vitest';
import type * as ReactModule from 'react';
import { isValidElement, type ReactNode } from 'react';
import { TravelWorkflowForm } from './travel-workflow-form';
import { TravelDocument } from './travel-document';
import { ReservationSettings } from './reservation-settings';
const state = vi.hoisted(() => ({ index: 0, values: [] as unknown[] }));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState(initial: unknown) {
    const i = state.index++;
    return [i in state.values ? state.values[i] : initial, vi.fn()];
  },
  useEffect: vi.fn(),
}));
function nodes(
  n: ReactNode,
): { type: unknown; props: Record<string, unknown> }[] {
  if (Array.isArray(n)) return n.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(n)) return [];
  return [
    { type: n.type, props: n.props },
    ...nodes(n.props.children as ReactNode),
  ];
}
const sent = { brokerId: 'original-broker' };
beforeEach(() => {
  state.index = 0;
  state.values = [
    false,
    false,
    false,
    {
      id: 'request',
      snapshot: { passengerIds: [] },
      workflow: {
        version: 4,
        voucherIssued: true,
        supplierStatus: 'CONFIRMED',
        sentSupplierFormSettings: sent,
        supplierFormSettings: { brokerId: 'new-draft' },
        branding: { kind: 'OWN' },
        ageOverrides: {},
        roomOrder: [],
      },
    },
    undefined,
  ];
});
it('opens the issued form rather than its editable settings and uses the sent snapshot', () => {
  const tree = nodes(
    TravelWorkflowForm({ id: 'request', action: 'رزرواسیون' }),
  );
  const document = tree.find((n) => n.type === TravelDocument);
  expect(document).toBeDefined();
  expect(document?.props.historical).not.toBe(true);
  expect(document?.props.intake).toHaveProperty(
    'workflow.supplierFormSettings',
    sent,
  );
  expect(tree.some((n) => n.type === ReservationSettings)).toBe(false);
});
it('historical form viewing has no mutation controls', () => {
  const tree = nodes(
    TravelWorkflowForm({ id: 'request', action: 'رزرواسیون', readOnly: true }),
  );
  expect(tree[0]?.type).toBe(TravelDocument);
  expect(tree.some((n) => n.props.onClick || n.props.onChange)).toBe(false);
});
