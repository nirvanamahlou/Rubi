'use client';

import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';

export interface SalesByOrganizationReportResult {
  reportCode: string;
  reportVersion: number;
  grain: string;
  rowGrain: string;
  sourceProjection: string;
  rows: readonly {
    grainId: string;
    branchId: string;
    ownerUserId: string;
    amount: string;
    currencyCode: string;
    contractCount: number;
  }[];
  total: number;
  page: number;
  pageSize: number;
  previewLimit: number;
  generatedAtUtc: string;
  sourceDataAsOfUtc: string | null;
  totalsByCurrency: readonly { amount: string; currencyCode: string }[];
  contractCount: number;
  reconciliation: {
    matchesApprovedProjection: true;
    referenceTotalsByCurrency: readonly {
      amount: string;
      currencyCode: string;
    }[];
  };
  filterSnapshot: {
    capturedAtUtc: string;
    branchIds: readonly string[];
    filters: Readonly<Record<string, string | readonly string[]>>;
  };
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

export interface SalesByOrganizationPreviewInput {
  reportCode?: string;
  currencyCode?: string;
  fromDate?: string;
  toDate?: string;
  legalEntity?: string;
  branchId?: string;
  ownerUserId?: string;
  status?: string;
  filterValues?: Readonly<Record<string, string>>;
  page?: number;
  pageSize?: number;
  sort?: {
    column:
      'branchId' | 'ownerUserId' | 'currencyCode' | 'amount' | 'contractCount';
    direction: 'ASC' | 'DESC';
  };
}

export interface ReportingWorkspaceCounts {
  myReports: number;
  sharedWithMe: number;
  runs: number;
  schedules: number;
  exports: number;
}

interface TravelReportResult {
  reportCode: string;
  reportVersion: number;
  grain: string;
  sourceProjection: string;
  rows: readonly { grainId: string; primaryDimension: string; secondaryDimension: string; currencyCode: string; orderCount: number; passengerCount: number; ticketCount: number; salesAmount: string; purchaseAmount: string; grossProfit: string; refundAmount: string; settlementBalance: string }[];
  total: number;
  page: number;
  pageSize: number;
  previewLimit: number;
  generatedAtUtc: string;
  sourceDataAsOfUtc: string | null;
  totalsByCurrency: readonly { currencyCode: string; salesAmount: string }[];
  filterSnapshot: SalesByOrganizationReportResult['filterSnapshot'];
  filterOptions: Readonly<Record<string, readonly string[]>>;
  warnings: readonly string[];
}

export function reportDateRangeUtc(fromDate?: string, toDate?: string) {
  const filters: Record<string, string> = {};
  if (fromDate)
    filters.fromUtc = new Date(`${fromDate}T00:00:00+03:30`).toISOString();
  if (toDate) {
    const [year, month, day] = toDate.split('-').map(Number) as [
      number,
      number,
      number,
    ];
    const nextDay = new Date(Date.UTC(year, month - 1, day + 1))
      .toISOString()
      .slice(0, 10);
    filters.toUtc = new Date(`${nextDay}T00:00:00+03:30`).toISOString();
  }
  return filters;
}

export class ReportingApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit, retried = false) {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) throw new ReportingApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await fetch(`${baseUrl}/reports${path}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...init.headers,
    },
  }).catch(() => {
    throw new ReportingApiError(
      'ارتباط گزارش‌ها با سرور برقرار نشد؛ دوباره تلاش کنید.',
      0,
    );
  });
  if (
    response.status === 401 &&
    !retried &&
    (await refreshAuthenticatedSession(baseUrl))
  )
    return request<T>(path, init, true);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
      error?: { message?: string };
    } | null;
    throw new ReportingApiError(
      response.status === 401
        ? 'نشست شما پایان یافته است؛ دوباره وارد حساب شوید.'
        : (payload?.error?.message ??
            payload?.message ??
            'اجرای گزارش ناموفق بود.'),
      response.status,
    );
  }
  return response.json() as Promise<T>;
}

export const reportingApi = {
  salesByOrganization(input: SalesByOrganizationPreviewInput = {}) {
    const genericReport = Boolean(
      input.reportCode && input.reportCode !== 'sales_by_organization',
    );
    const genericSortAliases: Record<string, string> = {
      amount: 'salesAmount',
      branchId: 'primaryDimension',
      contractCount: 'orderCount',
      ownerUserId: 'secondaryDimension',
    };
    const filters = {
      ...reportDateRangeUtc(input.fromDate, input.toDate),
      ...(input.currencyCode ? { currencyCode: input.currencyCode } : {}),
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.ownerUserId ? { ownerUserId: input.ownerUserId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.filterValues ?? {}),
    };
    return request<SalesByOrganizationReportResult | TravelReportResult>(
      `/${input.reportCode ?? 'sales_by_organization'}/preview`,
      {
        method: 'POST',
        body: JSON.stringify({
          filters,
          ...(input.legalEntity && input.legalEntity !== 'ALL'
            ? { legalEntityId: input.legalEntity }
            : {}),
          page: input.page ?? 1,
          pageSize: input.pageSize ?? 25,
          sort: genericReport
            ? {
                column:
                  genericSortAliases[input.sort?.column ?? 'amount'] ??
                  'salesAmount',
                direction: input.sort?.direction ?? 'DESC',
              }
            : input.sort ?? { column: 'amount', direction: 'DESC' },
          timezone: 'Asia/Tehran',
        }),
      },
    ).then((result) => {
      if (
        result.reportCode === 'sales_by_organization' ||
        result.sourceProjection === 'sales.reporting.organization.v2'
      ) {
        return result as SalesByOrganizationReportResult;
      }
      const travel = result as TravelReportResult;
      return {
        reportCode: travel.reportCode, reportVersion: travel.reportVersion, grain: travel.grain,
        rowGrain: 'ORDER_ITEM_CURRENCY', sourceProjection: travel.sourceProjection,
        rows: travel.rows.map((row) => ({ grainId: row.grainId, branchId: row.primaryDimension, ownerUserId: row.secondaryDimension, amount: row.salesAmount, currencyCode: row.currencyCode, contractCount: row.orderCount })),
        total: travel.total, page: travel.page, pageSize: travel.pageSize, previewLimit: travel.previewLimit,
        generatedAtUtc: travel.generatedAtUtc, sourceDataAsOfUtc: travel.sourceDataAsOfUtc,
        totalsByCurrency: travel.totalsByCurrency.map((item) => ({ currencyCode: item.currencyCode, amount: item.salesAmount })),
        contractCount: travel.total,
        reconciliation: { matchesApprovedProjection: true as const, referenceTotalsByCurrency: travel.totalsByCurrency.map((item) => ({ currencyCode: item.currencyCode, amount: item.salesAmount })) },
        filterSnapshot: travel.filterSnapshot,
        filterOptions: {
          branchIds: travel.filterOptions.branch ?? [], ownerUserIds: travel.filterOptions.expert ?? [],
          currencyCodes: travel.filterOptions.currency ?? [], statuses: travel.filterOptions.status ?? [],
        },
        capabilities: { filters: Object.keys(travel.filterOptions), sort: ['salesAmount'], unsupportedFilters: [] }, warnings: travel.warnings,
        summary: { todayContracts: 0, activeContracts: travel.total, unpaidContracts: 0, partiallySettledContracts: 0, settledContracts: 0, pendingFinancePayments: 0, pendingReservationActions: travel.rows.filter((row) => row.ticketCount === 0).length },
      } satisfies SalesByOrganizationReportResult;
    });
  },
  listWorkspace<T>(resource: 'saved' | 'runs' | 'schedule-items' | 'exports') {
    return request<readonly T[]>(`/${resource}`, { method: 'GET' });
  },
  workspaceCounts() {
    return request<ReportingWorkspaceCounts>('/workspace-counts', {
      method: 'GET',
    });
  },
  saveReport(input: { reportCode: string; name: string; sharingScope: 'PERSONAL' | 'TEAM'; isFavorite: boolean; filterState: Record<string, unknown> }) {
    return request<Record<string, unknown>>('/saved', { method: 'POST', body: JSON.stringify(input) });
  },
  deleteSaved(id: string) { return request<{ deleted: true }>(`/saved/${id}`, { method: 'DELETE' }); },
  toggleSchedule(id: string, status: 'ACTIVE' | 'PAUSED') { return request<{ id: string; status: string }>(`/schedule-items/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); },
  createSchedule(input: { savedReportId: string; name: string; frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'; runAtLocalTime: string; recipients: string[]; format: 'CSV' | 'XLSX' | 'PDF' }) {
    return request<Record<string, unknown>>('/schedule-items', { method: 'POST', body: JSON.stringify(input) });
  },
  createExport(reportCode: string, input: { format: 'CSV' | 'XLSX' | 'PDF'; query: Record<string, unknown>; simulateFailure?: boolean }) {
    return request<Record<string, unknown>>(`/${reportCode}/exports`, { method: 'POST', body: JSON.stringify(input) });
  },
  retryExport(id: string) { return request<Record<string, unknown>>(`/exports/${id}/retry`, { method: 'POST' }); },
  exportDownloadUrl(id: string) { return `${getPublicApiBaseUrl()}/reports/exports/${id}/download`; },
};
