import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { AccessPermissionsProvider } from '@/modules/iam/access-context';
import { dashboardKpis, dashboardPages } from '../model/registry';
import { DashboardWorkspace } from './dashboard-workspace';
const state = vi.hoisted(() => ({
  data: {
    state: 'ready',
    message: '',
    metadata: null,
    metrics: { 'new-leads': { value: '0', unit: 'تعداد', detail: '' } },
    unavailableMetrics: { 'gross-profit': 'APPROVED_MATCHED_COST_REQUIRED' },
    unavailableVisuals: {},
    visuals: {
      'executive-trend': {
        labels: ['2026-11-01'],
        values: [10],
        missingMetrics: { 'gross-profit': 'APPROVED_MATCHED_COST_REQUIRED' },
      },
    },
  },
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams({ page: 'executive-overview' }),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: state.data,
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/modules/legal-entities/components/legal-entity-context', () => ({
  useLegalEntityContext: () => ({ context: null }),
}));
it('renders missing-input reasons on cards and partial charts while retaining a genuine zero KPI', () => {
  const permissions = [
    ...new Set([
      ...dashboardKpis.map((k) => k.permission),
      ...dashboardPages.flatMap((p) =>
        p.visualizations.map((v) => v.permission),
      ),
    ]),
  ];
  const html = renderToStaticMarkup(
    <AccessPermissionsProvider value={permissions}>
      <DashboardWorkspace />
    </AccessPermissionsProvider>,
  );
  expect(html).toContain('قابل محاسبه نیست');
  expect(html).toContain('دادهٔ موردنیاز:');
  expect(html).toContain('هزینهٔ تأییدشده و منطبق با فروش کامل نیست');
  expect(html).toContain('سود ناخالص · قابل محاسبه نیست');
  expect(html).toContain('aria-label="0"');
});
