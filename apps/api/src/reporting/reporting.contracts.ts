export type ReportingGrain =
  | 'CONTRACT'
  | 'CONTRACT_CURRENCY'
  | 'CONTRACT_SERVICE'
  | 'ORDER_ITEM_CURRENCY'
  | 'PASSENGER'
  | 'RESERVATION'
  | 'TICKET'
  | 'SEGMENT'
  | 'PAYMENT'
  | 'CHECK'
  | 'PURCHASE'
  | 'JOURNAL'
  | 'CUSTOMER'
  | 'LEAD'
  | 'TICKET_SUPPORT'
  | 'CAMPAIGN'
  | 'EMPLOYEE'
  | 'AGENCY'
  | 'EXPORT_RUN';

export interface ReportingMoneyV1 {
  amount: string;
  currencyCode: string;
}

export interface ReportQueryV1 {
  filters: Readonly<Record<string, string | readonly string[]>>;
  page: number;
  pageSize: number;
  sort?: { column: string; direction: 'ASC' | 'DESC' };
  legalEntityId?: string;
  branchIds?: readonly string[];
  timezone: 'Asia/Tehran';
}

export interface ReportingProducerPort<Row> {
  readonly reportCode: string;
  readonly grain: ReportingGrain;
  query(input: ReportQueryV1): Promise<{
    rows: readonly Row[];
    total: number;
    dataAsOfUtc: string;
  }>;
}

export interface SalesByOrganizationReportRowV1 {
  grainId: string;
  branchId: string;
  ownerUserId: string;
  amount: string;
  currencyCode: string;
  contractCount: number;
}

export interface SalesByOrganizationReportResultV1 {
  reportCode: 'sales_by_organization';
  reportVersion: 2;
  grain: 'CONTRACT_CURRENCY';
  rowGrain: 'BRANCH_OWNER_CURRENCY';
  sourceProjection: 'sales.reporting.organization.v2';
  rows: readonly SalesByOrganizationReportRowV1[];
  total: number;
  page: number;
  pageSize: number;
  previewLimit: number;
  generatedAtUtc: string;
  sourceDataAsOfUtc: string | null;
  totalsByCurrency: readonly ReportingMoneyV1[];
  contractCount: number;
  reconciliation: {
    matchesApprovedProjection: true;
    referenceTotalsByCurrency: readonly ReportingMoneyV1[];
  };
  filterSnapshot: ReportFilterSnapshotV1;
  filterOptions: {
    branchIds: readonly string[];
    ownerUserIds: readonly string[];
    currencyCodes: readonly string[];
    statuses: readonly string[];
  };
  capabilities: {
    filters: readonly string[];
    sort: readonly string[];
    unsupportedFilters: readonly string[];
  };
  warnings: readonly string[];
  summary: {
    todayContracts: number;
    activeContracts: number;
    unpaidContracts: number;
    partiallySettledContracts: number;
    settledContracts: number;
    pendingFinancePayments: number;
    pendingReservationActions: number;
  };
}

export interface TravelReportRowV1 {
  grainId: string;
  primaryDimension: string;
  secondaryDimension: string;
  currencyCode: string;
  orderCount: number;
  passengerCount: number;
  ticketCount: number;
  salesAmount: string;
  purchaseAmount: string;
  grossProfit: string;
  refundAmount: string;
  settlementBalance: string;
  pendingReservationActions: number;
}

export interface TravelReportResultV1 {
  reportCode: string;
  reportVersion: 1;
  grain: 'ORDER_ITEM_CURRENCY';
  sourceProjection: 'reporting.travel.facts.v1';
  columns: readonly {
    key: keyof TravelReportRowV1;
    label: string;
    kind: 'TEXT' | 'NUMBER' | 'MONEY';
  }[];
  rows: readonly TravelReportRowV1[];
  total: number;
  page: number;
  pageSize: number;
  previewLimit: number;
  generatedAtUtc: string;
  sourceDataAsOfUtc: string | null;
  totalsByCurrency: readonly {
    currencyCode: string;
    salesAmount: string;
    purchaseAmount: string;
    grossProfit: string;
    refundAmount: string;
    settlementBalance: string;
  }[];
  filterSnapshot: ReportFilterSnapshotV1;
  filterOptions: Readonly<Record<string, readonly string[]>>;
  reconciliation: { matchesApprovedProjection: true; sourceRowCount: number };
  warnings: readonly string[];
}

