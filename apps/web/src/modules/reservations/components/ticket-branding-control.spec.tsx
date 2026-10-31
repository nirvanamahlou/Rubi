import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type * as ReactModule from 'react';
import { isValidElement, type ReactNode } from 'react';
import { canonicalTestTree } from '@/i18n/test-tree';
import { TravelWorkflowForm } from './travel-workflow-form';
import { Button } from '@/components/ui/button';
const h = vi.hoisted(() => ({ index: 0, values: [] as unknown[] }));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useEffect: vi.fn(),
  useState(initial: unknown) {
    const i = h.index++;
    if (!(i in h.values))
      h.values[i] = typeof initial === 'function' ? initial() : initial;
    return [
      h.values[i],
      (next: unknown) => {
        h.values[i] = typeof next === 'function' ? next(h.values[i]) : next;
      },
    ];
  },
}));
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://api.test/api/v1',
}));
function nodes(
  value: ReactNode,
): { type: unknown; props: Record<string, unknown> }[] {
  value = canonicalTestTree(value);
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!isValidElement<Record<string, unknown>>(value)) return [];
  return [
    { type: value.type, props: value.props },
    ...nodes(value.props.children as ReactNode),
  ];
}
function render(action = 'بلیط') {
  h.index = 0;
  return nodes(TravelWorkflowForm({ id: 'request', action }));
}
beforeEach(() => {
  h.values = [
    false,
    false,
    false,
    {
      id: 'request',
      snapshot: { passengerIds: [], serviceSelections: [] },
      workflow: {
        version: 0,
        supplierStatus: 'NEW',
        voucherIssued: false,
        branding: null,
        roomOrder: [],
        ageOverrides: {},
      },
    },
  ];
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        data: {
          version: 1,
          supplierStatus: 'NEW',
          voucherIssued: false,
          branding: { kind: 'OWN', ticketWithoutLogo: true, name: 'Issuer' },
          roomOrder: [],
          ageOverrides: {},
        },
      }),
    ),
  );
});
afterEach(() => vi.unstubAllGlobals());
it.each([
  ['بلیط', 'ticketWithoutLogo'],
  ['واچر', 'voucherWithoutLogo'],
])(
  'saves explicit no-logo branding and restores normal own-logo mode for %s',
  async (action, flag) => {
    let tree = render(action);
    const radios = tree.filter(
      (n) => n.type === 'input' && n.props.type === 'radio',
    );
    expect(radios).toHaveLength(3);
    (radios[2]!.props.onChange as () => void)();
    tree = render(action);
    expect(
      tree.filter((n) => n.type === 'input' && n.props.type === 'radio')[2]!
        .props.checked,
    ).toBe(true);
    const save = tree.find(
      (n) => n.type === Button && n.props.children === 'ثبت سربرگ',
    )!;
    expect(save.props.disabled).toBe(false);
    (save.props.onClick as () => void)();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(
      JSON.parse(String(vi.mocked(fetch).mock.calls[0]![1]!.body)),
    ).toMatchObject({
      action: 'BRANDING',
      branding: { kind: 'OWN', [flag]: true },
    });
    await vi.waitFor(() =>
      expect(
        render(action).find(
          (n) => n.type === Button && n.props.children === 'ثبت سربرگ',
        )!.props.disabled,
      ).toBe(false),
    );
    const own = render(action).filter(
      (n) => n.type === 'input' && n.props.type === 'radio',
    )[0]!;
    (own.props.onChange as () => void)();
    (
      render(action).find(
        (n) => n.type === Button && n.props.children === 'ثبت سربرگ',
      )!.props.onClick as () => void
    )();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(
      JSON.parse(String(vi.mocked(fetch).mock.calls[1]![1]!.body)).branding,
    ).toMatchObject({ kind: 'OWN', [flag]: false });
  },
);
it('offers independent no-logo selection in voucher branding', () => {
  expect(
    render('واچر').filter(
      (n) => n.type === 'input' && n.props.type === 'radio',
    ),
  ).toHaveLength(3);
});

it('preserves the saved agency identity when selecting no-logo mode', async () => {
  const value = h.values[3] as { workflow: { branding: unknown } };
  value.workflow.branding = {
    kind: 'AGENCY',
    referenceId: 'saved-agency',
    name: 'Agency',
  };
  const radios = render('واچر').filter(
    (n) => n.type === 'input' && n.props.type === 'radio',
  );
  (radios[2]!.props.onChange as () => void)();
  (
    render('واچر').find(
      (n) => n.type === Button && n.props.children === 'ثبت سربرگ',
    )!.props.onClick as () => void
  )();
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  expect(
    JSON.parse(String(vi.mocked(fetch).mock.calls[0]![1]!.body)).branding,
  ).toMatchObject({
    kind: 'AGENCY',
    referenceId: 'saved-agency',
    voucherWithoutLogo: true,
  });
});
