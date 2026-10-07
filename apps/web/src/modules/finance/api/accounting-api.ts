'use client';
import type {
  AccountingBookV1,
  AccountingCommandV1,
  AccountingJournalV1,
  AccountingSnapshotV1,
  AccountingReportV1,
} from '@nora/contracts';
import { apiRequest } from './finance-inbox-api';

const base = '/finance/accounting/books';
export const accountingApi = {
  books: () =>
    apiRequest<{
      books: AccountingBookV1[];
      branches: { id: string; name: string }[];
    }>(base),
  createBook: (payload: Record<string, unknown>) =>
    apiRequest<AccountingBookV1>(base, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  snapshot: (id: string) => apiRequest<AccountingSnapshotV1>(`${base}/${id}`),
  journals: (id: string, query: Record<string, string>) =>
    apiRequest<{
      items: AccountingJournalV1[];
      total: number;
      page: number;
      pageSize: number;
    }>(`${base}/${id}/journals?${new URLSearchParams(query)}`),
  command: <T = unknown>(
    id: string,
    action: string,
    command: AccountingCommandV1,
  ) =>
    apiRequest<T>(`${base}/${id}/actions/${action}`, {
      method: 'POST',
      body: JSON.stringify(command),
    }),
  report: (id: string, query: Record<string, string>) =>
    apiRequest<AccountingReportV1>(
      `${base}/${id}/reports/trial-balance?${new URLSearchParams(query)}`,
    ),
};