export interface ReportingExportRequestV1 {
  reportCode: string;
  format: 'CSV' | 'XLSX' | 'PDF' | 'API';
  query: ReportQueryV1;
  issuerLegalEntityId?: string;
  includeSensitive: boolean;
}

export interface ReportFilterSnapshotV1 {
  reportCode: string;
  reportVersion: number;
  grain: ReportingGrain;
  capturedAtUtc: string;
  timezone: 'Asia/Tehran';
  legalEntityId?: string;
  branchIds: readonly string[];
  filters: Readonly<Record<string, string | readonly string[]>>;
  sort?: ReportQueryV1['sort'];
}

export interface ReportingExportAuditV1 {
  runId: string;
  actorId: string;
  reportCode: string;
  reportVersion: number;
  grain: ReportingGrain;
  format: ReportingExportRequestV1['format'];
  createdAtUtc: string;
  recordCount: number;
  filterSnapshot: ReportFilterSnapshotV1;
  status: 'PENDING' | 'RUNNING' | 'READY' | 'FAILED' | 'EXPIRED';
  documentArtifactId?: string;
  expiresAtUtc?: string;
}

/** Public, versioned read model for the local CRM dashboard. Values are
 * pre-aggregated from the approved travel fact grain; UI components never
 * calculate financial totals from row-level data. */
export interface DashboardProjectionV1 {
  state: 'ready' | 'empty';
  message: string;
  metadata: {
    generatedAt: string;
    dataAsOf: string;
    timezone: 'Asia/Tehran';
    dateBasis: string;
    currencyFxBasis: string;
    reportVersion: 'reporting.dashboard.travel.v1';
    permissionSnapshot: string;
  } | null;
  filterOptions?: {
    salesChannel: readonly string[];
    branch: readonly string[];
    agent: readonly string[];
    service: readonly string[];
    agency: readonly string[];
    provider: readonly string[];
    currency: readonly string[];
    status: readonly string[];
  };
  metrics: Readonly<
    Record<
      string,
      {
        value: string;
        unit: string;
        detail: string;
        metricId?: string;
        aggregation?: string;
        comparison?: DashboardComparisonV1;
        comparisonSeries?: readonly DashboardCurrencyComparisonV1[];
        trend?: DashboardTrendV1;
      }
    >
  >;
  visuals: Readonly<
    Record<
      string,
      {
        labels: readonly string[];
        values: readonly number[];
        metricId?: string;
        aggregation?: string;
        currencyCode?: string;
        currencySeries?: readonly DashboardVisualCurrencySeriesV1[];
        comparison?: DashboardComparisonV1;
        trend?: DashboardTrendV1;
      }
    >
  >;
}

export interface DashboardComparisonV1 {
  label: 'دوره قبل هم‌طول';
  previousValue: number;
  deltaPercent: number | null;
  direction: 'up' | 'down' | 'flat';
}

/** Per-currency comparison for monetary KPIs. Each entry keeps its own
 * denominator and deliberately never represents an FX-converted total. */
export interface DashboardCurrencyComparisonV1 extends DashboardComparisonV1 {
  currencyCode: string;
}

/** A monetary visual's values for exactly one source currency. This is an
 * additive UI-selection contract and never an FX-converted aggregate. */
export interface DashboardVisualCurrencySeriesV1 {
  currencyCode: string;
  labels: readonly string[];
  values: readonly number[];
  comparison?: DashboardComparisonV1;
  trend?: DashboardTrendV1;
}

export interface DashboardTrendV1 {
  labels: readonly string[];
  values: readonly number[];
  series?: readonly DashboardTrendSeriesV1[];
}

export interface DashboardTrendSeriesV1 {
  currencyCode: string;
  values: readonly number[];
}
