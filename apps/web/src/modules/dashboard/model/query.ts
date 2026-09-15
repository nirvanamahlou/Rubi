import type { DashboardDateBasis } from './registry';

export type DashboardRange =
  'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface DashboardFilters {
  range: DashboardRange;
  from: string | null;
  to: string | null;
  dateBasis: DashboardDateBasis;
  salesChannel: string | null;
  branch: string | null;
  agent: string | null;
  service: string | null;
  agency: string | null;
  provider: string | null;
  currency: string | null;
  status: string | null;
  page: string | null;
  widget: string | null;
}

export const defaultDashboardFilters: DashboardFilters = {
  range: 'month',
  from: null,
  to: null,
  dateBasis: 'effective',
  salesChannel: null,
  branch: null,
  agent: null,
  service: null,
  agency: null,
  provider: null,
  currency: null,
  status: null,
  page: 'executive-overview',
  widget: null,
};

const ranges = new Set<DashboardRange>([
  'today',
  'week',
  'month',
  'quarter',
  'year',
  'custom',
]);
const dateBases = new Set<DashboardDateBasis>([
  'created',
  'issued',
  'paid',
  'effective',
]);
const read = (params: URLSearchParams, key: string) =>
  params.get(key)?.trim() || null;

export function dashboardFiltersFromSearchParams(
  params: URLSearchParams,
): DashboardFilters {
  const range = read(params, 'range');
  const dateBasis = read(params, 'dateBasis');
  return {
    range:
      range && ranges.has(range as DashboardRange)
        ? (range as DashboardRange)
        : defaultDashboardFilters.range,
    from: read(params, 'from'),
    to: read(params, 'to'),
    dateBasis:
      dateBasis && dateBases.has(dateBasis as DashboardDateBasis)
        ? (dateBasis as DashboardDateBasis)
        : defaultDashboardFilters.dateBasis,
    salesChannel: read(params, 'salesChannel'),
    branch: read(params, 'branch'),
    agent: read(params, 'agent'),
    service: read(params, 'service'),
    agency: read(params, 'agency'),
    provider: read(params, 'provider'),
    currency: read(params, 'currency'),
    status: read(params, 'status'),
    // `section` is kept as a short-lived bookmark fallback from the accordion UI.
    page:
      read(params, 'page') ??
      read(params, 'section') ??
      defaultDashboardFilters.page,
    widget: read(params, 'widget'),
  };
}

export function dashboardFiltersToSearchParams(filters: DashboardFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    const defaultValue = defaultDashboardFilters[key as keyof DashboardFilters];
    if (value && value !== defaultValue) params.set(key, value);
  }
  return params;
}

export function dashboardFilterSnapshot(filters: DashboardFilters) {
  return Object.freeze({ ...filters });
}

export function dashboardDateRangeError(
  from: string | null,
  to: string | null,
): string {
  return from && to && from > to
    ? 'تاریخ شروع باید قبل از تاریخ پایان یا برابر با آن باشد.'
    : '';
}
