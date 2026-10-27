/** Internal public aggregate contract v1. No customer/contact/contract identities. */
export interface DashboardSourceQuery {
  actor: {
    userId: string;
    permissions: readonly string[];
    branchIds: readonly string[];
  };
  from: Date;
  to: Date;
  branchId?: string;
  filters: Readonly<Record<string, string>>;
  dateBasis: string;
}
export interface DashboardObservation {
  at: Date;
  value: string;
  currencyCode?: string;
}
export interface DashboardSourceMetric {
  kind: 'money' | 'count';
  aggregation: string;
  observations: readonly DashboardObservation[];
}
export interface DashboardSourceResult {
  source: string;
  state: 'ready' | 'forbidden' | 'unsupported' | 'unavailable';
  reason?: string;
  metrics: Readonly<Record<string, DashboardSourceMetric>>;
}
export function unsupportedDashboardFilters(
  query: DashboardSourceQuery,
  supported: readonly string[],
) {
  return Object.keys(query.filters).some((key) => !supported.includes(key));
}
