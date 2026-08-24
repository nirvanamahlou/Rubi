import {
  FINANCE_CONTRACT_VERSION,
  financeEndpointProposals,
  financePermissionMatrix,
} from '@rubi/contracts';

export const FINANCE_UI_VERSION = 'finance.ui.v1-preview' as const;
export const FINANCE_UI_CONTRACT_VERSION = FINANCE_CONTRACT_VERSION;
export const FINANCE_PREVIEW_NOTICE =
  'نمونه طراحی و ذخیره‌نشده؛ هیچ ثبت مالی، تایید، آزادسازی، نرخ authoritative یا فایل خروجی ایجاد نمی‌شود.' as const;

export type FinancePreviewState =
  'preview' | 'loading' | 'empty' | 'error' | 'forbidden';

export type FinanceWorkspaceGroup =
  | 'ledger'
  | 'treasury'
  | 'sales-purchase'
  | 'travel-settlement'
  | 'planning'
  | 'reporting';

export interface FinanceWorkspaceQuery {
  search: string;
  group: FinanceWorkspaceGroup | 'ALL';
  branchReference: string;
  fiscalPeriodReference: string;
  currencyCode: 'ALL' | 'IRR' | 'USD' | 'EUR' | 'TRY' | 'AED';
  status: string;
  partyReference: string;
  sortBy: 'updatedAt' | 'dueAt' | 'amount' | 'status';
  sortDirection: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export const financePreviewEndpointRoutes = {
  ...financeEndpointProposals,
  excelExport: `${financeEndpointProposals.exportRequests}?format=xlsx`,
  pdfExport: `${financeEndpointProposals.exportRequests}?format=pdf`,
} as const;

export const financeLocalPermissions = Object.values(financePermissionMatrix);

export function normalizeFinanceWorkspaceQuery(
  input: Partial<FinanceWorkspaceQuery>,
): FinanceWorkspaceQuery {
  return {
    search: input.search?.trim().slice(0, 100) ?? '',
    group: input.group ?? 'ALL',
    branchReference: input.branchReference?.trim() || 'ALL',
    fiscalPeriodReference: input.fiscalPeriodReference?.trim() || 'ALL',
    currencyCode: input.currencyCode ?? 'ALL',
    status: input.status?.trim() || 'ALL',
    partyReference: input.partyReference?.trim().slice(0, 100) ?? '',
    sortBy: input.sortBy ?? 'updatedAt',
    sortDirection: input.sortDirection === 'asc' ? 'asc' : 'desc',
    page: Math.max(1, Math.trunc(input.page ?? 1)),
    pageSize: Math.min(50, Math.max(2, Math.trunc(input.pageSize ?? 5))),
  };
}
