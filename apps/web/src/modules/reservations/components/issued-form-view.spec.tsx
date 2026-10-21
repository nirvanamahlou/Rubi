import { beforeEach, it, expect, vi } from 'vitest';
import type * as ReactModule from 'react';
import { isValidElement, type ReactNode } from 'react';
import { TravelWorkflowForm } from './travel-workflow-form';
import { TravelDocument } from './travel-document';
import { ReservationSettings } from './reservation-settings';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form-controls';
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
  expect(tree.filter((n) => n.type === Button)).toHaveLength(1);
  expect(
    nodes(
      tree.find((n) => n.type === Button)?.props.children as ReactNode,
    ).some((n) => n.props.children === 'اصلاح'),
  ).toBe(true);
  expect(document?.props.downloadLabel).toBe('دانلود');
  expect(tree.some((n) => n.type === Textarea)).toBe(false);
});
it('keeps sent forms compact before voucher issuance and opens settings only after explicit editing', () => {
  const intake = state.values[3] as {
    workflow: { voucherIssued: boolean; supplierStatus: string };
  };
  intake.workflow.voucherIssued = false;
  intake.workflow.supplierStatus = 'REQUESTED';
  let tree = nodes(TravelWorkflowForm({ id: 'request', action: 'رزرواسیون' }));
  expect(tree.filter((n) => n.type === Button)).toHaveLength(1);
  expect(tree.some((n) => n.type === ReservationSettings)).toBe(false);
  state.index = 0;
  state.values[1] = true;
  tree = nodes(TravelWorkflowForm({ id: 'request', action: 'رزرواسیون' }));
  expect(tree.some((n) => n.type === ReservationSettings)).toBe(true);
});
it('historical form viewing has no mutation controls', () => {
  const tree = nodes(
    TravelWorkflowForm({ id: 'request', action: 'رزرواسیون', readOnly: true }),
  );
  expect(tree[0]?.type).toBe(TravelDocument);
  expect(tree.some((n) => n.props.onClick || n.props.onChange)).toBe(false);
});

it.each([2, 9])(
  'opens legacy issued form version %s without requiring the newer sent snapshot field',
  (version) => {
    const intake = state.values[3] as {
      workflow: {
        voucherIssued: boolean;
        supplierStatus: string;
        sentSupplierFormSettings?: unknown;
        sentSupplierFormVersion?: number;
      };
    };
    intake.workflow.voucherIssued = false;
    intake.workflow.supplierStatus = 'REQUESTED';
    delete intake.workflow.sentSupplierFormSettings;
    intake.workflow.sentSupplierFormVersion = version;
    const tree = nodes(
      TravelWorkflowForm({ id: 'request', action: 'رزرواسیون' }),
    );
    expect(tree.some((node) => node.type === ReservationSettings)).toBe(false);
    expect(
      tree.find((node) => node.type === TravelDocument)?.props.downloadLabel,
    ).toBe('دانلود');
    expect(tree.filter((node) => node.type === Button)).toHaveLength(1);
  },
);

it.each([undefined, 0, -1, 1.5])(
  'does not treat a saved draft with invalid issuance version %s as issued',
  (version) => {
    const intake = state.values[3] as {
      workflow: {
        voucherIssued: boolean;
        supplierStatus: string;
        sentSupplierFormSettings?: unknown;
        sentSupplierFormVersion?: number | undefined;
      };
    };
    intake.workflow.voucherIssued = false;
    intake.workflow.supplierStatus = 'NEW';
    delete intake.workflow.sentSupplierFormSettings;
    intake.workflow.sentSupplierFormVersion = version;
    const tree = nodes(
      TravelWorkflowForm({ id: 'request', action: 'رزرواسیون' }),
    );
    expect(tree.some((node) => node.type === ReservationSettings)).toBe(true);
  },
);
