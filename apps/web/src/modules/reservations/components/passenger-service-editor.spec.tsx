import { expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { canonicalTestTree } from '@/i18n/test-tree';
import { PassengerServiceEditor } from './passenger-service-editor';
import type { SalesContractAmendmentV1 } from '@nora/contracts';
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const n = tree as ReactElement<Record<string, unknown>>;
  return [n, ...nodes(n.props.children as ReactNode)];
}
const draft = {
  services: [
    { clientKey: 'out', kind: 'FLIGHT', metadata: { direction: 'OUTBOUND' } },
    {
      clientKey: 'back',
      kind: 'TRANSFER',
      metadata: { direction: 'RETURN', passengerCount: 1 },
    },
    { clientKey: 'hotel', kind: 'HOTEL', metadata: {} },
  ],
  passengers: [
    { customerId: 'p', serviceClientKeys: ['out', 'back', 'hotel'] },
    { customerId: 'q', serviceClientKeys: ['hotel'] },
  ],
  hotelSelection: {
    serviceClientKey: 'hotel',
    checkInDate: '2026-11-01',
    checkOutDate: '2026-11-08',
  },
} as unknown as SalesContractAmendmentV1;
it('edits flight and transfer memberships per person and updates transfer quantity', () => {
  for (const index of [0, 1]) {
    const onChange = vi.fn();
    const tree = nodes(
      canonicalTestTree(
        PassengerServiceEditor({
          draft,
          customerId: 'p',
          disabled: false,
          onChange,
        }),
      ),
    );
    const inputs = tree.filter((n) => n.type === 'input');
    (inputs[index]!.props.onChange as (e: unknown) => void)({
      target: { checked: false },
    });
    const next = onChange.mock.calls[0]![0];
    expect(next.passengers[0].serviceClientKeys).not.toContain(
      index === 0 ? 'out' : 'back',
    );
    expect(next.passengers[1]).toEqual(draft.passengers[1]);
    if (index === 1) expect(next.services[1].metadata.passengerCount).toBe(0);
  }
});
it('persists complete per-guest stay metadata without changing shared hotel dates', () => {
  const onChange = vi.fn();
  const inputs = nodes(
    canonicalTestTree(
      PassengerServiceEditor({
        draft,
        customerId: 'p',
        disabled: false,
        onChange,
      }),
    ),
  ).filter((n) => n.type === 'input');
  (inputs[2]!.props.onChange as (e: unknown) => void)({
    target: { checked: true },
  });
  const next = onChange.mock.calls[0]![0];
  expect(JSON.parse(next.services[2].metadata.passengerHotelStaysV1)).toEqual({
    p: {
      different: true,
      checkInDate: '2026-11-01',
      checkOutDate: '2026-11-08',
    },
    q: {
      different: false,
      checkInDate: '2026-11-01',
      checkOutDate: '2026-11-08',
    },
  });
  expect(next.hotelSelection).toEqual(draft.hotelSelection);
  expect(draft.services[2]?.metadata).toEqual({});
});
