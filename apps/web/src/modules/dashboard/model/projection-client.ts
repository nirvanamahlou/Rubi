import type { DashboardFilters } from './query';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';

export type DashboardProjectionState =
  'blocked' | 'empty' | 'ready' | 'forbidden' | 'stale';

export interface DashboardMetadata {
  generatedAt: string;
  dataAsOf: string;
  timezone: string;
  dateBasis: string;
  currencyFxBasis: string;
  filters: Readonly<DashboardFilters>;
  reportVersion: string;
  permissionSnapshot: string;
}

export interface DashboardComparisonSnapshot {
  label: string;
  previousValue: number;
  deltaPercent: number | null;
  direction: 'up' | 'down' | 'flat';
}

export interface DashboardCurrencyComparisonSnapshot extends DashboardComparisonSnapshot {
  currencyCode: string;
}

export interface DashboardTrendSnapshot {
  labels: readonly string[];
  values: readonly number[];
  series?: readonly DashboardTrendSeriesSnapshot[];
}

export interface DashboardTrendSeriesSnapshot {
  currencyCode: string;
  values: readonly number[];
}

export interface DashboardMetricSnapshot {
  value: string;
  unit: string;
  detail: string;
  metricId?: string;
  aggregation?: string;
  comparison?: DashboardComparisonSnapshot;
  comparisonSeries?: readonly DashboardCurrencyComparisonSnapshot[];
  trend?: DashboardTrendSnapshot;
}

export interface DashboardVisualCurrencySeriesSnapshot {
  currencyCode: string;
  labels: readonly string[];
  values: readonly number[];
  unit?: string;
  comparison?: DashboardComparisonSnapshot;
  trend?: DashboardTrendSnapshot;
}

export interface DashboardVisualSeriesSnapshot {
  label: string;
  values: readonly number[];
}

export interface DashboardVisualSnapshot {
  labels: readonly string[];
  values: readonly number[];
  unit?: string;
  currencyCode?: string;
  currencySeries?: readonly DashboardVisualCurrencySeriesSnapshot[];
  series?: readonly DashboardVisualSeriesSnapshot[];
  comparison?: DashboardComparisonSnapshot;
  trend?: DashboardTrendSnapshot;
}

export interface DashboardFilterOptions {
  salesChannel: readonly string[];
  branch: readonly string[];
  agent: readonly string[];
  service: readonly string[];
  agency: readonly string[];
  provider: readonly string[];
  currency: readonly string[];
  status: readonly string[];
}

export interface DashboardProjectionSnapshot {
  state: DashboardProjectionState;
  message: string;
  metadata: DashboardMetadata | null;
  filterOptions?: DashboardFilterOptions;
  metrics: Readonly<Record<string, DashboardMetricSnapshot>>;
  visuals: Readonly<Record<string, DashboardVisualSnapshot>>;
}

export interface DashboardProjectionClient {
  load(input: {
    filters: DashboardFilters;
    legalEntity: string | null;
    kpiIds?: readonly string[];
    visualIds?: readonly string[];
    signal: AbortSignal;
  }): Promise<DashboardProjectionSnapshot>;
}

export const dashboardProjectionClient: DashboardProjectionClient = {
  async load({ filters, legalEntity, kpiIds = [], visualIds = [], signal }) {
    if (signal.aborted) throw new DOMException('Request aborted', 'AbortError');
    const baseUrl = getPublicApiBaseUrl();
    if (!baseUrl)
      return {
        state: 'blocked',
        message: 'نشانی API برای Dashboard پیکربندی نشده است.',
        metadata: null,
        metrics: {},
        visuals: {},
      };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters))
      if (value) params.set(key, value);
    if (legalEntity) params.set('legalEntity', legalEntity);
    params.set('kpiIds', kpiIds.join(','));
    params.set('visualIds', visualIds.join(','));
    const load = async (
      retried = false,
    ): Promise<DashboardProjectionSnapshot> => {
      const response = await fetch(
        `${baseUrl}/reports/dashboard/projection?${params}`,
        {
          credentials: 'include',
          cache: 'no-store',
          signal,
          headers: { accept: 'application/json' },
        },
      );
      if (
        response.status === 401 &&
        !retried &&
        (await refreshAuthenticatedSession(baseUrl))
      )
        return load(true);
      if (!response.ok) throw new Error('دریافت دادهٔ Dashboard ناموفق بود.');
      return response.json() as Promise<DashboardProjectionSnapshot>;
    };
    return load();
  },
};
