import * as React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { WebsiteDestination } from './components/site-management';
import { websiteDestinations } from './site-publication-model';
import { canonicalTestTree } from '@/i18n/test-tree';
const f = vi.hoisted(() => ({
  state: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
  didEffect: false,
  compact: false,
  saving: { current: false },
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof React>()),
  useRef: () => f.saving,
  useState: (value: unknown) => {
    const i = f.cursor++;
    if (!(i in f.state)) f.state[i] = value;
    return [
      f.state[i],
      (v: unknown) => {
        f.state[i] =
          typeof v === 'function'
            ? (v as (old: unknown) => unknown)(f.state[i])
            : v;
      },
    ];
  },
  useEffect: (effect: () => unknown) => {
    if (!f.didEffect) {
      f.effects.push(effect);
      f.didEffect = true;
    }
  },
}));
vi.mock('@/lib/environment', () => ({ getPublicApiBaseUrl: () => '/api/v1' }));
vi.mock('@/i18n/localized-fetch', () => ({ localizedFetch: f.fetch }));
function tree() {
  f.cursor = 0;
  return WebsiteDestination({
    site: websiteDestinations[1],
    kind: f.compact ? 'ticket' : 'tour',
    resourceId: 'resource',
    branchId: 'branch',
    compact: f.compact,
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
function button(label: string) {
  return nodes(tree()).find(
    (n) =>
      canonicalTestTree(n.props.children as React.ReactNode) === label &&
      typeof n.props.onClick === 'function',
  )!.props;
}
const ok = (enabled = false) => ({
  ok: true,
  json: async () => ({ data: { enabled, version: 7 } }),
});
beforeEach(() => {
  f.state = [];
  f.cursor = 0;
  f.effects = [];
  f.didEffect = false;
  f.compact = false;
  f.saving = { current: false };
  f.fetch.mockReset();
});
async function load() {
  f.fetch.mockResolvedValueOnce(ok());
  tree();
  f.effects.forEach((e) => e());
  await new Promise((r) => setTimeout(r, 0));
}
it('reads scoped state, selecting does not publish and explicit save uses the same site/branch/CAS', async () => {
  await load();
  expect(f.fetch.mock.calls[0]![0]).toContain(
    '/jahan-bastan/publications/tour/resource?branchId=branch',
  );
  const checkbox = nodes(tree()).find((n) => n.props.type === 'checkbox')!;
  (checkbox.props.onChange as (e: unknown) => void)({
    target: { checked: true },
  });
  expect(f.fetch).toHaveBeenCalledTimes(1);
  f.fetch.mockResolvedValueOnce(ok(true));
  expect(button('ذخیره').disabled).toBe(false);
  await (button('ذخیره').onClick as () => Promise<void>)();
  await new Promise((r) => setTimeout(r, 0));
  expect(JSON.parse(f.fetch.mock.calls[1]![1].body)).toMatchObject({
    enabled: true,
    version: 7,
    branchId: 'branch',
  });
  expect(button('ذخیره').disabled).toBe(true);
});
it('retains input and exposes save failure instead of claiming delivery', async () => {
  await load();
  const checkbox = nodes(tree()).find((n) => n.props.type === 'checkbox')!;
  (checkbox.props.onChange as (e: unknown) => void)({
    target: { checked: true },
  });
  f.fetch.mockResolvedValueOnce({
    ok: false,
    json: async () => ({ message: 'Conflict' }),
  });
  await (button('ذخیره').onClick as () => Promise<void>)();
  await new Promise((r) => setTimeout(r, 0));
  expect(nodes(tree()).some((n) => n.props.role === 'alert')).toBe(true);
  expect(button('ذخیره').disabled).toBe(false);
});

it('saves a ticket checkbox immediately without a Save button, uses returned versions, and keeps pencil editing', async () => {
  f.compact = true;
  await load();
  let finish: (value: unknown) => void = () => undefined;
  f.fetch.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const checkbox = nodes(tree()).find((n) => n.props.type === 'checkbox')!;
  const change = checkbox.props.onChange as (e: unknown) => void;
  change({ target: { checked: true } });
  change({ target: { checked: false } });
  expect(f.fetch).toHaveBeenCalledTimes(2);
  expect(JSON.parse(f.fetch.mock.calls[1]![1].body)).toEqual({
    enabled: true,
    version: 7,
    branchId: 'branch',
  });
  expect(
    nodes(tree()).find((n) => n.props.type === 'checkbox')?.props.disabled,
  ).toBe(true);
  expect(
    nodes(tree()).some(
      (n) => canonicalTestTree(n.props.children as React.ReactNode) === 'ذخیره',
    ),
  ).toBe(false);
  expect(
    nodes(tree()).find((n) => n.props['aria-label'] === 'ویرایش جهان باستان'),
  ).toBeTruthy();
  finish({
    ok: true,
    json: async () => ({ data: { enabled: true, version: 8 } }),
  });
  await new Promise((r) => setTimeout(r, 0));
  expect(
    nodes(tree()).find((n) => n.props.type === 'checkbox')?.props.checked,
  ).toBe(true);
  f.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: { enabled: false, version: 9 } }),
  });
  (
    nodes(tree()).find((n) => n.props.type === 'checkbox')!.props.onChange as (
      e: unknown,
    ) => void
  )({ target: { checked: false } });
  await new Promise((r) => setTimeout(r, 0));
  expect(JSON.parse(f.fetch.mock.calls[2]![1].body)).toEqual({
    enabled: false,
    version: 8,
    branchId: 'branch',
  });
});
it('rolls back an auto-saved checkbox on failure and keeps an error visible for retry', async () => {
  f.compact = true;
  await load();
  f.fetch.mockResolvedValueOnce({
    ok: false,
    json: async () => ({ message: 'Conflict' }),
  });
  (
    nodes(tree()).find((n) => n.props.type === 'checkbox')!.props.onChange as (
      e: unknown,
    ) => void
  )({ target: { checked: true } });
  await new Promise((r) => setTimeout(r, 0));
  expect(
    nodes(tree()).find((n) => n.props.type === 'checkbox')?.props.checked,
  ).toBe(false);
  expect(
    nodes(tree()).find((n) => n.props.type === 'checkbox')?.props.disabled,
  ).toBe(false);
  expect(nodes(tree()).some((n) => n.props.role === 'alert')).toBe(true);
});
