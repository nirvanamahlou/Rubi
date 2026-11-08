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
  /** Mutually exclusive producer-owned breakdowns; never contain row identities. */
  dimensions?: Readonly<Record<string, string>>;
  /** Opaque internal grouping keys distinguish identical display labels; never sent over HTTP. */
  dimensionKeys?: Readonly<Record<string, string>>;
}
export interface DashboardSourceMetric {
  kind: 'money' | 'count';
  calculation?: 'sum' | 'mean';
  aggregation: string;
  unit?: string;
  /** Current-state measures cannot fabricate historical comparisons or sparklines. */
  snapshot?: boolean;
  observations: readonly DashboardObservation[];
}
export interface DashboardSourceResult {
  source: string;
  state: 'ready' | 'forbidden' | 'unsupported' | 'unavailable';
  reason?: string;
  metrics: Readonly<Record<string, DashboardSourceMetric>>;
  /** Partial-source failures are explicit; absent permissions never become zero. */
  unavailableMetrics?: Readonly<Record<string, string>>;
}
export function unsupportedDashboardFilters(
  query: DashboardSourceQuery,
  supported: readonly string[],
) {
  return Object.keys(query.filters).some((key) => !supported.includes(key));
}
