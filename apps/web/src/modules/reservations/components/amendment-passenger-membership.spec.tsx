import { isValidElement, type ReactNode } from 'react';
import type * as ReactModule from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { SalesContractAmendmentV1 } from '@nora/contracts';
import { canonicalTestTree } from '@/i18n/test-tree';
import { AmendmentPassengerMembership } from './amendment-passenger-membership';
const h = vi.hoisted(() => ({
  index: 0,
  states: [] as unknown[],
  pending: vi.fn(),
  changed: vi.fn(),
  effects: [] as (() => unknown)[],
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
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
  useRef(initial: unknown) {
    const i = h.index++;
    if (!(i in h.states)) h.states[i] = { current: initial };
    return h.states[i];
  },
  useEffect(effect: () => unknown) {
    h.effects.push(effect);
  },
}));
const draft = {
  passengers: [{ customerId: 'one' }],
  services: [],
  passengerCategories: { one: 'ADT' },
} as unknown as SalesContractAmendmentV1;
function nodes(node: ReactNode): Record<string, unknown>[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node.props, ...nodes(node.props.children as ReactNode)];
}
function render(requestedCount?: number) {
  h.index = 0;
  const result = nodes(
    canonicalTestTree(
      AmendmentPassengerMembership({
        contractId: 'contract',
        draft,
        disabled: false,
        onChange: h.changed,
        onRegistered: vi.fn(),
        onPending: h.pending,
        requestedCount,
      }),
    ),
  );
  h.effects.splice(0).forEach((effect) => effect());
  return result;
}
beforeEach(() => {
  h.states = [];
  h.effects = [];
  vi.clearAllMocks();
});
it('adds one independent entry row for each requested additional traveler and blocks final save until rows are completed', () => {
  const input = render().find((p) => p.type === 'number')!;
  (input.onChange as (e: unknown) => void)({ target: { value: '4' } });
  const pending = render();
  expect(pending.filter((p) => p.children === 'حذف ردیف جدید')).toHaveLength(3);
  expect(pending.find((p) => p.type === 'number')?.value).toBe(4);
  expect(h.pending).toHaveBeenLastCalledWith(true);
  expect(pending.some((p) => p.children === 'قیمت کل مسافر')).toBe(false);
  (
    pending.find((p) => p.children === 'حذف ردیف جدید')!.onClick as () => void
  )();
  expect(render().filter((p) => p.children === 'حذف ردیف جدید')).toHaveLength(
    2,
  );
});
it('does not silently delete actual identities when zero or a smaller count is typed', () => {
  (render().find((p) => p.type === 'number')!.onChange as (e: unknown) => void)(
    { target: { value: '0' } },
  );
  expect(render().find((p) => p.type === 'number')?.value).toBe(1);
  expect(h.changed).not.toHaveBeenCalled();
});
it('automatically creates entry rows when the hotel room guest count increases', () => {
  render(1);
  render(3);
  expect(render(3).filter((p) => p.children === 'حذف ردیف جدید')).toHaveLength(
    2,
  );
  render(2);
  expect(render(2).filter((p) => p.children === 'حذف ردیف جدید')).toHaveLength(
    1,
  );
});
