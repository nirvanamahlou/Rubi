import type * as ReactModule from 'react';
import type { ReactNode, ReactElement } from 'react';
import { expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({
  index: 0,
  settings: {
    version: 1,
    canManage: true,
    providerStatus: 'SANDBOX_CONFIGURED',
    config: {
      schemaVersion: 1,
      countries: [
        {
          countryId: 'country',
          providerCountryCode: 'old',
          providerCountryName: 'Old',
          englishName: 'OLD',
          active: true,
          plans: [
            {
              masterPlanId: 'plan',
              providerPlanCode: '76',
              title: 'Plan',
              rates: [
                {
                  minDays: 1,
                  maxDays: 2,
                  minAge: 0,
                  maxAge: 12,
                  amount: '399000',
                  currencyCode: 'IRR',
                },
              ],
            },
          ],
        },
      ],
    },
  },
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useEffect: () => undefined,
  useRef: (value: unknown) => ({ current: value }),
  useState: (initial: unknown) => {
    const index = h.index++;
    const value =
      index === 0
        ? h.settings
        : index === 1
          ? [
              {
                id: 'country',
                code: 'GE',
                name: 'گرجستان',
                attributes: { englishName: 'GEORGIA' },
              },
            ]
          : index === 4
            ? 'country'
            : index === 11
              ? {
                  countries: [{ id: 29, title: 'گرجستان', standardCode: 'GE' }],
                  plans: [],
                  durations: [],
                }
              : initial;
    return [
      value,
      index === 0
        ? (update: (settings: typeof h.settings) => typeof h.settings) => {
            h.settings = update(h.settings);
          }
        : vi.fn(),
    ];
  },
}));
import { InsuranceSettings } from './settings';
import { NativeSearchSelect } from '@/components/ui/native-search-select';
function nodes(tree: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object' || !('props' in tree)) return [];
  const node = tree as ReactElement<Record<string, unknown>>;
  return [node, ...nodes(node.props.children as ReactNode)];
}
it('makes provider fields read-only and selecting a country fills all names without replacing plans or rates', () => {
  h.index = 0;
  const wrapper = InsuranceSettings({ branchId: 'branch' });
  const render = wrapper.type as (props: { branchId: string }) => ReactNode;
  const tree = nodes(render({ branchId: 'branch' }));
  for (const value of ['old', 'Old', 'OLD']) {
    const field = tree.find((n) => n.props.value === value && n.props.readOnly);
    expect(field).toBeDefined();
    expect(field?.props.onChange).toBeUndefined();
  }
  const selector = tree.find(
    (n) => n.type === NativeSearchSelect && n.props.value === 'old',
  )!;
  expect(selector.props.disabled).toBe(false);
  const before = structuredClone(h.settings.config.countries[0]!.plans);
  (selector.props.onChange as (event: { target: { value: string } }) => void)({
    target: { value: '29' },
  });
  expect(h.settings.config.countries[0]).toMatchObject({
    providerCountryCode: '29',
    providerCountryName: 'گرجستان',
    englishName: 'GEORGIA',
    plans: before,
  });
});
