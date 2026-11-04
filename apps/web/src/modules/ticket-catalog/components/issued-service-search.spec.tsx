import { beforeEach, expect, it, vi } from 'vitest';
import type * as ReactModule from 'react';
import type { ReactElement, ReactNode } from 'react';
import { canonicalTestTree } from '@/i18n/test-tree';
import { Button } from '@/components/ui';
import { IssuedTicketsWorkspace } from './issued-tickets-workspace';
const state = vi.hoisted(() => ({ values: [] as unknown[], index: 0 }));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useMemo: (f: () => unknown) => f(),
  useState: (initial: unknown) => {
    const index = state.index++;
    if (!(index in state.values))
      state.values[index] = typeof initial === 'function' ? initial() : initial;
    return [
      state.values[index],
      (next: unknown) => {
        state.values[index] =
          typeof next === 'function' ? next(state.values[index]) : next;
      },
    ];
  },
}));
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  tree = canonicalTestTree(tree);
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const n = tree as ReactElement<Record<string, unknown>>;
  return [n, ...nodes(n.props.children as ReactNode)];
}
beforeEach(() => {
  state.values = [];
  state.index = 0;
});
it('keeps filter edits pending until explicit Search and submits all filters together', () => {
  const search = vi.fn();
  const render = () => {
    state.index = 0;
    return nodes(
      IssuedTicketsWorkspace({
        tickets: [],
        onDatesChange: search,
        reportOptions: {
          origins: [{ id: 'a', name: 'Origin' }],
          destinations: [{ id: 'b', name: 'Destination' }],
          hotels: [{ id: 'h', name: 'Hotel Example' }],
        },
      }),
    );
  };
  let tree = render();
  const passenger = tree.find(
    (n) => n.props.id === 'issued-passenger' && n.props.onChange,
  )!;
  (passenger.props.onChange as (e: unknown) => void)({
    target: { value: 'Passenger' },
  });
  expect(search).not.toHaveBeenCalled();
  tree = render();
  const hotel = tree.find(
    (n) => n.type === 'select' && n.props.id === 'report-hotel',
  )!;
  (hotel.props.onChange as (e: unknown) => void)({ target: { value: 'h' } });
  expect(search).not.toHaveBeenCalled();
  tree = render();
  const action = tree.find(
    (n) => n.type === Button && n.props.children === 'جست‌وجو',
  )!;
  (action.props.onClick as () => void)();
  expect(search).toHaveBeenCalledWith(
    expect.objectContaining({
      passenger: 'Passenger',
      hotelId: 'h',
      serviceKind: 'HOTEL',
      page: 1,
    }),
  );
});
