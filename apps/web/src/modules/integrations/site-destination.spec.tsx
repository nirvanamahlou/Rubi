import * as React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { WebsiteDestination } from './components/site-management';
import { websiteDestinations } from './site-publication-model';
import { canonicalTestTree } from '@/i18n/test-tree';
import { PastTourPublicationConfirmation } from '@/modules/site-commerce/past-tour-publication-confirmation';
const f = vi.hoisted(() => ({
  state: [] as unknown[],
  cursor: 0,
  effects: [] as (() => unknown)[],
  fetch: vi.fn(),
  didEffect: false,
  kind: 'tour' as 'tour' | 'floating-tour',
  periodKey: '',
  canPublish: true,
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
    kind: f.compact ? 'ticket' : f.kind,
    periodKey: f.periodKey,
    canPublish: f.canPublish,
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
const ok = (enabled = false) => ({
  ok: true,
  json: async () => ({ data: { enabled, version: 7 } }),
});
beforeEach(() => {
  f.state = [];
  f.cursor = 0;
  f.effects = [];
  f.didEffect = false;
  f.kind = 'tour';
  f.periodKey = '';
  f.canPublish = true;
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
it('saves selection immediately with the site, branch and current CAS version and no tile save button', async () => {
  await load();
  expect(f.fetch.mock.calls[0]![0]).toContain(
    '/jahan-bastan/publications/tour/resource?branchId=branch',
  );
  expect(
    nodes(tree()).some(
      (node) =>
        canonicalTestTree(node.props.children as React.ReactNode) === 'ذخیره',
    ),
  ).toBe(false);
  f.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ data: { enabled: true, version: 8 } }),
  });
  await (
    nodes(tree()).find((node) => node.props.type === 'checkbox')!.props
      .onChange as (event: unknown) => Promise<void>
  )({ target: { checked: true } });
  expect(f.fetch).toHaveBeenCalledTimes(2);
  expect(JSON.parse(f.fetch.mock.calls[1]![1].body)).toMatchObject({
    enabled: true,
    version: 7,
    branchId: 'branch',
  });
  f.fetch.mockResolvedValueOnce(ok(false));
  await (
    nodes(tree()).find((node) => node.props.type === 'checkbox')!.props
      .onChange as (event: unknown) => Promise<void>
  )({ target: { checked: false } });
  expect(JSON.parse(f.fetch.mock.calls[2]![1].body)).toMatchObject({
    enabled: false,
    version: 8,
  });
});
it('rolls a failed selection back and displays the error', async () => {
  await load();
  f.fetch.mockResolvedValueOnce({
    ok: false,
    json: async () => ({ message: 'Conflict' }),
  });
  await (
    nodes(tree()).find((node) => node.props.type === 'checkbox')!.props
      .onChange as (event: unknown) => Promise<void>
  )({ target: { checked: true } });
  expect(nodes(tree()).some((node) => node.props.role === 'alert')).toBe(true);
  expect(
    nodes(tree()).find((node) => node.props.type === 'checkbox')!.props.checked,
  ).toBe(false);
});
it('publishes a past departure only after the user confirms the selected site', async () => {
  await load();
  f.fetch.mockResolvedValueOnce({
    ok: false,
    status: 409,
    json: async () => ({
      error: { code: 'PAST_TOUR_PUBLICATION_CONFIRMATION' },
    }),
  });
  const checkbox = () =>
    nodes(tree()).find((node) => node.props.type === 'checkbox')!;
  await (checkbox().props.onChange as (event: unknown) => Promise<void>)({
    target: { checked: true },
  });
  expect(f.fetch).toHaveBeenCalledTimes(2);
  expect(checkbox().props.checked).toBe(false);
  const confirm = nodes(tree()).find(
    (node) => node.type === PastTourPublicationConfirmation,
  )!;
  expect(confirm.props.site).toBe('جهان باستان');
  f.fetch.mockResolvedValueOnce(ok(true));
  (confirm.props.onConfirm as () => void)();
  await vi.waitFor(() => expect(checkbox().props.checked).toBe(true));
  expect(f.fetch.mock.calls[2]![0]).toContain(
    '/jahan-bastan/publications/tour/resource',
  );
  expect(JSON.parse(f.fetch.mock.calls[2]![1].body)).toMatchObject({
    confirmPastDeparture: true,
    enabled: true,
    version: 7,
  });
});
it('blocks repeat toggles while a selection is being saved', async () => {
  await load();
  let finish!: (value: ReturnType<typeof ok>) => void;
  f.fetch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = (
    nodes(tree()).find((node) => node.props.type === 'checkbox')!.props
      .onChange as (event: unknown) => Promise<void>
  )({ target: { checked: true } });
  const locked = nodes(tree()).find((node) => node.props.type === 'checkbox')!;
  expect(locked.props.disabled).toBe(true);
  await (locked.props.onChange as (event: unknown) => Promise<void>)({
    target: { checked: false },
  });
  expect(f.fetch).toHaveBeenCalledTimes(2);
  finish(ok(true));
  await pending;
  expect(
    nodes(tree()).find((node) => node.props.type === 'checkbox')!.props.checked,
  ).toBe(true);
});
it('saves the selected floating period only and does not enable unpriced periods', async () => {
  f.kind = 'floating-tour';
  f.periodKey = 'dated:2026-11-20:7';
  await load();
  expect(f.fetch.mock.calls[0]![0]).toContain(
    'periodKey=dated%3A2026-11-20%3A7',
  );
  const check = nodes(tree()).find((n) => n.props.type === 'checkbox')!;
  f.fetch.mockResolvedValueOnce(ok(true));
  await (check.props.onChange as (e: unknown) => Promise<void>)({
    target: { checked: true },
  });
  expect(JSON.parse(f.fetch.mock.calls[1]![1].body)).toMatchObject({
    periodKey: f.periodKey,
    enabled: true,
  });
  f.canPublish = false;
  f.fetch.mockResolvedValueOnce(ok(false));
  await (
    nodes(tree()).find((n) => n.props.type === 'checkbox')!.props.onChange as (
      e: unknown,
    ) => Promise<void>
  )({ target: { checked: false } });
  const unpriced = nodes(tree()).find((n) => n.props.type === 'checkbox')!;
  expect(unpriced.props.disabled).toBe(true);
  await (unpriced.props.onChange as (e: unknown) => Promise<void>)({
    target: { checked: true },
  });
  expect(f.fetch).toHaveBeenCalledTimes(3);
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
