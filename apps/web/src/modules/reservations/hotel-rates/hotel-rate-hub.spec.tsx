import { beforeEach, expect, it, vi } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import type * as ReactModule from 'react';
import { canonicalTestTree } from '@/i18n/test-tree';
import { HotelRateHub } from './hotel-rate-hub';
import { PackArchivePanel } from './pack-archive-panel';
import { HotelRatePacksWorkspace } from './packs-workspace';

const mock = vi.hoisted(() => ({
  states: [] as unknown[],
  deps: [] as (readonly unknown[])[],
  effects: [] as (() => unknown)[],
  index: 0,
  effect: 0,
  write: true,
  request: vi.fn(),
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const i = mock.index++;
    if (!(i in mock.states)) mock.states[i] = initial;
    return [
      mock.states[i],
      (next: unknown) => {
        mock.states[i] =
          typeof next === 'function' ? next(mock.states[i]) : next;
      },
    ];
  },
  useEffect: (callback: () => unknown, deps: readonly unknown[]) => {
    const i = mock.effect++;
    if (mock.deps[i]?.every((value, j) => Object.is(value, deps[j]))) return;
    mock.deps[i] = deps;
    mock.effects.push(callback);
  },
}));
vi.mock('@/lib/auth-session', () => ({
  refreshAuthenticatedSession: async () => ({
    user: {
      permissions: [
        'reservations.read',
        ...(mock.write ? ['reservations.hotel_purchase.write'] : []),
      ],
      branches: [{ id: 'branch', name: 'Test branch' }],
    },
  }),
}));
vi.mock('./controls', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  rateRequest: mock.request,
}));
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as ReactElement<Record<string, unknown>>;
  return [node, ...nodes(node.props.children as ReactNode)];
}
function render(component = PackArchivePanel) {
  mock.index = mock.effect = 0;
  const tree = nodes(canonicalTestTree(component()));
  mock.effects.splice(0).forEach((effect) => effect());
  return tree;
}
async function settle() {
  for (let i = 0; i < 8; i++) {
    render();
    await Promise.resolve();
  }
  return render();
}
const pack = {
  id: 'pack',
  branchId: 'branch',
  cityName: 'Test city',
  checkIn: '2026-10-01',
  checkOut: '2026-10-05',
  hotelCount: 2,
  version: 3,
  currency: 'EUR',
  archivedAt: null,
};
beforeEach(() => {
  mock.states = [];
  mock.deps = [];
  mock.effects = [];
  mock.write = true;
  mock.request.mockReset();
  mock.request.mockResolvedValue({ data: [pack], total: 1 });
});
it('routes all four cards to their corresponding workflow', () => {
  for (const section of ['excel', 'manual', 'existing', 'archive']) {
    mock.states = [];
    const cards = render(HotelRateHub).filter((n) => n.props['data-section']);
    expect(cards).toHaveLength(4);
    (
      cards.find((n) => n.props['data-section'] === section)!.props
        .onClick as () => void
    )();
    const tree = render(HotelRateHub);
    if (section === 'archive')
      expect(tree.some((n) => n.type === PackArchivePanel)).toBe(true);
    else
      expect(
        tree.find((n) => n.type === HotelRatePacksWorkspace)?.props.initialMode,
      ).toBe(section);
  }
});
it('requires confirmation before archiving and sends the selected version', async () => {
  let tree = await settle();
  expect(mock.request).toHaveBeenCalledWith(
    expect.stringContaining('includeArchived=true'),
  );
  (
    tree.find((n) => n.type === 'button' && n.props.children === 'کنارگذاری')!
      .props.onClick as () => void
  )();
  expect(mock.request.mock.calls.every((call) => !call[1])).toBe(true);
  tree = render();
  (
    tree.find((n) => n.props.children === 'تأیید کنارگذاری')!.props
      .onClick as () => void
  )();
  await settle();
  expect(mock.request).toHaveBeenCalledWith('/packs/pack/archive', {
    method: 'POST',
    body: JSON.stringify({ expectedVersion: 3 }),
  });
});
it('disables archive for read-only users and never offers it for an archived pack', async () => {
  mock.write = false;
  expect(
    (await settle()).find(
      (n) => n.type === 'button' && n.props.children === 'کنارگذاری',
    )?.props.disabled,
  ).toBe(true);
  mock.states = [];
  mock.deps = [];
  mock.request.mockResolvedValue({
    data: [{ ...pack, archivedAt: '2026-10-13T10:00:00Z' }],
    total: 1,
  });
  expect(
    (await settle()).some(
      (n) => n.type === 'button' && n.props.children === 'کنارگذاری',
    ),
  ).toBe(false);
});

it('blocks leaving while the active workflow is saving', () => {
  const cards = render(HotelRateHub);
  (
    cards.find((n) => n.props['data-section'] === 'excel')!.props
      .onClick as () => void
  )();
  let tree = render(HotelRateHub);
  (
    tree.find((n) => n.type === HotelRatePacksWorkspace)!.props
      .onBusyChange as (busy: boolean) => void
  )(true);
  tree = render(HotelRateHub);
  expect(
    tree.find((n) => n.props.children === 'بازگشت به نرخ هتل')!.props.disabled,
  ).toBe(true);
});

it('confirms exit in the page and keeps the workflow when cancelled', () => {
  const cards = render(HotelRateHub);
  (
    cards.find((n) => n.props['data-section'] === 'manual')!.props
      .onClick as () => void
  )();
  let tree = render(HotelRateHub);
  (
    tree.find((n) => n.props.children === 'بازگشت به نرخ هتل')!.props
      .onClick as () => void
  )();
  tree = render(HotelRateHub);
  expect(tree.some((n) => n.props.role === 'alert')).toBe(true);
  (
    tree.find((n) => n.props.children === 'انصراف')!.props.onClick as () => void
  )();
  tree = render(HotelRateHub);
  expect(tree.some((n) => n.type === HotelRatePacksWorkspace)).toBe(true);
  expect(tree.some((n) => n.props.role === 'alert')).toBe(false);
});
