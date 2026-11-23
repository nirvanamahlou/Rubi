import * as React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { canonicalTestTree } from '@/i18n/test-tree';
import { TicketBulkPublication } from './components/ticket-bulk-publication';
const f = vi.hoisted(() => ({
  state: [] as unknown[],
  refs: [] as { current: unknown }[],
  cursor: 0,
  refCursor: 0,
  fetch: vi.fn(),
  complete: vi.fn(),
  busy: vi.fn(),
  cleanup: undefined as undefined | (() => void),
  didEffect: false,
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useState: (initial: unknown) => {
    const i = f.cursor++;
    if (!(i in f.state)) f.state[i] = initial;
    return [
      f.state[i],
      (value: unknown) => {
        f.state[i] =
          typeof value === 'function'
            ? (value as (old: unknown) => unknown)(f.state[i])
            : value;
      },
    ];
  },
  useRef: (initial: unknown) => {
    const i = f.refCursor++;
    if (!(i in f.refs)) f.refs[i] = { current: initial };
    return f.refs[i];
  },
  useEffect: (effect: () => () => void) => {
    if (!f.didEffect) {
      f.cleanup = effect();
      f.didEffect = true;
    }
  },
}));
vi.mock('@/lib/environment', () => ({ getPublicApiBaseUrl: () => '/api/v1' }));
vi.mock('@/i18n/localized-fetch', () => ({ localizedFetch: f.fetch }));
const filters = {
  originId: 'origin',
  destinationId: 'destination',
  tripType: 'ONEWAY',
  from: '2027-01-26',
  to: '2027-01-30',
  query: '',
};
function tree(
  patch: Partial<React.ComponentProps<typeof TicketBulkPublication>> = {},
) {
  f.cursor = 0;
  f.refCursor = 0;
  return TicketBulkPublication({
    branchId: 'branch',
    filters,
    tickets: [{ id: 'offer', title: 'Synthetic flight' }],
    loading: false,
    onBusy: f.busy,
    onComplete: f.complete,
    ...patch,
  });
}
function nodes(
  element: unknown,
): React.ReactElement<Record<string, unknown>>[] {
  if (!React.isValidElement<Record<string, unknown>>(element)) return [];
  return [
    element,
    ...React.Children.toArray(
      element.props.children as React.ReactNode,
    ).flatMap(nodes),
  ];
}
function button(element: unknown, text: string) {
  return nodes(element).find(
    (node) =>
      canonicalTestTree(node.props.children as React.ReactNode) === text &&
      typeof node.props.onClick === 'function',
  )!;
}
function click(node: React.ReactElement<Record<string, unknown>>) {
  (node.props.onClick as () => void)();
}
function selectSite() {
  (
    nodes(tree()).find((node) => node.props.type === 'checkbox')!.props
      .onChange as (event: unknown) => void
  )({ target: { checked: true } });
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
beforeEach(() => {
  f.state = [];
  f.refs = [];
  f.didEffect = false;
  f.cleanup = undefined;
  f.fetch.mockReset();
  f.complete.mockReset();
  f.busy.mockReset();
});
it('requires complete filters and selected sites; selection, review and cancellation never publish', () => {
  expect(button(tree(), 'بررسی انتشار گروهی').props.disabled).toBe(true);
  selectSite();
  expect(
    button(tree({ filters: { ...filters, from: '' } }), 'بررسی انتشار گروهی')
      .props.disabled,
  ).toBe(true);
  click(button(tree(), 'بررسی انتشار گروهی'));
  expect(button(tree(), 'تأیید و انتشار گروهی')).toBeDefined();
  click(button(tree(), 'انصراف'));
  expect(button(tree(), 'تأیید و انتشار گروهی')).toBeUndefined();
  expect(f.fetch).not.toHaveBeenCalled();
});
it('invalidates review when branch, filters, sites or matched IDs change', () => {
  selectSite();
  click(button(tree(), 'بررسی انتشار گروهی'));
  for (const patch of [
    { branchId: 'another' },
    { filters: { ...filters, to: '2027-02-01' } },
    { tickets: [{ id: 'new', title: 'New' }] },
  ])
    expect(button(tree(patch), 'تأیید و انتشار گروهی')).toBeUndefined();
  selectSite();
  expect(button(tree(), 'تأیید و انتشار گروهی')).toBeUndefined();
  expect(f.fetch).not.toHaveBeenCalled();
});
it('locks duplicate confirmation and refreshes status after the native command finishes', async () => {
  selectSite();
  click(button(tree(), 'بررسی انتشار گروهی'));
  let resolve!: (response: Response) => void;
  f.fetch
    .mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { enabled: true, version: 1 } })),
    );
  const confirm = button(tree(), 'تأیید و انتشار گروهی');
  click(confirm);
  click(confirm);
  expect(f.fetch).toHaveBeenCalledTimes(1);
  expect(button(tree(), 'تأیید و انتشار گروهی').props.disabled).toBe(true);
  resolve(new Response(JSON.stringify({ data: null })));
  await tick();
  expect(f.fetch).toHaveBeenCalledTimes(2);
  expect(f.complete).toHaveBeenCalledTimes(1);
  expect(f.busy.mock.calls.map((call) => call[0])).toEqual([true, false]);
  expect(
    nodes(tree()).some((node) => node.props['aria-live'] === 'polite'),
  ).toBe(true);
  expect(f.state[2]).toEqual([
    { resourceId: 'offer', site: 'nss', status: 'saved' },
  ]);
});
it('aborts pending reads on navigation and starts no later publication', async () => {
  selectSite();
  click(button(tree(), 'بررسی انتشار گروهی'));
  let resolve!: (response: Response) => void;
  f.fetch.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  click(button(tree(), 'تأیید و انتشار گروهی'));
  const signal = f.fetch.mock.calls[0]![1].signal as AbortSignal;
  f.cleanup?.();
  expect(signal.aborted).toBe(true);
  resolve(new Response(JSON.stringify({ data: null })));
  await tick();
  expect(f.fetch).toHaveBeenCalledTimes(1);
  expect(f.complete).not.toHaveBeenCalled();
});
