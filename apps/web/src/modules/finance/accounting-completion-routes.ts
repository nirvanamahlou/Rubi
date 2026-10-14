import { accountingTaxRoute } from './accounting-tax-model';
import { taxpayerPage } from './accounting-taxpayer-model';

/** Exact matching prevents a prefix from activating an unimplemented tax command. */
export function accountingCompletionRoute(route: string) {
  // Settings are dispatched explicitly with secure draft storage and the retained
  // inactive legacy request editor in AccountingWorkspace.
  if (route === 'taxpayer-system/settings') return undefined;
  if (accountingTaxRoute(route)) return 'tax' as const;
  if (taxpayerPage(route)) return 'taxpayer' as const;
  if (route === 'general-ledger/reports/chart-structure')
    return 'chart' as const;
  if (route === 'general-ledger/reports/journal-lines')
    return 'journal-lines' as const;
  return undefined;
}

export interface CompletionLineReport {
  basis: 'POSTED';
  currency: string;
  periodId: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
  total: number;
  debit: string;
  credit: string;
  rows: {
    id: string;
    journalId: string;
    number: number | null;
    date: string | null;
    position: number;
    account: string | null;
    detail4: string | null;
    detail5: string | null;
    detail6: string | null;
    description: string;
    debit: string;
    credit: string;
    currency: string | null;
    foreignAmount: string | null;
    rate: string | null;
  }[];
}
export interface CompletionReadiness {
  periodId: string;
  status: string;
  currency: string;
  posted: number;
  unfinished: number;
  diagnosticOnly: true;
  executionAvailable: false;
  exceptions: {
    accountId: string;
    code: string;
    title: string;
    balance: string;
    temporary: boolean;
    contrary: boolean;
  }[];
}

export function completionJournalHref(bookId: string, journalId: string) {
  return `/finance/accounting/general-ledger/documents/journals?${new URLSearchParams({ bookId, journalId })}`;
}
