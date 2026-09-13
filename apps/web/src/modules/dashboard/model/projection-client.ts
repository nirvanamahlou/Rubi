import type { DashboardFilters } from './query';

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

export interface DashboardProjectionSnapshot {
  state: DashboardProjectionState;
  message: string;
  metadata: DashboardMetadata | null;
}

export interface DashboardProjectionClient {
  load(input: {
    filters: DashboardFilters;
    legalEntity: string | null;
    signal: AbortSignal;
  }): Promise<DashboardProjectionSnapshot>;
}

/** Deny-by-default adapter. No network call exists until Reporting publishes v1. */
export const dashboardProjectionClient: DashboardProjectionClient = {
  async load({ signal }) {
    if (signal.aborted) throw new DOMException('Request aborted', 'AbortError');
    return {
      state: 'blocked',
      message:
        'قرارداد عمومی، نسخه‌دار و permission-aware داشبورد هنوز منتشر نشده است.',
      metadata: null,
    };
  },
};
